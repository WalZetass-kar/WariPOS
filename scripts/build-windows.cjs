const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const cacheDir = path.join(rootDir, '.cache', 'win32-x64');
const binDir = path.join(rootDir, '.cache', 'bin');
const nativeModulePath = path.join(
  rootDir,
  'node_modules',
  'better-sqlite3',
  'build',
  'Release',
  'better_sqlite3.node'
);
const backupNativePath = path.join(
  rootDir,
  '.cache',
  'better_sqlite3.node.linux'
);

function patchNsisUninstallerReader() {
  function findFiles(dir, name) {
    const results = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== '.git' && entry.name !== 'dist' && entry.name !== 'release') {
            results.push(...findFiles(full, name));
          }
        } else if (entry.name === name) {
          results.push(full);
        }
      }
    } catch {}
    return results;
  }

  const nsisTargets = findFiles(path.join(rootDir, 'node_modules'), 'NsisTarget.js');
  for (const file of nsisTargets) {
    try {
      let content = fs.readFileSync(file, 'utf8');
      if (content.includes('if ((0, macosVersion_1.isMacOsCatalina)()) {')) {
        content = content.replace(
          'if ((0, macosVersion_1.isMacOsCatalina)()) {',
          'if (true /* bypass wine using pure js UninstallerReader */) {'
        );
        fs.writeFileSync(file, content, 'utf8');
        console.log(`[build-win] Patched ${path.relative(rootDir, file)} to use pure JS UninstallerReader.`);
      }
    } catch (e) {
      console.warn(`[build-win] Could not patch ${file}:`, e.message);
    }
  }
}

function setupWine64Wrapper() {
  if (process.platform === 'linux') {
    const wine64Bin = '/usr/lib/wine/wine64';
    if (fs.existsSync(wine64Bin)) {
      fs.mkdirSync(binDir, { recursive: true });
      const wrapperScript = path.join(binDir, 'wine');
      fs.writeFileSync(
        wrapperScript,
        `#!/bin/sh\nexport WINEDEBUG=-all\nexec ${wine64Bin} "$@"\n`,
        { mode: 0o755 }
      );
      process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH || ''}`;
      process.env.WINEDEBUG = '-all';
      console.log('[build-win] Configured Wine 64-bit wrapper in PATH.');
    }
  }
}

function run(cmd, args, extraEnv = {}) {
  console.log(`[build-win] Executing: ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    throw new Error(`Command failed with status ${result.status}: ${cmd} ${args.join(' ')}`);
  }
}

function readMagic(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    return buf;
  } catch {
    return null;
  }
}

function isWindowsPe(buf) {
  return buf && buf[0] === 0x4d && buf[1] === 0x5a; // MZ header
}

function ensureWindowsNativeModule() {
  const cachedNodePath = path.join(cacheDir, 'build', 'Release', 'better_sqlite3.node');
  if (!fs.existsSync(cachedNodePath) || !isWindowsPe(readMagic(cachedNodePath))) {
    console.log('[build-win] Downloading Windows x64 better_sqlite3.node for Electron 31 (ABI 125)...');
    fs.mkdirSync(cacheDir, { recursive: true });
    const tarUrl = 'https://github.com/WiseLibs/better-sqlite3/releases/download/v11.3.0/better-sqlite3-v11.3.0-electron-v125-win32-x64.tar.gz';
    run('curl', ['-L', '-s', tarUrl, '-o', path.join(cacheDir, 'better-sqlite3-win32-x64.tar.gz')]);
    run('tar', ['-zx', '-f', path.join(cacheDir, 'better-sqlite3-win32-x64.tar.gz'), '-C', cacheDir]);
  }

  const magic = readMagic(cachedNodePath);
  if (!isWindowsPe(magic)) {
    throw new Error('[build-win] Failed to get valid Windows PE binary for better_sqlite3.node');
  }
  console.log('[build-win] Windows x64 better_sqlite3.node verified.');
  return cachedNodePath;
}

async function main() {
  console.log('=== WariPOS Windows Desktop Installer Build ===\n');

  setupWine64Wrapper();
  patchNsisUninstallerReader();

  // Step 1: Verify resources
  console.log('\n[1/5] Verifying build resources...');
  run('node', ['scripts/verify-build-resources.cjs']);

  // Step 2: Build Electron backend and Vite frontend
  console.log('\n[2/5] Compiling Electron main and preload...');
  run('npm', ['run', 'build:electron']);

  console.log('\n[3/5] Building frontend application with Vite...');
  run('npm', ['run', 'build:vite']);

  // Step 3: Ensure Windows native module
  console.log('\n[4/5] Preparing Windows native binaries...');
  const windowsNodeFile = ensureWindowsNativeModule();

  // Backup Linux native binary
  if (fs.existsSync(nativeModulePath)) {
    const currentMagic = readMagic(nativeModulePath);
    if (!isWindowsPe(currentMagic)) {
      fs.mkdirSync(path.dirname(backupNativePath), { recursive: true });
      fs.copyFileSync(nativeModulePath, backupNativePath);
      console.log('[build-win] Backed up Linux better_sqlite3.node');
    }
  }

  let buildSuccess = false;
  try {
    // Swap in Windows PE DLL
    fs.copyFileSync(windowsNodeFile, nativeModulePath);
    console.log('[build-win] Swapped in Windows PE64 better_sqlite3.node for packaging.');

    // Step 4: Run electron-builder targeting NSIS and portable
    console.log('\n[5/5] Building NSIS Windows installer and Portable executable...');
    run('npx', ['electron-builder', '--win', 'nsis', 'portable', '--publish', 'never']);
    buildSuccess = true;
  } finally {
    // Step 5: Always restore Linux binary so local dev environment remains healthy
    if (fs.existsSync(backupNativePath)) {
      fs.copyFileSync(backupNativePath, nativeModulePath);
      console.log('\n[build-win] Successfully restored Linux better_sqlite3.node.');
    }
  }

  if (buildSuccess) {
    const releaseDir = path.join(rootDir, 'release');
    const pkgVersion = require(path.join(rootDir, 'package.json')).version;
    const installerFile = fs.readdirSync(releaseDir).find(f => f === `WariPOS-Setup-${pkgVersion}.exe`)
      || fs.readdirSync(releaseDir).find(f => f.startsWith('WariPOS-Setup-') && f.endsWith('.exe'));
    const portableFile = fs.readdirSync(releaseDir).find(f => f === `WariPOS-${pkgVersion}-portable.exe`)
      || fs.readdirSync(releaseDir).find(f => f.includes('portable') && f.endsWith('.exe'));

    console.log('\n=============================================');
    console.log('  Windows Desktop Build SUCCESS!');
    if (installerFile) {
      const stats = fs.statSync(path.join(releaseDir, installerFile));
      console.log(`  Installer file: release/${installerFile} (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
    }
    if (portableFile) {
      const pStats = fs.statSync(path.join(releaseDir, portableFile));
      console.log(`  Portable file:  release/${portableFile} (${(pStats.size / (1024 * 1024)).toFixed(2)} MB)`);
    }
    console.log('=============================================\n');
  }
}

main().catch(err => {
  console.error('\n[build-win] Build failed:', err);
  process.exit(1);
});
