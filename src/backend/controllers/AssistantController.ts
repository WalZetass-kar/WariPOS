import http from 'http'
import https from 'https'
import { IndustrySettingsController } from './IndustrySettingsController.js'
import { buildAssistantPrompt, buildAssistantSystemPrompt, buildLocalAssistantResponse } from '../../shared/dashboardAssistant.js'
import {
  defaultBaseUrlForProvider,
  defaultModelForProvider,
  normalizeIndustrySettings,
  openAiCompatibleChatUrl,
  openAiCompatibleModelsUrl,
  type IndustrySettings,
} from '../../shared/industrySettings.js'
import type { DashboardSummary } from '../../shared/types.js'
import { assertHttpsEndpoint } from '../../shared/endpointSecurity.js'

interface AssistantRequest {
  question: string
  summary?: DashboardSummary
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string; type?: string; code?: string } | string
}

interface ModelsResponse {
  data?: Array<{ id?: string; name?: string }>
  models?: Array<{ id?: string; name?: string }>
  error?: { message?: string; type?: string } | string
}

const AI_TIMEOUT_MS = 60000
const DEFAULT_AI_REFERER = process.env.VITE_AI_REFERER_URL || ''

interface JsonHttpResponse<T> {
  ok: boolean
  status: number
  data: T | null
}

function defaultBaseUrl(settings: IndustrySettings) {
  if (settings.aiProvider === 'custom') return settings.aiBaseUrl
  if (settings.aiProvider === 'openai') {
    return settings.aiBaseUrl || process.env.VITE_AI_PROVIDER_URL || process.env.AI_PROVIDER_URL || defaultBaseUrlForProvider('openai')
  }
  return settings.aiBaseUrl || defaultBaseUrlForProvider(settings.aiProvider)
}

function aiRefererUrl() {
  const raw = process.env.VITE_AI_REFERER_URL || process.env.VITE_API_BASE_URL || DEFAULT_AI_REFERER
  if (!raw) return undefined
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'https:' ? parsed.toString().replace(/\/+$/, '') : undefined
  } catch {
    return undefined
  }
}

function isLocalHost(hostname: string) {
  return ['localhost', '127.0.0.1', '::1'].includes(hostname.toLowerCase())
}

function requestJson<T>(
  method: string,
  rawUrl: string,
  headers: Record<string, string>,
  body?: unknown,
): Promise<JsonHttpResponse<T>> {
  return new Promise((resolve, reject) => {
    let parsed: URL
    try {
      parsed = new URL(rawUrl)
    } catch {
      reject(new Error(`URL AI tidak valid: ${rawUrl}`))
      return
    }

    const payload = body === undefined ? undefined : JSON.stringify(body)
    const isHttps = parsed.protocol === 'https:'
    const lib = isHttps ? https : http
    const options: https.RequestOptions | http.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      family: undefined,
      headers: {
        ...headers,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }

    let settled = false
    const settle = (fn: () => void) => {
      if (settled) return
      settled = true
      fn()
    }

    const req = lib.request(options, (res) => {
      let raw = ''
      res.on('data', chunk => { raw += chunk })
      res.on('end', () => {
        settle(() => {
          let data: T | null = null
          if (raw) {
            try {
              data = JSON.parse(raw) as T
            } catch {
              data = null
            }
          }
          resolve({
            ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
            status: res.statusCode ?? 0,
            data,
          })
        })
      })
    })

    req.on('error', error => settle(() => reject(error)))
    req.setTimeout(AI_TIMEOUT_MS, () => {
      req.destroy(new Error(`Koneksi AI timeout setelah ${Math.round(AI_TIMEOUT_MS / 1000)} detik`))
    })
    if (payload) req.write(payload)
    req.end()
  })
}

function formatAiError(error: unknown, settings?: IndustrySettings) {
  const message = error instanceof Error ? error.message : String(error || '')
  const cause = error && typeof error === 'object' ? (error as any).cause : undefined
  const details = [message, cause?.message, cause?.code].filter(Boolean).join(' ')

  if (/abort|timeout/i.test(details)) {
    return 'Koneksi AI timeout (60 detik). Server AI lambat merespons. Coba model yang lebih cepat (contoh: blackbox, google/gemma-3n-e4b-it) atau periksa koneksi internet.'
  }

  if (/fetch failed|failed to fetch|networkerror|enotfound|eai_again|econnrefused|econnreset|etimedout|cert|certificate/i.test(details)) {
    const baseUrl = settings ? defaultBaseUrl(settings) : ''
    let host = baseUrl
    try {
      host = baseUrl ? new URL(baseUrl).host : ''
    } catch {
      host = baseUrl
    }
    const bluesmindsHint = settings?.aiProvider === 'bluesminds'
      ? ' Untuk BluesMinds, gunakan Base URL https://api.bluesminds.com/v1 dan API key yang aktif.'
      : ''
    return `Tidak bisa menghubungi server AI${host ? ` (${host})` : ''}. Periksa koneksi internet, DNS/VPN/firewall, dan Base URL.${bluesmindsHint}`
  }

  return message || 'Koneksi AI gagal'
}

function nonJsonAiResponseMessage(settings: IndustrySettings) {
  if (settings.aiProvider === 'bluesminds') {
    return 'Endpoint BluesMinds tidak mengembalikan JSON. Gunakan Base URL https://api.bluesminds.com/v1.'
  }
  return 'Endpoint AI tidak mengembalikan JSON. Periksa Base URL provider.'
}

async function askOpenAiCompatible(settings: IndustrySettings, prompt: string) {
  const url = defaultBaseUrl(settings)
  if (!url) throw new Error('Base URL AI belum diisi')
  if (!settings.aiApiKey) throw new Error('API key AI belum diisi')

  const model = settings.aiModel || defaultModelForProvider(settings.aiProvider)
  if (!model) throw new Error('Model AI belum diisi')

  const endpoint = assertHttpsEndpoint(url, 'Base URL AI')
  if (!endpoint.valid || !endpoint.url) throw new Error(endpoint.message || 'Base URL AI tidak valid')
  const chatUrl = openAiCompatibleChatUrl(endpoint.url)

  const isBluesminds = settings.aiProvider === 'bluesminds'
  const isOpenRouter = settings.aiProvider === 'openrouter'
  const referer = aiRefererUrl()

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${settings.aiApiKey}`,
    'Content-Type': 'application/json',
  }
  if (isOpenRouter && referer) {
    headers['HTTP-Referer'] = referer
    headers['X-Title'] = 'WariPOS'
  }

  const body: Record<string, unknown> = {
    model,
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: buildAssistantSystemPrompt(),
      },
      { role: 'user', content: prompt },
    ],
  }
  if (isBluesminds) {
    body['max_completion_tokens'] = 600
  } else {
    body['max_tokens'] = 600
  }

  const response = await requestJson<ChatCompletionResponse>('POST', chatUrl, headers, body)

  const data = response.data
  if (!data) {
    const detail = `Status: ${response.status}. Server tidak mengembalikan JSON.`
    throw new Error(isBluesminds
      ? `BluesMinds error: ${detail} Pastikan model "${model}" tersedia di akun Anda.`
      : nonJsonAiResponseMessage(settings))
  }
  if (!response.ok || data?.error) {
    const errObj = data?.error
    const errorMsg = typeof errObj === 'string'
      ? errObj
      : (errObj?.message || errObj?.toString() || `HTTP ${response.status}`)
    const errType = typeof errObj === 'object' && errObj?.type ? ` (${errObj.type})` : ''
    throw new Error(isBluesminds
      ? `BluesMinds: ${errorMsg}${errType}. Model: ${model}`
      : errorMsg)
  }

  const answer = data?.choices?.[0]?.message?.content?.trim()
  if (!answer) throw new Error('AI tidak mengembalikan jawaban')
  return answer
}

async function listOpenAiCompatibleModels(settings: IndustrySettings) {
  const url = defaultBaseUrl(settings)
  if (!url) throw new Error('Base URL AI belum diisi')
  if (!settings.aiApiKey) throw new Error('API key AI belum diisi')

  const endpoint = assertHttpsEndpoint(url, 'Base URL AI')
  if (!endpoint.valid || !endpoint.url) throw new Error(endpoint.message || 'Base URL AI tidak valid')
  const modelsUrl = openAiCompatibleModelsUrl(endpoint.url)

  const isOpenRouter = settings.aiProvider === 'openrouter'
  const referer = aiRefererUrl()
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${settings.aiApiKey}`,
    'Content-Type': 'application/json',
  }
  if (isOpenRouter && referer) {
    headers['HTTP-Referer'] = referer
    headers['X-Title'] = 'WariPOS'
  }

  const response = await requestJson<ModelsResponse>('GET', modelsUrl, headers)

  const data = response.data
  if (!data) throw new Error(nonJsonAiResponseMessage(settings))
  if (!response.ok || data?.error) {
    const err = data?.error
    const errMsg = typeof err === 'string' ? err : (err?.message || `AI models HTTP ${response.status}`)
    throw new Error(errMsg)
  }

  const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : []
  const models = rows
    .map(row => String(row.id || row.name || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
  if (!models.length) throw new Error('Provider tidak mengembalikan daftar model')
  return models
}

async function askGemini(settings: IndustrySettings, prompt: string) {
  if (!settings.aiApiKey) throw new Error('API key Gemini belum diisi')

  const model = settings.aiModel || defaultModelForProvider('gemini')
  const baseUrl = settings.aiBaseUrl || defaultBaseUrlForProvider('gemini')
  const endpoint = assertHttpsEndpoint(baseUrl, 'Base URL Gemini')
  if (!endpoint.valid || !endpoint.url) throw new Error(endpoint.message || 'Base URL Gemini tidak valid')
  const url = `${baseUrl.replace(/\/+$/, '')}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(settings.aiApiKey)}`

  const response = await requestJson<any>('POST', url, { 'Content-Type': 'application/json' }, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 600 },
    })

  const data = response.data
  if (!data) throw new Error('Endpoint Gemini tidak mengembalikan JSON. Periksa Base URL Gemini.')
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || `Gemini HTTP ${response.status}`)
  }

  const answer = data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text).filter(Boolean).join('\n').trim()
  if (!answer) throw new Error('Gemini tidak mengembalikan jawaban')
  return answer
}

async function askOnline(settings: IndustrySettings, prompt: string) {
  if (settings.aiProvider === 'gemini') return askGemini(settings, prompt)
  return askOpenAiCompatible(settings, prompt)
}

export class AssistantController {
  static async ask(input: AssistantRequest) {
    try {
      const question = String(input?.question ?? '').trim()
      if (!question) return { success: false, message: 'Pertanyaan wajib diisi' }

      const settings = IndustrySettingsController.getSettings()
      const localAnswer = buildLocalAssistantResponse(question, input.summary)

      if (!settings.aiEnabled || settings.aiProvider === 'local') {
        return {
          success: true,
          data: { answer: localAnswer, provider: 'local', online: false },
        }
      }

      try {
        const answer = await askOnline(settings, buildAssistantPrompt(question, input.summary))
        return {
          success: true,
          data: { answer, provider: settings.aiProvider, model: settings.aiModel || defaultModelForProvider(settings.aiProvider), online: true },
        }
      } catch (error) {
        return {
          success: true,
          data: {
            answer: `${localAnswer}\n\nAI online belum bisa dipakai: ${formatAiError(error, settings)}`,
            provider: 'local-fallback',
            online: false,
          },
        }
      }
    } catch (error) {
      return { success: false, message: formatAiError(error) }
    }
  }

  static async test(data?: Partial<IndustrySettings>) {
    let settings: IndustrySettings | undefined
    try {
      const current = IndustrySettingsController.getSettings()
      settings = normalizeIndustrySettings({ ...current, ...(data ?? {}) })
      if (!settings.aiEnabled || settings.aiProvider === 'local') {
        return { success: false, message: 'Aktifkan AI online dan pilih provider terlebih dahulu' }
      }

      const answer = await askOnline(settings, 'Balas hanya dengan kata OK jika koneksi berhasil.')
      return {
        success: true,
        data: { provider: settings.aiProvider, model: settings.aiModel || defaultModelForProvider(settings.aiProvider), answer },
        message: 'Koneksi AI berhasil',
      }
    } catch (error) {
      return { success: false, message: formatAiError(error, settings) }
    }
  }

  static async listModels(data?: Partial<IndustrySettings>) {
    let settings: IndustrySettings | undefined
    try {
      const current = IndustrySettingsController.getSettings()
      settings = normalizeIndustrySettings({ ...current, ...(data ?? {}) })
      if (!settings.aiEnabled || settings.aiProvider === 'local') {
        return { success: false, message: 'Aktifkan AI online dan pilih provider terlebih dahulu' }
      }
      if (settings.aiProvider === 'gemini') {
        return { success: false, message: 'Daftar model otomatis saat ini hanya untuk provider OpenAI-compatible' }
      }

      const models = await listOpenAiCompatibleModels(settings)
      return { success: true, data: models, message: `${models.length} model tersedia` }
    } catch (error) {
      return { success: false, message: formatAiError(error, settings) }
    }
  }
}
