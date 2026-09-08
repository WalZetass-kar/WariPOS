const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const androidDir = path.join(rootDir, 'android')
const releaseDir = path.join(rootDir, 'release')
const releaseApkName = 'WariPOS.apk'
const releaseAabName = 'WariPOS.aab'
const task = process.argv[2] || 'assembleDebug'
const signingEnvPath = path.join(rootDir, '.keys', 'android-release.env')

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return {}
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const index = line.indexOf('=')
        return index === -1 ? [line, ''] : [line.slice(0, index), line.slice(index + 1)]
      })
  )
}

function readJavaMajor(javaHome) {
  try {
    const javaBin = process.platform === 'win32'
      ? path.join(javaHome, 'bin', 'java.exe')
      : path.join(javaHome, 'bin', 'java')

    if (!fs.existsSync(javaBin)) return null

    const result = spawnSync(javaBin, ['-version'], {
      encoding: 'utf8',
    })
    const versionText = `${result.stdout || ''}\n${result.stderr || ''}`
    const match = versionText.match(/version "(\d+)(?:\.(\d+))?/)
    if (!match) return null
    return Number(match[1] === '1' ? match[2] : match[1])
  } catch (error) {
    const text = String(error.stderr || error.stdout || error.message || '')
    const match = text.match(/version "(\d+)(?:\.(\d+))?/)
    if (!match) return null
    return Number(match[1] === '1' ? match[2] : match[1])
  }
}

function hasJavaCompiler(javaHome) {
  const javacBin = process.platform === 'win32'
    ? path.join(javaHome, 'bin', 'javac.exe')
    : path.join(javaHome, 'bin', 'javac')
  return fs.existsSync(javacBin)
}

function listJvmCandidates() {
  const candidates = []
  if (process.env.JAVA_HOME) candidates.push(process.env.JAVA_HOME)

  candidates.push(path.join(rootDir, '.local-jdk21', 'usr', 'lib', 'jvm', 'java-21-openjdk-amd64'))

  if (process.platform !== 'win32') {
    const jvmDir = '/usr/lib/jvm'
    for (const preferred of [
      'java-21-openjdk-amd64',
      'java-1.21.0-openjdk-amd64',
      'java-17-openjdk-amd64',
      'java-1.17.0-openjdk-amd64',
    ]) {
      candidates.push(path.join(jvmDir, preferred))
    }

    if (fs.existsSync(jvmDir)) {
      for (const entry of fs.readdirSync(jvmDir)) {
        if (/java-(21|17).*openjdk/.test(entry)) {
          candidates.push(path.join(jvmDir, entry))
        }
      }
    }
  }

  return [...new Set(candidates)]
}

function selectJavaHome() {
  for (const candidate of listJvmCandidates()) {
    const major = readJavaMajor(candidate)
    if (major && major >= 17 && major <= 24 && hasJavaCompiler(candidate)) {
      return candidate
    }
  }
  return process.env.JAVA_HOME || ''
}

const javaHome = selectJavaHome()
const env = { ...process.env, ...loadEnvFile(signingEnvPath) }
if (javaHome) {
  env.JAVA_HOME = javaHome
  env.PATH = `${path.join(javaHome, 'bin')}${path.delimiter}${env.PATH || ''}`
  console.log(`Using JAVA_HOME=${javaHome}`)
}

const gradleCommand = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'
const result = spawnSync(gradleCommand, [task], {
  cwd: androidDir,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

const status = result.status ?? 1
if (status === 0 && (task === 'assembleDebug' || task === 'assembleRelease' || task === 'bundleRelease')) {
  const isBundle = task === 'bundleRelease'
  const sourceArtifact = task === 'assembleDebug'
    ? (function() {
        const preferred = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'ZetassPOS.apk')
        const fallback = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
        return fs.existsSync(preferred) ? preferred : fallback
      })()
    : task === 'assembleRelease'
      ? (function() {
          const preferred = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'ZetassPOS.apk')
          const fallback = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
          return fs.existsSync(preferred) ? preferred : fallback
        })()
      : (function() {
          const preferred = path.join(androidDir, 'app', 'build', 'outputs', 'bundle', 'release', 'ZetassPOS.aab')
          const fallback = path.join(androidDir, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab')
          return fs.existsSync(preferred) ? preferred : fallback
        })()
  if (fs.existsSync(sourceArtifact)) {
    fs.mkdirSync(releaseDir, { recursive: true })
    for (const entry of fs.readdirSync(releaseDir)) {
      const isSameArtifactType = isBundle
        ? (/^WariPOS.*\.aab$/i.test(entry) || entry === releaseAabName)
        : (/^WariPOS.*\.apk$/i.test(entry) || entry === releaseApkName)
      if (isSameArtifactType) {
        fs.rmSync(path.join(releaseDir, entry), { force: true })
      }
    }
    const releaseArtifact = path.join(releaseDir, isBundle ? releaseAabName : releaseApkName)
    fs.copyFileSync(sourceArtifact, releaseArtifact)
    console.log(`Copied Android ${isBundle ? 'AAB' : 'APK'} to ${path.relative(rootDir, releaseArtifact)}`)
  }
}

process.exit(status)
