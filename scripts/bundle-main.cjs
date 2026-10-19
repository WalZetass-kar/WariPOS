const esbuild = require('esbuild');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

console.log('[bundle-main] Bundling Electron main process with esbuild...');

esbuild.buildSync({
  entryPoints: [path.join(rootDir, 'src/main/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: path.join(rootDir, 'dist-electron/main/index.js'),
  external: [
    'electron',
    'better-sqlite3',
    'bindings',
    'file-uri-to-path',
  ],
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'module';",
      "import { fileURLToPath as __fileURLToPath } from 'url';",
      "import __nodePath from 'path';",
      "var require = __createRequire(import.meta.url);",
      "var __filename = __fileURLToPath(import.meta.url);",
      "var __dirname = __nodePath.dirname(__filename);",
    ].join('\n'),
  },
  sourcemap: false,
  minify: false,
});

console.log('[bundle-main] Successfully bundled Electron main process to dist-electron/main/index.js');
