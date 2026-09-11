import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

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

export type ThemeMode = 'light' | 'dark' | 'system'
export type FontSize = 'compact' | 'normal' | 'large'
export type BorderRadius = 'sharp' | 'medium' | 'rounded'

export interface ThemeContextValue {
  color: ThemeColor
  mode: ThemeMode
  resolvedMode: 'light' | 'dark'
  isDark: boolean
  fontSize: FontSize
  borderRadius: BorderRadius
  setColor: (c: ThemeColor) => void
  setMode: (m: ThemeMode) => void
  toggleMode: () => void
  setFontSize: (f: FontSize) => void
  setBorderRadius: (r: BorderRadius) => void
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
        localStorage.getItem('waripos_theme_mode') ||
        localStorage.getItem('theme-mode')
      ) as ThemeMode | null
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
    } catch {}
    return 'system'
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

  // Resolved mode calculation
  const resolvedMode: 'light' | 'dark' = mode === 'system' ? (systemIsDark ? 'dark' : 'light') : mode
  const isDark = resolvedMode === 'dark'

  // Mode application & persistence
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    try {
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
  const setMode = (m: ThemeMode) => setModeState(m)
  const toggleMode = () => {
    setModeState(() => {
      return isDark ? 'light' : 'dark'
    })
  }
  const setFontSize = (f: FontSize) => setFontSizeState(f)
  const setBorderRadius = (r: BorderRadius) => setBorderRadiusState(r)

  return (
    <ThemeContext.Provider
      value={{
        color,
        mode,
        resolvedMode,
        isDark,
        fontSize,
        borderRadius,
        setColor,
        setMode,
        toggleMode,
        setFontSize,
        setBorderRadius,
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
