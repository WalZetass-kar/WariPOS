import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'

export type ThemeColor =
  | 'crimson'
  | 'indigo'
  | 'emerald'
  | 'blue'
  | 'rose'
  | 'amber'
  | 'sky'
  | 'pink'
  | 'violet'
  | 'purple'
  | 'teal'
  | 'cyan'
  | 'orange'
  | 'green'
  | 'slate'
  | 'coffee'
  | 'gold'
  | string

export type ThemeMode = 'light' | 'dark' | 'system' | 'auto'
export type FontSize = 'compact' | 'normal' | 'large'
export type BorderRadius = 'sharp' | 'medium' | 'rounded'

export interface ThemeContextValue {
  color: ThemeColor
  mode: ThemeMode
  resolvedMode: 'light' | 'dark'
  isDark: boolean
  fontSize: FontSize
  borderRadius: BorderRadius
  autoScheduleEnabled: boolean
  autoScheduleStart: number // Hour (0-23), default 18 (6 PM)
  autoScheduleEnd: number // Hour (0-23), default 6 (6 AM)
  isThemeTransitioning: boolean
  setColor: (c: ThemeColor) => void
  setMode: (m: ThemeMode) => void
  toggleMode: () => void
  setFontSize: (f: FontSize) => void
  setBorderRadius: (r: BorderRadius) => void
  setAutoSchedule: (enabled: boolean, start?: number, end?: number) => void
}

export const PRESETS: ThemeColor[] = [
  'crimson',
  'indigo',
  'emerald',
  'blue',
  'rose',
  'amber',
  'sky',
  'pink',
  'violet',
  'purple',
  'teal',
  'cyan',
  'orange',
  'green',
  'slate',
  'coffee',
  'gold',
]

const ThemeContext = createContext<ThemeContextValue | null>(null)

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '220, 38, 38'
}

function mixHex(hex: string, target: string, amount: number): string {
  const parse = (h: string) => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h)
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0]
  }
  const [r1, g1, b1] = parse(hex)
  const [r2, g2, b2] = parse(target)
  const r = Math.round(r1 + (r2 - r1) * amount)
  const g = Math.round(g1 + (g2 - g1) * amount)
  const b = Math.round(b1 + (b2 - b1) * amount)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function generateCustomShades(hex: string) {
  return {
    '50': mixHex(hex, '#ffffff', 0.92),
    '100': mixHex(hex, '#ffffff', 0.82),
    '200': mixHex(hex, '#ffffff', 0.62),
    '300': mixHex(hex, '#ffffff', 0.40),
    '400': mixHex(hex, '#ffffff', 0.18),
    '500': hex,
    '600': mixHex(hex, '#000000', 0.15),
    '700': mixHex(hex, '#000000', 0.28),
    '800': mixHex(hex, '#000000', 0.40),
    '900': mixHex(hex, '#000000', 0.52),
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const transitionInProgress = useRef(false)
  const [isThemeTransitioning, setIsThemeTransitioning] = useState(false)
  const [color, setColorState] = useState<ThemeColor>(() => {
    try {
      return (
        localStorage.getItem('waripos_theme_color') ||
        localStorage.getItem('theme-color') ||
        'crimson'
      )
    } catch {
      return 'crimson'
    }
  })

  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      const stored = (
        localStorage.getItem('theme') ||
        localStorage.getItem('waripos_theme_mode') ||
        localStorage.getItem('theme-mode')
      ) as ThemeMode | null
      if (stored === 'light' || stored === 'dark' || stored === 'system' || stored === 'auto') return stored
    } catch {}
    return 'system'
  })

  const [autoScheduleEnabled, setAutoScheduleEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('waripos_auto_schedule') === 'true'
    } catch {}
    return false
  })

  const [autoScheduleStart, setAutoScheduleStart] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('waripos_auto_schedule_start')
      return stored ? parseInt(stored, 10) : 18 // 6 PM default
    } catch {}
    return 18
  })

  const [autoScheduleEnd, setAutoScheduleEnd] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('waripos_auto_schedule_end')
      return stored ? parseInt(stored, 10) : 6 // 6 AM default
    } catch {}
    return 6
  })

  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    try {
      const stored = localStorage.getItem('waripos_font_size') as FontSize | null
      if (stored === 'compact' || stored === 'normal' || stored === 'large') return stored
    } catch {}
    return 'normal'
  })

  const [borderRadius, setBorderRadiusState] = useState<BorderRadius>(() => {
    try {
      const stored = localStorage.getItem('waripos_border_radius') as BorderRadius | null
      if (stored === 'sharp' || stored === 'medium' || stored === 'rounded') return stored
    } catch {}
    return 'rounded'
  })

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  // Watch system color scheme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Listen to external theme events (from AI Assistant or other components)
  useEffect(() => {
    const handleCustomThemeChange = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail) return
      if (detail.color) setColorState(detail.color)
      if (detail.mode) setModeState(detail.mode)
      if (detail.fontSize) setFontSizeState(detail.fontSize)
      if (detail.borderRadius) setBorderRadiusState(detail.borderRadius)
    }
    window.addEventListener('waripos:change-theme', handleCustomThemeChange)
    return () => window.removeEventListener('waripos:change-theme', handleCustomThemeChange)
  }, [])

  // Color application & persistence
  useEffect(() => {
    if (PRESETS.includes(color)) {
      document.documentElement.setAttribute('data-theme', color)
      // Reset inline styles
      document.documentElement.style.removeProperty('--color-primary-50')
      document.documentElement.style.removeProperty('--color-primary-100')
      document.documentElement.style.removeProperty('--color-primary-200')
      document.documentElement.style.removeProperty('--color-primary-300')
      document.documentElement.style.removeProperty('--color-primary-400')
      document.documentElement.style.removeProperty('--color-primary-500')
      document.documentElement.style.removeProperty('--color-primary-600')
      document.documentElement.style.removeProperty('--color-primary-700')
      document.documentElement.style.removeProperty('--color-primary-800')
      document.documentElement.style.removeProperty('--color-primary-900')
      document.documentElement.style.removeProperty('--glass-shadow-rgb')
      document.documentElement.style.removeProperty('--chart-bar-color')
    } else if (color.startsWith('#')) {
      document.documentElement.setAttribute('data-theme', 'custom')
      const rgb = hexToRgb(color)
      const shades = generateCustomShades(color)
      document.documentElement.style.setProperty('--color-primary-50', shades['50'])
      document.documentElement.style.setProperty('--color-primary-100', shades['100'])
      document.documentElement.style.setProperty('--color-primary-200', shades['200'])
      document.documentElement.style.setProperty('--color-primary-300', shades['300'])
      document.documentElement.style.setProperty('--color-primary-400', shades['400'])
      document.documentElement.style.setProperty('--color-primary-500', shades['500'])
      document.documentElement.style.setProperty('--color-primary-600', shades['600'])
      document.documentElement.style.setProperty('--color-primary-700', shades['700'])
      document.documentElement.style.setProperty('--color-primary-800', shades['800'])
      document.documentElement.style.setProperty('--color-primary-900', shades['900'])
      document.documentElement.style.setProperty('--glass-shadow-rgb', rgb)
      document.documentElement.style.setProperty('--chart-bar-color', color)
    }

    try {
      localStorage.setItem('waripos_theme_color', color)
      localStorage.setItem('theme-color', color)
    } catch {}
  }, [color])

  // Resolved mode calculation with auto-schedule support
  const [autoScheduleDark, setAutoScheduleDark] = useState<boolean>(false)

  // Check if current time is within dark mode schedule
  useEffect(() => {
    if (!autoScheduleEnabled || mode !== 'auto') return

    const checkSchedule = () => {
      const now = new Date()
      const currentHour = now.getHours()
      
      // Handle wrap-around (e.g., 18:00 to 06:00)
      const isInDarkPeriod = autoScheduleStart > autoScheduleEnd
        ? currentHour >= autoScheduleStart || currentHour < autoScheduleEnd
        : currentHour >= autoScheduleStart && currentHour < autoScheduleEnd
      
      setAutoScheduleDark(isInDarkPeriod)
    }

    checkSchedule()
    const interval = setInterval(checkSchedule, 60000) // Check every minute
    
    return () => clearInterval(interval)
  }, [autoScheduleEnabled, autoScheduleStart, autoScheduleEnd, mode])

  const resolvedMode: 'light' | 'dark' = 
    mode === 'auto' 
      ? (autoScheduleDark ? 'dark' : 'light')
      : mode === 'system' 
      ? (systemIsDark ? 'dark' : 'light') 
      : mode
  const isDark = resolvedMode === 'dark'

  // Mode application & persistence
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    try {
      localStorage.setItem('theme', mode)
      localStorage.setItem('waripos_theme_mode', mode)
      localStorage.setItem('theme-mode', mode)
    } catch {}
  }, [mode, isDark])

  // Font size application & persistence
  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize)
    try {
      localStorage.setItem('waripos_font_size', fontSize)
    } catch {}
  }, [fontSize])

  // Border radius application & persistence
  useEffect(() => {
    document.documentElement.setAttribute('data-radius', borderRadius)
    try {
      localStorage.setItem('waripos_border_radius', borderRadius)
    } catch {}
  }, [borderRadius])

  const setColor = (c: ThemeColor) => setColorState(c)

  const changeExplicitMode = (nextMode: 'light' | 'dark') => {
    if (transitionInProgress.current) return
    transitionInProgress.current = true

    const root = document.documentElement
    // Ratusan elemen memakai transition-colors; mematikannya selama ganti tema
    // menghindari recalc style per frame di atas animasi reveal.
    root.classList.add('theme-switching')
    const done = () => {
      root.classList.remove('theme-switching')
      transitionInProgress.current = false
      setIsThemeTransitioning(false)
    }

    const switchTheme = () => {
      // A View Transition snapshots immediately after its callback. Flush the
      // React update and root class together so the new snapshot is dark/light.
      // Mode and the transitioning flag land in one render instead of two.
      flushSync(() => {
        setModeState(nextMode)
        setIsThemeTransitioning(true)
      })
      root.classList.toggle('dark', nextMode === 'dark')
      try {
        localStorage.setItem('theme', nextMode)
      } catch {}
    }

    if (!document.startViewTransition) {
      switchTheme()
      requestAnimationFrame(done)
      return
    }

    try {
      const transition = document.startViewTransition(switchTheme)
      void transition.finished.catch(() => undefined).finally(done)
    } catch {
      switchTheme()
      requestAnimationFrame(done)
    }
  }

  const setMode = (nextMode: ThemeMode) => {
    if (nextMode === 'light' || nextMode === 'dark') {
      changeExplicitMode(nextMode)
      return
    }
    setModeState(nextMode)
  }

  const toggleMode = () => changeExplicitMode(isDark ? 'light' : 'dark')
  
  const setFontSize = (f: FontSize) => setFontSizeState(f)
  const setBorderRadius = (r: BorderRadius) => setBorderRadiusState(r)
  const setAutoSchedule = (enabled: boolean, start?: number, end?: number) => {
    setAutoScheduleEnabled(enabled)
    if (start !== undefined) setAutoScheduleStart(start)
    if (end !== undefined) setAutoScheduleEnd(end)
    
    try {
      localStorage.setItem('waripos_auto_schedule', enabled ? 'true' : 'false')
      if (start !== undefined) localStorage.setItem('waripos_auto_schedule_start', String(start))
      if (end !== undefined) localStorage.setItem('waripos_auto_schedule_end', String(end))
    } catch {}
    
    // If enabling auto mode, switch to 'auto' mode
    if (enabled) {
      setModeState('auto')
    }
  }

  return (
    <ThemeContext.Provider
      value={{
        color,
        mode,
        resolvedMode,
        isDark,
        fontSize,
        borderRadius,
        autoScheduleEnabled,
        autoScheduleStart,
        autoScheduleEnd,
        isThemeTransitioning,
        setColor,
        setMode,
        toggleMode,
        setFontSize,
        setBorderRadius,
        setAutoSchedule,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
