import kachingSoundUrl from '../assets/sounds/cashier-ka-ching.mp3'
import productClickSoundUrl from '../assets/sounds/product-click.mp3'
import dangerWarningSoundUrl from '../assets/sounds/danger-warning.mp3'

/**
 * Cashier sound player with support for authentic MP3 sound effects:
 * - "ka-ching" cashier drawer & bell on transaction success
 * - "pen-click" tactile mechanical sound on product selection / click in POS
 * - "danger / warning" siren alert for destructive actions in Settings
 * With robust Web Audio API fallback for zero-dependency operation.
 */
class CashierSoundPlayer {
  private ctx: AudioContext | null = null
  private kachingAudio: HTMLAudioElement | null = null
  private productClickAudio: HTMLAudioElement | null = null
  private dangerAudio: HTMLAudioElement | null = null

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  private getKachingAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return null
    if (!this.kachingAudio) {
      try {
        const audio = new Audio(kachingSoundUrl)
        audio.preload = 'auto'
        audio.onerror = () => {
          if (audio.src !== window.location.origin + '/sounds/cashier-ka-ching.mp3') {
            audio.src = './sounds/cashier-ka-ching.mp3'
            audio.load()
          }
        }
        this.kachingAudio = audio
      } catch {
        return null
      }
    }
    return this.kachingAudio
  }

  private getProductClickAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return null
    if (!this.productClickAudio) {
      try {
        const audio = new Audio(productClickSoundUrl)
        audio.preload = 'auto'
        audio.onerror = () => {
          if (audio.src !== window.location.origin + '/sounds/product-click.mp3') {
            audio.src = './sounds/product-click.mp3'
            audio.load()
          }
        }
        this.productClickAudio = audio
      } catch {
        return null
      }
    }
    return this.productClickAudio
  }

  private getDangerAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return null
    if (!this.dangerAudio) {
      try {
        const audio = new Audio(dangerWarningSoundUrl)
        audio.preload = 'auto'
        audio.onerror = () => {
          if (audio.src !== window.location.origin + '/sounds/danger-warning.mp3') {
            audio.src = './sounds/danger-warning.mp3'
            audio.load()
          }
        }
        this.dangerAudio = audio
      } catch {
        return null
      }
    }
    return this.dangerAudio
  }

  /**
   * Tactile pen click sound on product click / add to cart in cashier.
   * Plays the custom pen-click MP3 sound effect with fallback to scan beep.
   */
  playProductClick() {
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      try {
        const audio = this.getProductClickAudio()
        if (audio) {
          audio.currentTime = 0
          const playPromise = audio.play()
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              this.playScanBeep()
            })
          }
          return
        }
      } catch {
        // Fallback
      }
    }
    this.playScanBeep()
  }

  /** Short crisp barcode beep (1400Hz) */
  playScanBeep() {
    try {
      const ctx = this.getContext()
      if (!ctx) return
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(1400, ctx.currentTime)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.08)
    } catch {
      // Ignore audio context errors
    }
  }

  /**
   * Play authentic cash register 'CKRINGG' / 'ka-ching' sound on transaction success.
   * Plays the custom cashier ka-ching MP3 sound effect with fallback to Web Audio synthesis.
   */
  playSuccessChime() {
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      try {
        const audio = this.getKachingAudio()
        if (audio) {
          audio.currentTime = 0
          const playPromise = audio.play()
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              // Browser autoplay policy or playback error -> fall back to Web Audio synthesis
              this.playSuccessSynthesized()
            })
          }
          return
        }
      } catch {
        // Fallback
      }
    }
    this.playSuccessSynthesized()
  }

  /**
   * Synthesized fallback chime using Web Audio API in case audio element is unavailable.
   */
  playSuccessSynthesized() {
    try {
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime

      // 1. Primary cash drawer bell strike (1318Hz + 2637Hz harmonic)
      const oscBell1 = ctx.createOscillator()
      const gainBell1 = ctx.createGain()
      oscBell1.type = 'triangle'
      oscBell1.frequency.setValueAtTime(1318.51, now) // E6
      gainBell1.gain.setValueAtTime(0.35, now)
      gainBell1.gain.exponentialRampToValueAtTime(0.001, now + 0.55)
      oscBell1.connect(gainBell1)
      gainBell1.connect(ctx.destination)
      oscBell1.start(now)
      oscBell1.stop(now + 0.55)

      const oscBell2 = ctx.createOscillator()
      const gainBell2 = ctx.createGain()
      oscBell2.type = 'sine'
      oscBell2.frequency.setValueAtTime(2637.02, now) // E7 high shimmer
      gainBell2.gain.setValueAtTime(0.20, now)
      gainBell2.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
      oscBell2.connect(gainBell2)
      gainBell2.connect(ctx.destination)
      oscBell2.start(now)
      oscBell2.stop(now + 0.45)

      // 2. Cascade coin clink 1 ('cha-') at 60ms (1760Hz)
      const oscCoin1 = ctx.createOscillator()
      const gainCoin1 = ctx.createGain()
      oscCoin1.type = 'square'
      oscCoin1.frequency.setValueAtTime(1760, now + 0.06) // A6
      gainCoin1.gain.setValueAtTime(0.15, now + 0.06)
      gainCoin1.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
      oscCoin1.connect(gainCoin1)
      gainCoin1.connect(ctx.destination)
      oscCoin1.start(now + 0.06)
      oscCoin1.stop(now + 0.22)

      // 3. Cascade coin clink 2 ('-ching!') at 110ms (3135Hz)
      const oscCoin2 = ctx.createOscillator()
      const gainCoin2 = ctx.createGain()
      oscCoin2.type = 'sine'
      oscCoin2.frequency.setValueAtTime(3135.96, now + 0.11) // G7
      gainCoin2.gain.setValueAtTime(0.28, now + 0.11)
      gainCoin2.gain.exponentialRampToValueAtTime(0.001, now + 0.48)
      oscCoin2.connect(gainCoin2)
      gainCoin2.connect(ctx.destination)
      oscCoin2.start(now + 0.11)
      oscCoin2.stop(now + 0.48)
    } catch {
      // Ignore audio context errors
    }
  }

  /** Warning double buzz for error / insufficient cash / out of stock */
  playErrorBuzz() {
    try {
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(220, now)
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.18)
    } catch {
      // Ignore audio context errors
    }
  }

  /** Urgent dual-tone alert siren for destructive actions (e.g. Factory Reset) */
  playAlarmSiren() {
    try {
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime

      // Tone 1: High warning beep (880Hz)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'square'
      osc1.frequency.setValueAtTime(880, now)
      gain1.gain.setValueAtTime(0.25, now)
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.14)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.14)

      // Tone 2: Low danger drop (440Hz)
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sawtooth'
      osc2.frequency.setValueAtTime(440, now + 0.14)
      gain2.gain.setValueAtTime(0.3, now + 0.14)
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.32)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now + 0.14)
      osc2.stop(now + 0.32)

      // Tone 3: High confirmation pulse (987Hz)
      const osc3 = ctx.createOscillator()
      const gain3 = ctx.createGain()
      osc3.type = 'square'
      osc3.frequency.setValueAtTime(987, now + 0.32)
      gain3.gain.setValueAtTime(0.25, now + 0.32)
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.50)
      osc3.connect(gain3)
      gain3.connect(ctx.destination)
      osc3.start(now + 0.32)
      osc3.stop(now + 0.50)
    } catch {
      // Ignore audio context errors
    }
  }

  /** Urgent 4-pulse buzzer alarm for reset / danger actions ('tet tettt tett tett') */
  playTetTetAlarm() {
    try {
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime

      // 4-pulse buzzer pattern:
      // Pulse 1: Short (850Hz, 70ms)
      // Pulse 2: Long (850Hz, 140ms)
      // Pulse 3: Short (850Hz, 70ms)
      // Pulse 4: Long (850Hz, 150ms)
      const pulses = [
        { start: 0, dur: 0.08, freq: 880 },
        { start: 0.12, dur: 0.16, freq: 850 },
        { start: 0.32, dur: 0.08, freq: 880 },
        { start: 0.44, dur: 0.18, freq: 820 },
      ]

      pulses.forEach(p => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(p.freq, now + p.start)
        gain.gain.setValueAtTime(0.28, now + p.start)
        gain.gain.exponentialRampToValueAtTime(0.001, now + p.start + p.dur)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + p.start)
        osc.stop(now + p.start + p.dur)
      })
    } catch {
      // Ignore audio context errors
    }
  }

  /**
   * Play warning/danger alert sound (e.g. factory reset, destructive operations in Settings).
   * Plays the custom warning MP3 sound effect with fallback to 4-pulse buzzer synthesis.
   */
  playDangerSound() {
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      try {
        const audio = this.getDangerAudio()
        if (audio) {
          audio.currentTime = 0
          const playPromise = audio.play()
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              this.playTetTetAlarm()
            })
          }
          return
        }
      } catch {
        // Fallback
      }
    }
    this.playTetTetAlarm()
  }

  playWarningSound() {
    this.playDangerSound()
  }
}

export const cashierSound = new CashierSoundPlayer()

export function playProductClickSound() {
  cashierSound.playProductClick()
}

export function playDangerSound() {
  cashierSound.playDangerSound()
}

export function playWarningSound() {
  cashierSound.playWarningSound()
}

export function playTetTetAlarm() {
  cashierSound.playTetTetAlarm()
}

export function playSuccessSound() {
  cashierSound.playSuccessChime()
}

