import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { secureStorage } from '../utils/secureStorage'

export type ThemeColor = 'indigo' | 'emerald' | 'rose' | 'amber' | 'sky' | 'pink' | 'violet' | 'teal' | 'cyan' | 'orange' | string
export type ThemeMode = 'light' | 'dark'

interface ThemeContextValue {
  color: ThemeColor
  mode: ThemeMode
  setColor: (c: ThemeColor) => void
  setMode: (m: ThemeMode) => void
  toggleMode: () => void
}

const PRESETS = ['indigo', 'emerald', 'rose', 'amber', 'sky', 'pink', 'violet', 'teal', 'cyan', 'orange']

const ThemeContext = createContext<ThemeContextValue | null>(null)

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result 
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '236, 72, 153'
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
      return (localStorage.getItem('theme-color') || secureStorage.getItem('theme-color') as ThemeColor) || 'pink'
    } catch {
      return 'pink'
    }
  })

  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem('theme-mode') || secureStorage.getItem('theme-mode') as ThemeMode | null
      if (stored === 'light' || stored === 'dark') return stored
    } catch {}
    return 'light'
  })

  useEffect(() => {
    if (PRESETS.includes(color)) {
      document.documentElement.setAttribute('data-theme', color)
      // Reset inline styles if moving back to preset
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
      localStorage.setItem('theme-color', color)
    } catch {}
    try {
      secureStorage.setItem('theme-color', color)
    } catch {}
  }, [color])

  useEffect(() => {
    const isDark = mode === 'dark'
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    try {
      localStorage.setItem('theme-mode', mode)
    } catch {}
    try {
      secureStorage.setItem('theme-mode', mode)
    } catch {}
  }, [mode])

  const setColor = (c: ThemeColor) => setColorState(c)
  const setMode = (m: ThemeMode) => setModeState(m)
  const toggleMode = () => setModeState(m => (m === 'light' ? 'dark' : 'light'))

  return (
    <ThemeContext.Provider value={{ color, mode, setColor, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
