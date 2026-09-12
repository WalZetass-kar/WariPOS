const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'))
const version = pkg.version
const versionCode = version.split('.').reduce((acc, v, i) => acc + parseInt(v, 10) * Math.pow(10, (2 - i) * 2), 0)

console.log(`Syncing version: ${version} (versionCode: ${versionCode})`)

// Sync capacitor.config.ts
const capacitorConfigPath = path.join(rootDir, 'capacitor.config.ts')
if (fs.existsSync(capacitorConfigPath)) {
  let content = fs.readFileSync(capacitorConfigPath, 'utf8')
  content = content.replace(
    /appName:\s*['"][^'"]*['"]/,
    `appName: 'WariPOS'`
  )
  fs.writeFileSync(capacitorConfigPath, content)
  console.log('Synced capacitor.config.ts')
}

// Sync android versionCode and versionName
const androidBuildGradlePath = path.join(rootDir, 'android', 'app', 'build.gradle')
if (fs.existsSync(androidBuildGradlePath)) {
  let content = fs.readFileSync(androidBuildGradlePath, 'utf8')
  content = content.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  content = content.replace(/versionName\s+"[^"]*"/, `versionName "${version}"`)
  fs.writeFileSync(androidBuildGradlePath, content)
  console.log(`Synced android/app/build.gradle (versionCode: ${versionCode}, versionName: ${version})`)
}

// Sync iOS Info.plist if exists
const iosInfoPlistPath = path.join(rootDir, 'ios', 'App', 'App', 'Info.plist')
if (fs.existsSync(iosInfoPlistPath)) {
  let content = fs.readFileSync(iosInfoPlistPath, 'utf8')
  content = content.replace(
    /<key>CFBundleShortVersionString<\/key>\s*<string>[^<]*<\/string>/,
    `<key>CFBundleShortVersionString</key>\n\t<string>${version}</string>`
  )
  content = content.replace(
    /<key>CFBundleVersion<\/key>\s*<string>[^<]*<\/string>/,
    `<key>CFBundleVersion</key>\n\t<string>${versionCode}</string>`
  )
  fs.writeFileSync(iosInfoPlistPath, content)
  console.log('Synced iOS Info.plist')
}

console.log('Version sync complete.')
