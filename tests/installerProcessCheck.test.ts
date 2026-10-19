// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { spawnSync } from 'child_process'
import path from 'path'

// Runs the PowerShell process filter from build/installer.nsh against mocked Windows
// process lists, so the "only touch processes inside the install dir" rule is checked.
const nsh = readFileSync(path.resolve(__dirname, '../build/installer.nsh'), 'utf8')

function extractScript() {
  const match = nsh.match(/!define WARIPOS_PS_SCRIPT "([\s\S]*?)"\n/)
  if (!match) throw new Error('WARIPOS_PS_SCRIPT not found in build/installer.nsh')
  return match[1]
    .replace(/\\\n/g, '')
    .replace(/\$\$/g, '$')
    .replace(/\$\{APP_EXECUTABLE_FILENAME\}/g, 'WariPOS.exe')
}

const hasPwsh = spawnSync('pwsh', ['-NoProfile', '-Command', 'exit 0']).status === 0

type FakeProc = { ProcessId: number; Name: string; SessionId: number; ExecutablePath: string | null }

function runCheck(action: 'list' | 'close' | 'kill', dirs: string, procs: FakeProc[]) {
  const procLiteral = procs
    .map(p => `[pscustomobject]@{ProcessId=${p.ProcessId};Name='${p.Name}';SessionId=${p.SessionId};ExecutablePath=${p.ExecutablePath === null ? '$null' : `'${p.ExecutablePath}'`}}`)
    .join(',')
  const mocks = `
$global:closed=@(); $global:killed=@()
function Get-CimInstance { @(${procLiteral}) }
function Get-Process { param($Id) $o=[pscustomobject]@{Id=$Id;SessionId=1}; $o | Add-Member -MemberType ScriptMethod -Name CloseMainWindow -Value { $global:closed += $this.Id; $true }; $o }
function Stop-Process { param($Id,[switch]$Force) $global:killed += $Id }
`
  const tail = `\n[Console]::Out.Write("\`nCLOSED:" + ($global:closed -join ',') + "\`nKILLED:" + ($global:killed -join ','))`
  const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', mocks + extractScript() + tail], {
    env: { ...process.env, WARIPOS_DIRS: dirs, WARIPOS_ACTION: action },
    encoding: 'utf8',
  })
  const [count, closed, killed] = result.stdout.split('\n')
  return {
    count,
    closed: closed.replace('CLOSED:', '').split(',').filter(Boolean).map(Number),
    killed: killed.replace('KILLED:', '').split(',').filter(Boolean).map(Number),
  }
}

const INSTDIR = 'C:\\Users\\kasir\\AppData\\Local\\Programs\\WariPOS'

const processes: FakeProc[] = [
  { ProcessId: 10, Name: 'WariPOS.exe', SessionId: 1, ExecutablePath: `${INSTDIR}\\WariPOS.exe` },
  { ProcessId: 11, Name: 'WariPOS.exe', SessionId: 1, ExecutablePath: `${INSTDIR.toUpperCase()}\\WARIPOS.EXE` },
  { ProcessId: 20, Name: 'WariPOS.exe', SessionId: 1, ExecutablePath: 'C:\\Users\\kasir\\AppData\\Local\\Temp\\portable\\WariPOS.exe' },
  { ProcessId: 21, Name: 'WariPOS.exe', SessionId: 1, ExecutablePath: `${INSTDIR}-Backup\\WariPOS.exe` },
  { ProcessId: 30, Name: 'WariPOS.exe', SessionId: 2, ExecutablePath: `${INSTDIR}\\WariPOS.exe` },
  { ProcessId: 40, Name: 'notepad.exe', SessionId: 1, ExecutablePath: `${INSTDIR}\\notepad.exe` },
  { ProcessId: 50, Name: 'WariPOS.exe', SessionId: 1, ExecutablePath: null },
]

describe.skipIf(!hasPwsh)('installer WariPOS process check', () => {
  it('counts own and unreadable-path processes in the current session', () => {
    expect(runCheck('list', INSTDIR, processes).count).toBe('WARIPOS:3')
  })

  it('reports zero when the app is already closed', () => {
    expect(runCheck('list', INSTDIR, processes.filter(p => p.ProcessId !== 10 && p.ProcessId !== 11 && p.ProcessId !== 50)).count).toBe('WARIPOS:0')
  })

  it('force-kills only processes running from the install directory', () => {
    const result = runCheck('kill', `${INSTDIR}\\`, processes)
    expect(result.killed).toEqual([10, 11])
  })

  it('closes gracefully only processes running from the install directory', () => {
    expect(runCheck('close', INSTDIR, processes).closed).toEqual([10, 11])
  })

  it('also matches the previous install location from the registry', () => {
    const oldDir = 'C:\\Program Files\\WariPOS'
    const procs: FakeProc[] = [{ ProcessId: 60, Name: 'WariPOS.exe', SessionId: 1, ExecutablePath: `${oldDir}\\WariPOS.exe` }]
    expect(runCheck('kill', `${INSTDIR}|${oldDir}`, procs).killed).toEqual([60])
    expect(runCheck('kill', INSTDIR, procs).killed).toEqual([])
  })
})

describe('installer NSIS script', () => {
  it('overrides the stock check instead of disabling it', () => {
    expect(nsh).toMatch(/!macro customCheckAppRunning/)
    expect(nsh).toMatch(/MB_RETRYCANCEL/)
  })

  it('never force-kills by image name in the fallback path', () => {
    const fallback = nsh.slice(nsh.indexOf('waripos_fallback:'))
    expect(fallback).not.toMatch(/taskkill[^\n]*\/F\b/i)
  })
})
