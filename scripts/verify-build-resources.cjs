const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const packageJson = require(path.join(rootDir, 'package.json'))

const requiredScripts = [
  'dev',
  'dev:desktop',
  'build',
  'build:win',
  'build:linux',
  'build:mac',
  'dev:mobile',
  'build:android',
  'build:ios',
  'sync:test',
  'build:desktop:windows',
  'build:desktop:linux',
  'build:desktop:mac',
  'build:mobile:android',
  'build:mobile:ios',
]

const requiredFiles = [
  'package.json',
  'capacitor.config.ts',
  'sistem_pos.db',
  'build/icon.png',
  'build/icon.ico',
  'src/main/preload.cjs',
  'android/app/build.gradle',
  'android/app/src/main/AndroidManifest.xml',
  'ios/App/App.xcodeproj/project.pbxproj',
  'ios/App/App/Info.plist',
]

const requiredDirs = [
  'migrations',
  'src/renderer/assets',
  'android/app/src/main/res',
  'android/app/src/main/res/mipmap-xxxhdpi',
  'android/app/src/main/res/drawable',
  'ios/App/App/Assets.xcassets/AppIcon.appiconset',
  'ios/App/App/Assets.xcassets/Splash.imageset',
]

const requiredDesktopTargets = {
  win: ['nsis', 'portable', 'zip'],
  linux: ['AppImage', 'deb', 'tar.gz'],
  mac: ['dmg'],
}

const optionalResourceDirs = [
  'templates',
  'reports',
  'assets',
]

function relativePath(filePath) {
  return path.relative(rootDir, filePath) || '.'
}

function exists(relative) {
  return fs.existsSync(path.join(rootDir, relative))
}

function list(value) {
  return Array.isArray(value) ? value : [value].filter(Boolean)
}

const failures = []
const notices = []

for (const scriptName of requiredScripts) {
  if (!packageJson.scripts?.[scriptName]) {
    failures.push(`Missing package script: ${scriptName}`)
  }
}

for (const file of requiredFiles) {
  if (!exists(file)) failures.push(`Missing required file: ${file}`)
}

for (const dir of requiredDirs) {
  const fullPath = path.join(rootDir, dir)
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
    failures.push(`Missing required directory: ${dir}`)
  }
}

for (const [platform, targets] of Object.entries(requiredDesktopTargets)) {
  const rawTarget = packageJson.build?.[platform]?.target
  const configuredTargets = list(rawTarget).map(t => (typeof t === 'object' && t.target) ? t.target : t)
  for (const target of targets) {
    if (!configuredTargets.includes(target)) {
      failures.push(`Electron Builder ${platform} target must include: ${target}`)
    }
  }
}

for (const resource of packageJson.build?.extraResources ?? []) {
  if (!resource?.from) continue
  if (!exists(resource.from)) {
    failures.push(`Electron extraResource source missing: ${resource.from}`)
  }
}

for (const dir of optionalResourceDirs) {
  if (!exists(dir)) {
    notices.push(`Optional resource directory not present, skipped: ${dir}`)
  }
}

if (failures.length > 0) {
  console.error('[build-resources] Build resource verification failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('[build-resources] Required build resources verified.')
console.log(`[build-resources] Electron output: ${packageJson.build?.directories?.output ?? 'dist'}`)
console.log(`[build-resources] Product: ${packageJson.build?.productName ?? packageJson.name}`)

for (const resource of packageJson.build?.extraResources ?? []) {
  if (!resource?.from) continue
  console.log(`[build-resources] Packaged resource: ${relativePath(path.join(rootDir, resource.from))} -> ${resource.to ?? resource.from}`)
}

for (const notice of notices) {
  console.log(`[build-resources] ${notice}`)
}
