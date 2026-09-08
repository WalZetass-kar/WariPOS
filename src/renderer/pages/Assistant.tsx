import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Bot, Send, Trash2, ShoppingCart, TrendingUp,
  Copy, Check, Calculator, Settings, ZapOff,
  RefreshCw, Plus, Search, Pin, MessageSquare,
  Bookmark, ArrowDown, Paperclip, Mic, Cpu,
  ShieldCheck, PieChart, Layers, X, CheckCircle2, RotateCcw,
  PanelLeftClose, PanelLeftOpen, Info, Zap, ArrowRight
} from 'lucide-react'
import Button from '../components/Button'
import { api } from '../utils/api'
import { useToast } from '../contexts/ToastContext'
import { useNavigate } from 'react-router-dom'
import { buildLocalAssistantResponse } from '../../shared/dashboardAssistant'
import { AiActionEngine, type AiActionResult } from '../utils/aiActionEngine'
import type { DashboardSummary } from '../../shared/types'

interface AiConfig {
  aiEnabled: boolean
  aiProvider: string
  aiModel: string
  aiApiKey: string
  aiBaseUrl: string
}

interface Message {
  id: string
  sender: 'user' | 'assistant'
  text: string
  timestamp: Date
  provider?: string
  online?: boolean
  bookmarked?: boolean
  liked?: boolean | null
  actionResult?: AiActionResult
}

interface ChatSession {
  id: string
  title: string
  createdAt: Date
  isPinned?: boolean
  messages: Message[]
}

const STORAGE_SESSIONS_KEY = 'zetass_ai_sessions_v2'
const STORAGE_ACTIVE_KEY = 'zetass_ai_active_id_v2'
const MAX_STORED_MESSAGES = 60

const PROVIDER_LABELS: Record<string, string> = {
  local: 'Lokal (Offline)',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  deepseek: 'DeepSeek',
  openrouter: 'OpenRouter',
  bluesminds: 'BluesMinds',
  custom: 'Custom',
}

const QUICK_ACTIONS = [
  {
    id: 'auto-restock',
    title: 'Restock Otomatis Semua Stok Kosong',
    desc: 'Isi otomatis stok produk yang habis (+20 pcs)',
    icon: Zap,
    prompt: 'Restock semua produk yang habis masing-masing 20 pcs',
  },
  {
    id: 'sales-analysis',
    title: 'Analisis Penjualan & Omset',
    desc: 'Tinjau omzet dan tren transaksi toko',
    icon: TrendingUp,
    prompt: 'Berikan analisis performa penjualan dan omzet toko saat ini.',
  },
  {
    id: 'restock-predict',
    title: 'Prediksi Restock Barang',
    desc: 'Cek produk dengan stok menipis',
    icon: ShoppingCart,
    prompt: 'Produk mana saja yang stoknya hampir habis dan perlu segera di-restock?',
  },
  {
    id: 'hpp-calc',
    title: 'Hitung HPP & Margin Profit',
    desc: 'Optimalkan keuntungan produk',
    icon: Calculator,
    prompt: 'Bagaimana cara menghitung dan mengoptimalkan HPP produk di toko saya?',
  },
  {
    id: 'backup-now',
    title: 'Backup Database Instan',
    desc: 'Amankan database lokal POS ke SQLite backup',
    icon: ShieldCheck,
    prompt: 'Backup database sekarang',
  },
  {
    id: 'monthly-summary',
    title: 'Ringkasan Laporan Bisnis',
    desc: 'Estimasi performa laba rugi',
    icon: PieChart,
    prompt: 'Buatkan ringkasan performa bisnis dan estimasi profit bulan ini.',
  },
]

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  sender: 'assistant',
  text: 'Halo! Saya **Wari AI Autonomous Assistant**.\n\nSaya memegang kendali operasional penuh untuk mengeksekusi aksi di WariPOS:\n- **Restock Otomatis**: Ketik *"Restock semua produk yang habis masing-masing 20 pcs"* atau sebut nama produk.\n- **Tambah Produk / Promo**: Buat produk atau kupon diskon baru langsung dari chat.\n- **Backup Database**: Ketik *"Backup database sekarang"*.\n- **Navigasi Cepat**: Ketik *"Buka kasir"*, *"Buka produk"*, atau *"Buka laporan"*.\n\nSilakan ketik perintah aksi atau pilih menu cepat di bawah.',
  timestamp: new Date(),
}

function loadSavedSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_SESSIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return parsed.map((s: any) => ({
      ...s,
      createdAt: new Date(s.createdAt),
      messages: (s.messages || []).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })),
    }))
  } catch {
    return []
  }
}

function saveSessionsToStorage(sessions: ChatSession[]) {
  try {
    const trimmed = sessions.map(s => ({
      ...s,
      messages: s.messages.slice(-MAX_STORED_MESSAGES),
    }))
    localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(trimmed))
  } catch {}
}

export default function Assistant() {
  const navigate = useNavigate()
  const toast = useToast()
  
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null)
  const [testingAi, setTestingAi] = useState(false)
  
  // Multi-session state (Sidebar closed on mobile, open/collapsible on desktop)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)
  
  // Current chat state
  const [inputMessage, setInputMessage] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [thinkingStep, setThinkingStep] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isScrolledUp, setIsScrolledUp] = useState(false)
  const [streamingText, setStreamingText] = useState<string>('')
  
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Initial sessions load
  useEffect(() => {
    const loaded = loadSavedSessions()
    if (loaded.length > 0) {
      setSessions(loaded)
      const lastActive = localStorage.getItem(STORAGE_ACTIVE_KEY) || loaded[0].id
      setActiveSessionId(lastActive)
    } else {
      const defaultSession: ChatSession = {
        id: `session-${Date.now()}`,
        title: 'Percakapan Baru',
        createdAt: new Date(),
        isPinned: false,
        messages: [WELCOME_MESSAGE],
      }
      setSessions([defaultSession])
      setActiveSessionId(defaultSession.id)
    }
  }, [])

  // Load AI config & summary
  const loadSummary = useCallback(() => {
    api<DashboardSummary>('dashboard:getSummary').then(r => {
      if (r.success && r.data) setSummary(r.data)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    api<AiConfig>('integrations:get').then(r => {
      if (r.success && r.data) setAiConfig(r.data)
    })
    loadSummary()
  }, [loadSummary])

  // Save sessions & active ID
  useEffect(() => {
    if (sessions.length > 0) {
      saveSessionsToStorage(sessions)
      localStorage.setItem(STORAGE_ACTIVE_KEY, activeSessionId)
    }
  }, [sessions, activeSessionId])

  // Current active session
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0]
  const currentMessages = activeSession?.messages || []

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback((smooth = true) => {
    chatEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => {
    if (!isScrolledUp) {
      scrollToBottom()
    }
  }, [currentMessages, thinkingStep, streamingText, isScrolledUp, scrollToBottom])

  // Scroll detector
  const handleScroll = () => {
    if (!chatContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current
    const scrolled = scrollHeight - scrollTop - clientHeight > 120
    setIsScrolledUp(scrolled)
  }

  // Create New Session
  const createNewSession = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: 'Percakapan Baru',
      createdAt: new Date(),
      isPinned: false,
      messages: [WELCOME_MESSAGE],
    }
    setSessions(prev => [newSession, ...prev])
    setActiveSessionId(newSession.id)
    setInputMessage('')
    setIsSidebarOpen(false)
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  // Delete Session
  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = sessions.filter(s => s.id !== id)
    if (updated.length === 0) {
      const freshSession: ChatSession = {
        id: `session-${Date.now()}`,
        title: 'Percakapan Baru',
        createdAt: new Date(),
        isPinned: false,
        messages: [WELCOME_MESSAGE],
      }
      setSessions([freshSession])
      setActiveSessionId(freshSession.id)
    } else {
      setSessions(updated)
      if (activeSessionId === id) {
        setActiveSessionId(updated[0].id)
      }
    }
    toast('Percakapan dihapus', 'info')
  }

  // Toggle Pin Session
  const togglePinSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSessions(prev => prev.map(s => s.id === id ? { ...s, isPinned: !s.isPinned } : s))
  }

  // Add Message to Active Session
  const addMessageToActiveSession = (msg: Omit<Message, 'id' | 'timestamp'>) => {
    const fullMsg: Message = {
      ...msg,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date(),
    }

    setSessions(prev => prev.map(s => {
      if (s.id !== activeSessionId) return s
      
      const isFirstUserMsg = !s.messages.some(m => m.sender === 'user') && msg.sender === 'user'
      const newTitle = isFirstUserMsg
        ? (msg.text.length > 28 ? msg.text.slice(0, 28) + '...' : msg.text)
        : s.title

      return {
        ...s,
        title: newTitle,
        messages: [...s.messages, fullMsg],
      }
    }))

    return fullMsg
  }

  // Send Message Logic
  const handleSendMessage = async (textOverride?: string) => {
    const promptText = (textOverride || inputMessage).trim()
    if (!promptText || isGenerating) return

    addMessageToActiveSession({ sender: 'user', text: promptText })
    setInputMessage('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    setIsGenerating(true)
    setThinkingStep('Memeriksa perintah kontrol...')

    // 1. Eksekusi Autonomous Action Engine jika merupakan perintah operasional (Restock, Backup, Produk, Navigasi)
    try {
      const actionRes = await AiActionEngine.parseAndExecute(promptText)
      if (actionRes.executed) {
        setThinkingStep(null)
        setIsGenerating(false)

        addMessageToActiveSession({
          sender: 'assistant',
          text: `**${actionRes.title}**\n\n${actionRes.message}`,
          provider: 'Wari Agentic Controller',
          online: false,
          actionResult: actionRes,
        })

        if (actionRes.success) {
          toast(actionRes.title, 'success')
          loadSummary()
          if (actionRes.actionType === 'NAVIGATE' && actionRes.navigateRoute) {
            setTimeout(() => {
              navigate(actionRes.navigateRoute!)
            }, 1000)
          }
        } else {
          toast(actionRes.message || 'Perintah aksi tidak dapat diselesaikan', 'error')
        }
        return
      }
    } catch (actionErr) {
      console.error('Agentic action execution error:', actionErr)
    }

    setThinkingStep('Menganalisis data POS...')

    try {
      const r = await api<{ answer: string; provider: string; online: boolean }>('assistant:ask', {
        question: promptText,
        summary: summary ?? undefined,
      })

      setThinkingStep(null)

      const rawAnswer = r.success && r.data?.answer
        ? r.data.answer
        : buildLocalAssistantResponse(promptText, summary ?? undefined)

      const provider = r.data?.provider ?? (aiConfig?.aiEnabled ? 'AI Online' : 'Lokal')
      const online = r.data?.online ?? false

      // Stream text character by character
      setStreamingText('')
      let currentStr = ''
      const chars = rawAnswer.split('')
      const stepSize = Math.max(1, Math.floor(chars.length / 30))

      for (let i = 0; i < chars.length; i += stepSize) {
        currentStr += chars.slice(i, i + stepSize).join('')
        setStreamingText(currentStr)
        await new Promise(res => setTimeout(res, 10))
      }

      setStreamingText('')
      addMessageToActiveSession({
        sender: 'assistant',
        text: rawAnswer,
        provider,
        online,
      })
    } catch {
      setThinkingStep(null)
      setStreamingText('')
      const fallback = buildLocalAssistantResponse(promptText, summary ?? undefined)
      addMessageToActiveSession({
        sender: 'assistant',
        text: fallback,
        provider: 'Lokal (Offline)',
        online: false,
      })
    } finally {
      setIsGenerating(false)
      setThinkingStep(null)
      setStreamingText('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
      toast('Teks disalin ke clipboard', 'success')
    } catch {
      toast('Gagal menyalin', 'error')
    }
  }

  const testAiConnection = async () => {
    setTestingAi(true)
    const r = await api<{ provider: string; model: string; answer: string }>('integrations:testAi')
    setTestingAi(false)
    if (r.success) {
      toast(`AI terhubung: ${r.data?.provider ?? ''} / ${r.data?.model ?? ''}`, 'success')
      addMessageToActiveSession({
        sender: 'assistant',
        text: `**Koneksi AI Berhasil**\n\n• **Provider**: ${r.data?.provider ?? '-'}\n• **Model**: ${r.data?.model ?? '-'}\n• **Respon**: ${r.data?.answer ?? 'OK'}`,
        provider: r.data?.provider ?? 'AI Online',
        online: true,
      })
    } else {
      toast(r.message as string ?? 'Koneksi AI gagal', 'error')
      addMessageToActiveSession({
        sender: 'assistant',
        text: `**Koneksi AI Gagal**\n\n${r.message ?? 'Periksa konfigurasi AI Anda di menu Pengaturan.'}`,
        provider: 'System',
        online: false,
      })
    }
  }

  const aiOnlineReady = aiConfig?.aiEnabled && aiConfig.aiProvider !== 'local' && !!aiConfig.aiApiKey
  const aiProviderLabel = PROVIDER_LABELS[aiConfig?.aiProvider ?? 'local'] ?? aiConfig?.aiProvider ?? 'Lokal'

  const isOnlyWelcomeMessage = currentMessages.length <= 1

  return (
    <div className="flex flex-col h-[calc(100vh-84px)] sm:h-[calc(100vh-76px)] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm relative font-sans">
      {/* ─── SPACIOUS HEADER BAR ─── */}
      <header className="h-14 px-4 sm:px-6 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center text-white shadow-sm shadow-primary-500/30 shrink-0">
            <Bot size={17} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                Wari AI Asisten
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50">
                <Zap size={10} className="text-indigo-500 fill-indigo-500 animate-pulse" />
                Agentic Controller Aktif
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                aiOnlineReady ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${aiOnlineReady ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {aiOnlineReady ? `Online (${aiProviderLabel})` : 'Lokal Offline'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Kontrol penuh operasional toko, restock otomatis, dan asisten bisnis</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={createNewSession}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-95 text-xs font-bold text-white shadow-xs transition-all"
            title="Mulai Percakapan Baru"
          >
            <Plus size={14} />
            <span>Chat Baru</span>
          </button>

          <button
            onClick={() => {
              setSessions([])
              createNewSession()
              toast('Percakapan dibersihkan', 'info')
            }}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            title="Bersihkan Semua Pesan"
          >
            <Trash2 size={15} />
          </button>

          <button
            onClick={() => navigate('/settings')}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Pengaturan AI"
          >
            <Settings size={14} />
            <span>Settings</span>
          </button>

          <button
            onClick={() => setShowInfoModal(true)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Informasi Model"
          >
            <Info size={15} />
          </button>
        </div>
      </header>

      {/* ─── MAIN SPACIOUS CHAT CANVAS ─── */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50 dark:bg-slate-900/50 relative overflow-hidden">
        {/* Chat Stream & Roomy Canvas */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 scrollbar-thin"
        >
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Warning Banner if unconfigured (compact) */}
            {aiConfig && !aiOnlineReady && (
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <ZapOff size={15} className="text-amber-600 shrink-0" />
                  <span className="text-slate-700 dark:text-slate-300">
                    Mode AI berjalan offline. Hubungkan API Key di Pengaturan untuk respon yang lebih luas.
                  </span>
                </div>
                <button
                  onClick={() => navigate('/settings')}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shrink-0"
                >
                  Setup
                </button>
              </div>
            )}

            {/* EMPTY STATE / WELCOME PROMPTS */}
            {isOnlyWelcomeMessage && (
              <div className="py-8 sm:py-14 text-center space-y-6 max-w-xl mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-red-600/10 text-red-600 border border-red-200 dark:border-red-900/50 flex items-center justify-center mx-auto shadow-sm">
                  <Bot size={26} />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Ada yang bisa saya bantu untuk toko Anda?
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tanyakan seputar omzet, stok menipis, perhitungan HPP, atau analisis penjualan.
                  </p>
                </div>

                {/* 4 Sleek Prompt Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left pt-2">
                  {QUICK_ACTIONS.map(action => {
                    const IconComponent = action.icon
                    return (
                      <button
                        key={action.id}
                        onClick={() => handleSendMessage(action.prompt)}
                        className="group p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-red-600/50 hover:shadow-sm transition-all text-left flex items-start gap-3 active:scale-[0.99]"
                      >
                        <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 group-hover:bg-red-600 group-hover:text-white transition-colors shrink-0 mt-0.5">
                          <IconComponent size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors truncate">
                            {action.title}
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                            {action.desc}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* MESSAGES STREAM */}
            {currentMessages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-3 text-sm ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Assistant Avatar */}
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-1">
                    <Bot size={14} />
                  </div>
                )}

                <div className={`space-y-1 max-w-[85%] sm:max-w-[80%] ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Message Bubble */}
                  <div
                    className={`px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs ${
                      msg.sender === 'user'
                        ? 'bg-red-600 text-white rounded-br-xs font-normal'
                        : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-tl-xs'
                    }`}
                  >
                    {msg.sender === 'assistant' ? (
                      <div className="space-y-3">
                        <div
                          className="space-y-2"
                          dangerouslySetInnerHTML={{
                            __html: msg.text
                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              .replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[11px] text-red-600 dark:text-red-400">$1</code>')
                              .replace(/\n/g, '<br/>'),
                          }}
                        />

                        {/* Action Result Card if executed by Agentic Engine */}
                        {msg.actionResult && (
                          <div className={`p-3.5 rounded-xl border ${
                            msg.actionResult.success 
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200' 
                              : 'bg-red-500/10 border-red-500/30 text-red-950 dark:text-red-200'
                          } space-y-2.5 mt-2`}>
                            <div className="flex items-center justify-between">
                              <span className="font-bold flex items-center gap-1.5 text-xs">
                                <Zap size={14} className={msg.actionResult.success ? 'text-emerald-500' : 'text-red-500'} />
                                {msg.actionResult.title}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                msg.actionResult.success ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                              }`}>
                                {msg.actionResult.success ? 'Berhasil' : 'Gagal'}
                              </span>
                            </div>

                            {msg.actionResult.details && msg.actionResult.details.length > 0 && (
                              <div className="space-y-1 text-xs border-t border-emerald-500/20 dark:border-emerald-400/20 pt-2">
                                {msg.actionResult.details.map((d, i) => (
                                  <div key={i} className="flex justify-between gap-2">
                                    <span className="opacity-75">{d.label}:</span>
                                    <span className="font-semibold">{d.value}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {msg.actionResult.navigateRoute && (
                              <button
                                onClick={() => navigate(msg.actionResult!.navigateRoute!)}
                                className="w-full mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all active:scale-95"
                              >
                                <span>{msg.actionResult.navigateLabel || 'Buka Halaman'}</span>
                                <ArrowRight size={13} />
                              </button>
                            )}
                          </div>
                        )}

                        {/* 1-Click Action Chip for Low Stock Warnings */}
                        {msg.text && (msg.text.includes('menipis') || msg.text.includes('Prioritas restock')) && (
                          <div className="pt-2 flex flex-wrap gap-2 border-t border-slate-100 dark:border-slate-800">
                            <button
                              onClick={() => handleSendMessage('Restock semua produk yang habis masing-masing 20 pcs')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold text-xs transition-all active:scale-95 shadow-xs"
                            >
                              <Zap size={13} className="text-amber-600" />
                              <span>Restock Semua Produk Habis (+20 pcs)</span>
                            </button>
                            <button
                              onClick={() => navigate('/produk')}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs transition-all"
                            >
                              <span>Buka Halaman Produk</span>
                              <ArrowRight size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap">{msg.text}</span>
                    )}
                  </div>

                  {/* Message Footer Actions */}
                  <div className={`flex items-center gap-2 px-1 text-[10px] text-slate-400 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <span>
                      {msg.timestamp.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>

                    {msg.sender === 'assistant' && (
                      <div className="flex items-center gap-1 ml-1 opacity-80 hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => copyToClipboard(msg.text, msg.id)}
                          className="p-1 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors"
                          title="Salin Pesan"
                        >
                          {copiedId === msg.id ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                        </button>
                        <button
                          onClick={() => handleSendMessage(currentMessages[currentMessages.indexOf(msg) - 1]?.text || 'Jelaskan lagi')}
                          className="p-1 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors"
                          title="Jawab Ulang"
                        >
                          <RotateCcw size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* User Avatar */}
                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-xl bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm mt-1">
                    U
                  </div>
                )}
              </div>
            ))}

            {/* THINKING INDICATOR */}
            {isGenerating && (
              <div className="flex gap-3 items-start animate-fade-in">
                <div className="w-7 h-7 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-1">
                  <Bot size={14} className="animate-pulse" />
                </div>
                <div className="space-y-2 flex-1 max-w-[80%]">
                  {thinkingStep && (
                    <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                      <RefreshCw size={12} className="text-red-500 animate-spin" />
                      <span className="font-medium animate-pulse">{thinkingStep}</span>
                    </div>
                  )}
                  {streamingText && (
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                      <span className="whitespace-pre-wrap">{streamingText}</span>
                      <span className="inline-block w-1.5 h-3.5 ml-1 bg-red-600 animate-pulse align-middle" />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Scroll To Bottom Button */}
        {isScrolledUp && (
          <button
            onClick={() => scrollToBottom()}
            className="absolute bottom-20 right-6 z-20 p-2.5 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowDown size={14} />
          </button>
        )}

        {/* Floating Roomy Bottom Input Bar */}
        <div className="p-3 sm:p-4 border-t border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/10 transition-all p-2">
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Tanyakan analisis atau kendala toko ke Wari AI..."
                disabled={isGenerating}
                className="w-full px-3 py-1.5 text-xs sm:text-sm bg-transparent text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none resize-none max-h-32 scrollbar-thin"
              />

              <div className="flex items-center justify-between px-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-medium">
                  Enter = Kirim • Shift+Enter = Baris baru
                </span>

                <button
                  onClick={() => handleSendMessage()}
                  disabled={isGenerating || !inputMessage.trim()}
                  className="p-2 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white disabled:opacity-30 disabled:scale-100 transition-all shadow-sm"
                  title="Kirim Pesan"
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ─── INFO MODAL DIALOG (Instead of heavy right sidebar) ─── */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Cpu size={15} className="text-red-500" /> Spesifikasi AI
              </h3>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Provider</span>
                <span className="font-bold text-slate-900 dark:text-white">{aiProviderLabel}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Model</span>
                <span className="font-mono text-red-600 dark:text-red-400 font-bold">{aiConfig?.aiModel || 'default'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Mode</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {aiOnlineReady ? 'Online (Cloud AI)' : 'Lokal (Offline Engine)'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={testAiConnection}
                loading={testingAi}
                className="flex-1 text-xs font-bold"
              >
                Tes Koneksi AI
              </Button>
              <Button
                size="sm"
                onClick={() => { setShowInfoModal(false); navigate('/settings') }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold border-0"
              >
                Pengaturan
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
