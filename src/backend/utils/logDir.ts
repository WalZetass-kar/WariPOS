import { app } from 'electron'
import path from 'path'

// Packaged builds must not write next to the executable: cwd is the install dir, which
// can be read-only (Program Files) and is wiped by the installer on every update.
export function resolveLogDir(): string {
  return app?.isPackaged
    ? path.join(app.getPath('userData'), 'logs')
    : path.join(process.cwd(), 'logs')
}
