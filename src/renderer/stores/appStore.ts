import { useSyncExternalStore } from 'react'

export type PosMode = 'retail' | 'restaurant'

export interface AppStoreState {
  sidebarCollapsed: boolean
  lastRoute: string
  activeShiftId: number | null
  pajakPersen: number
  posMode: PosMode
}

const STORAGE_KEY = 'waripos-app-storage'

function loadInitialState(): AppStoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('zetass-app-storage')
    if (raw) {
      const parsed = JSON.parse(raw)
      const data = parsed.state || parsed
      return {
        sidebarCollapsed: Boolean(data.sidebarCollapsed),
        lastRoute: String(data.lastRoute || '/'),
        activeShiftId: typeof data.activeShiftId === 'number' ? data.activeShiftId : null,
        pajakPersen: Number(data.pajakPersen || 0),
        posMode: data.posMode === 'restaurant' ? 'restaurant' : 'retail',
      }
    }
  } catch {}
  return {
    sidebarCollapsed: false,
    lastRoute: '/',
    activeShiftId: null,
    pajakPersen: 0,
    posMode: 'retail',
  }
}

let currentState: AppStoreState = loadInitialState()
const listeners = new Set<() => void>()

function emitChange() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: currentState }))
  } catch {}
  listeners.forEach((listener) => listener())
}

export function useAppStore() {
  const state = useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange)
      return () => {
        listeners.delete(onStoreChange)
      }
    },
    () => currentState,
    () => currentState
  )

  return {
    ...state,
    setSidebarCollapsed: (collapsed: boolean) => {
      currentState = { ...currentState, sidebarCollapsed: collapsed }
      emitChange()
    },
    setLastRoute: (route: string) => {
      currentState = { ...currentState, lastRoute: route }
      emitChange()
    },
    setActiveShiftId: (id: number | null) => {
      currentState = { ...currentState, activeShiftId: id }
      emitChange()
    },
    setPajakPersen: (rate: number) => {
      currentState = { ...currentState, pajakPersen: rate }
      emitChange()
    },
    setPosMode: (posMode: PosMode) => {
      currentState = { ...currentState, posMode }
      emitChange()
    },
  }
}
