export type AiProvider = 'local' | 'openai' | 'gemini' | 'custom' | 'deepseek' | 'openrouter' | 'bluesminds'

export interface IndustrySettings {
  aiEnabled: boolean
  aiProvider: AiProvider
  aiModel: string
  aiBaseUrl: string
  aiApiKey: string
  googleSheetsEnabled: boolean
  googleSheetsWebAppUrl: string
  autoBackupEnabled: boolean
  backupRetentionDays: number
}

export const DEFAULT_INDUSTRY_SETTINGS: IndustrySettings = {
  aiEnabled: false,
  aiProvider: 'local',
  aiModel: '',
  aiBaseUrl: '',
  aiApiKey: '',
  googleSheetsEnabled: false,
  googleSheetsWebAppUrl: '',
  autoBackupEnabled: true,
  backupRetentionDays: 30,
}

const AI_PROVIDERS: AiProvider[] = ['local', 'openai', 'gemini', 'custom', 'deepseek', 'openrouter', 'bluesminds']

function toBool(value: unknown, fallback = false) {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
  return Boolean(value)
}

function toText(value: unknown) {
  return String(value ?? '').trim()
}

function toRetentionDays(value: unknown) {
  const days = Number(value)
  if (!Number.isFinite(days)) return DEFAULT_INDUSTRY_SETTINGS.backupRetentionDays
  return Math.min(365, Math.max(1, Math.round(days)))
}

export function normalizeIndustrySettings(input: Partial<IndustrySettings> | Record<string, unknown> | null | undefined): IndustrySettings {
  const raw = (input ?? {}) as Record<string, unknown> & Partial<IndustrySettings>
  const provider = toText(raw.aiProvider || raw.ai_provider) as AiProvider
  return {
    aiEnabled: toBool(raw.aiEnabled ?? raw.ai_enabled, DEFAULT_INDUSTRY_SETTINGS.aiEnabled),
    aiProvider: AI_PROVIDERS.includes(provider) ? provider : DEFAULT_INDUSTRY_SETTINGS.aiProvider,
    aiModel: toText(raw.aiModel ?? raw.ai_model),
    aiBaseUrl: toText(raw.aiBaseUrl ?? raw.ai_base_url).replace(/\/+$/, ''),
    aiApiKey: toText(raw.aiApiKey ?? raw.ai_api_key),
    googleSheetsEnabled: toBool(raw.googleSheetsEnabled ?? raw.google_sheets_enabled, DEFAULT_INDUSTRY_SETTINGS.googleSheetsEnabled),
    googleSheetsWebAppUrl: toText(raw.googleSheetsWebAppUrl ?? raw.google_sheets_webapp_url),
    autoBackupEnabled: toBool(raw.autoBackupEnabled ?? raw.auto_backup_enabled, DEFAULT_INDUSTRY_SETTINGS.autoBackupEnabled),
    backupRetentionDays: toRetentionDays(raw.backupRetentionDays ?? raw.backup_retention_days),
  }
}

export function defaultModelForProvider(provider: AiProvider) {
  if (provider === 'openai') return 'gpt-4o-mini'
  if (provider === 'deepseek') return 'deepseek-chat'
  if (provider === 'openrouter') return 'deepseek/deepseek-r1:free'
  if (provider === 'bluesminds') return 'DeepSeek-V4-Flash'
  if (provider === 'gemini') return 'gemini-2.0-flash'
  return ''
}

export function defaultBaseUrlForProvider(provider: AiProvider) {
  if (provider === 'openai') return 'https://api.openai.com/v1/chat/completions'
  if (provider === 'deepseek') return 'https://api.deepseek.com/chat/completions'
  if (provider === 'openrouter') return 'https://openrouter.ai/api/v1/chat/completions'
  if (provider === 'bluesminds') return 'https://api.bluesminds.com/v1'
  if (provider === 'gemini') return 'https://generativelanguage.googleapis.com/v1beta'
  return ''
}

export function openAiCompatibleChatUrl(baseUrl: string) {
  const trimmed = toText(baseUrl).replace(/\/+$/, '')
  if (!trimmed) return ''

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return trimmed
  }

  const path = parsed.pathname.replace(/\/+$/, '')
  if (parsed.hostname.toLowerCase() === 'api.bluesminds.com') return `${parsed.origin}/v1/chat/completions`
  if (/\/chat\/completions$/i.test(path)) return trimmed
  if (/\/v\d+(?:beta)?$/i.test(path)) return `${trimmed}/chat/completions`
  return trimmed
}

export function openAiCompatibleModelsUrl(baseUrl: string) {
  const trimmed = toText(baseUrl).replace(/\/+$/, '')
  if (!trimmed) return ''

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return trimmed
  }

  const path = parsed.pathname.replace(/\/+$/, '')
  if (parsed.hostname.toLowerCase() === 'api.bluesminds.com') return `${parsed.origin}/v1beta/models`
  if (/\/chat\/completions$/i.test(path)) {
    parsed.pathname = path.replace(/\/chat\/completions$/i, '/models')
    parsed.search = ''
    return parsed.toString().replace(/\/+$/, '')
  }
  if (/\/v\d+(?:beta)?$/i.test(path)) return `${trimmed}/models`
  return `${trimmed}/models`
}
