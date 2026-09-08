// ─── Queue Number & Calling Manager for WariPOS ─────────────────────────────

export interface QueueOrder {
  id: string
  nomor_antrian: number
  nomor_antrian_formatted: string // e.g. "A-001" or "#001"
  kd_transaksi?: string
  nomor_meja?: string | null
  nama_pelanggan?: string | null
  jenis_order?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | string
  status: 'PREPARING' | 'READY' | 'COMPLETED'
  waktu_masuk: string
  waktu_siap?: string
  waktu_panggil_terakhir?: string
}

export interface QueueDisplayState {
  storeName: string
  currentCalling: QueueOrder | null
  preparingList: QueueOrder[]
  readyList: QueueOrder[]
  lastCalledNumber: string | null
  runningText: string
  soundEnabled: boolean
  lastUpdated: number
}

const STORAGE_KEY_QUEUE_DATA = 'zetass_queue_display_state'
const STORAGE_KEY_DAILY_SEQ = 'zetass_daily_queue_seq'
const QUEUE_CHANNEL_NAME = 'queue_display_channel'

/**
 * Format raw integer into a nice 3-digit queue code (e.g. 1 -> "#001", or "A-001")
 */
export function formatQueueNumber(num: number, prefix = ''): string {
  const padded = String(num).padStart(3, '0')
  return prefix ? `${prefix}-${padded}` : `#${padded}`
}

/**
 * Get next daily queue sequence number (auto resets on date change)
 */
export function getNextDailyQueueNumber(): { seq: number; formatted: string } {
  try {
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const raw = localStorage.getItem(STORAGE_KEY_DAILY_SEQ)
    let currentData = { date: today, seq: 0 }

    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.date === today && typeof parsed.seq === 'number') {
        currentData = parsed
      }
    }

    currentData.seq += 1
    localStorage.setItem(STORAGE_KEY_DAILY_SEQ, JSON.stringify(currentData))

    return {
      seq: currentData.seq,
      formatted: formatQueueNumber(currentData.seq),
    }
  } catch {
    const fallbackSeq = Math.floor(Date.now() % 1000) || 1
    return {
      seq: fallbackSeq,
      formatted: formatQueueNumber(fallbackSeq),
    }
  }
}

/**
 * Get current daily queue sequence number without incrementing
 */
export function getCurrentDailyQueueNumber(): number {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const raw = localStorage.getItem(STORAGE_KEY_DAILY_SEQ)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.date === today && typeof parsed.seq === 'number') {
        return parsed.seq
      }
    }
  } catch {}
  return 0
}

/**
 * Reset daily queue sequence number
 */
export function resetDailyQueueSequence(): void {
  const today = new Date().toISOString().slice(0, 10)
  localStorage.setItem(STORAGE_KEY_DAILY_SEQ, JSON.stringify({ date: today, seq: 0 }))
  broadcastQueueState({
    currentCalling: null,
    preparingList: [],
    readyList: [],
    lastCalledNumber: null,
    lastUpdated: Date.now(),
  })
}

/**
 * Get saved Queue Display State
 */
export function getQueueDisplayState(): QueueDisplayState {
  const defaultState: QueueDisplayState = {
    storeName: 'WariPOS',
    currentCalling: null,
    preparingList: [],
    readyList: [],
    lastCalledNumber: null,
    runningText: 'Selamat Datang di Toko Kami · Harap Perhatikan Nomor Antrian Anda · Terima Kasih',
    soundEnabled: true,
    lastUpdated: Date.now(),
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_QUEUE_DATA)
    if (raw) {
      return { ...defaultState, ...JSON.parse(raw) }
    }
  } catch {}

  return defaultState
}

/**
 * Save and broadcast Queue State to all displays
 */
export function broadcastQueueState(partial: Partial<QueueDisplayState>): QueueDisplayState {
  const current = getQueueDisplayState()
  const updated: QueueDisplayState = {
    ...current,
    ...partial,
    lastUpdated: Date.now(),
  }

  try {
    localStorage.setItem(STORAGE_KEY_QUEUE_DATA, JSON.stringify(updated))
    const bc = new BroadcastChannel(QUEUE_CHANNEL_NAME)
    bc.postMessage(updated)
    bc.close()
  } catch {}

  return updated
}

/**
 * Add a new order to the Queue Display (status: PREPARING)
 */
export function addOrderToQueue(order: {
  nomor_antrian: number
  nomor_antrian_formatted?: string
  kd_transaksi?: string
  nomor_meja?: string | null
  nama_pelanggan?: string | null
  jenis_order?: string
}): QueueDisplayState {
  const current = getQueueDisplayState()
  const formatted = order.nomor_antrian_formatted || formatQueueNumber(order.nomor_antrian)

  const newOrder: QueueOrder = {
    id: `${order.nomor_antrian}-${Date.now()}`,
    nomor_antrian: order.nomor_antrian,
    nomor_antrian_formatted: formatted,
    kd_transaksi: order.kd_transaksi,
    nomor_meja: order.nomor_meja,
    nama_pelanggan: order.nama_pelanggan,
    jenis_order: order.jenis_order || 'DINE_IN',
    status: 'PREPARING',
    waktu_masuk: new Date().toISOString(),
  }

  // Avoid duplicates in preparing list
  const existingIdx = current.preparingList.findIndex(o => o.nomor_antrian === order.nomor_antrian)
  let newPreparing = [...current.preparingList]
  if (existingIdx >= 0) {
    newPreparing[existingIdx] = newOrder
  } else {
    newPreparing.push(newOrder)
  }

  // Keep max 20 preparing items
  if (newPreparing.length > 20) {
    newPreparing = newPreparing.slice(newPreparing.length - 20)
  }

  return broadcastQueueState({
    preparingList: newPreparing,
  })
}

/**
 * Set an order as READY and optionally trigger voice call
 */
export function setOrderReadyInQueue(nomor_antrian: number, callVoice = true): QueueDisplayState {
  const current = getQueueDisplayState()
  const foundInPrep = current.preparingList.find(o => o.nomor_antrian === nomor_antrian)
  const foundInReady = current.readyList.find(o => o.nomor_antrian === nomor_antrian)

  const targetOrder: QueueOrder = foundInPrep || foundInReady || {
    id: `${nomor_antrian}-${Date.now()}`,
    nomor_antrian,
    nomor_antrian_formatted: formatQueueNumber(nomor_antrian),
    status: 'READY',
    waktu_masuk: new Date().toISOString(),
    waktu_siap: new Date().toISOString(),
  }

  targetOrder.status = 'READY'
  targetOrder.waktu_siap = new Date().toISOString()
  targetOrder.waktu_panggil_terakhir = new Date().toISOString()

  const newPreparing = current.preparingList.filter(o => o.nomor_antrian !== nomor_antrian)
  let newReady = [targetOrder, ...current.readyList.filter(o => o.nomor_antrian !== nomor_antrian)]

  // Keep max 12 ready items
  if (newReady.length > 12) {
    newReady = newReady.slice(0, 12)
  }

  const updatedState = broadcastQueueState({
    preparingList: newPreparing,
    readyList: newReady,
    currentCalling: targetOrder,
    lastCalledNumber: targetOrder.nomor_antrian_formatted,
  })

  if (callVoice) {
    playQueueCallSound(targetOrder.nomor_antrian, targetOrder.nomor_antrian_formatted, targetOrder.nomor_meja)
  }

  return updatedState
}

/**
 * Complete and remove order from ready queue
 */
export function completeOrderInQueue(nomor_antrian: number): QueueDisplayState {
  const current = getQueueDisplayState()
  return broadcastQueueState({
    preparingList: current.preparingList.filter(o => o.nomor_antrian !== nomor_antrian),
    readyList: current.readyList.filter(o => o.nomor_antrian !== nomor_antrian),
    currentCalling: current.currentCalling?.nomor_antrian === nomor_antrian ? null : current.currentCalling,
  })
}

// ─── AUDIO CHIME & SPEECH SYNTHESIS ─────────────────────────────────────────────

let audioCtx: AudioContext | null = null

/**
 * Play harmonic dual-tone chime (Ding-Dong) using Web Audio API
 */
export function playChimeSound(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return

    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContextClass()
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }

    const now = audioCtx.currentTime

    // Tone 1: High (587.33 Hz - D5)
    const osc1 = audioCtx.createOscillator()
    const gain1 = audioCtx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(587.33, now)
    gain1.gain.setValueAtTime(0.3, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
    osc1.connect(gain1)
    gain1.connect(audioCtx.destination)
    osc1.start(now)
    osc1.stop(now + 0.6)

    // Tone 2: Lower (440 Hz - A4) with slight delay
    const osc2 = audioCtx.createOscillator()
    const gain2 = audioCtx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(440, now + 0.35)
    gain2.gain.setValueAtTime(0.35, now + 0.35)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.1)
    osc2.connect(gain2)
    gain2.connect(audioCtx.destination)
    osc2.start(now + 0.35)
    osc2.stop(now + 1.1)
  } catch {}
}

/**
 * Play Indonesian Voice Announcement with Text-To-Speech
 */
export function playQueueCallSound(
  nomor_antrian: number,
  formattedNumber?: string,
  nomor_meja?: string | null
): void {
  // 1. Play Ding-Dong chime first
  playChimeSound()

  // 2. Play speech after 750ms chime
  setTimeout(() => {
    try {
      if (!('speechSynthesis' in window)) return

      window.speechSynthesis.cancel() // Stop any previous speech

      const text = nomor_meja
        ? `Nomor antrian ${nomor_antrian}, untuk meja ${nomor_meja}, silakan mengambil pesanan Anda.`
        : `Nomor antrian ${nomor_antrian}, silakan mengambil pesanan di kasir.`

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'id-ID'
      utterance.rate = 0.95 // Natural speech pace
      utterance.pitch = 1.05

      // Try to select Indonesian voice if available
      const voices = window.speechSynthesis.getVoices()
      const idVoice = voices.find(v => v.lang.startsWith('id') || v.lang.includes('ID'))
      if (idVoice) utterance.voice = idVoice

      window.speechSynthesis.speak(utterance)
    } catch {}
  }, 750)
}
