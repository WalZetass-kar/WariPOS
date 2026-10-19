// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'

const app = { isPackaged: false, getPath: vi.fn((name: string) => `/user-data-for-${name}`) }
vi.mock('electron', () => ({ app }))

describe('resolveLogDir', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('writes logs to userData in packaged builds, never the install directory', async () => {
    app.isPackaged = true
    const { resolveLogDir } = await import('../src/backend/utils/logDir')
    expect(resolveLogDir()).toBe(path.join('/user-data-for-userData', 'logs'))
  })

  it('keeps the project logs folder during development', async () => {
    app.isPackaged = false
    const { resolveLogDir } = await import('../src/backend/utils/logDir')
    expect(resolveLogDir()).toBe(path.join(process.cwd(), 'logs'))
  })
})
