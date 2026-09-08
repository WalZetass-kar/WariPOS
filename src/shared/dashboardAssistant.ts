import type { DashboardSummary } from './types'

const STORE_KEYWORDS = [
  'omzet',
  'omset',
  'pemasukan',
  'penjualan',
  'transaksi',
  'produk',
  'stok',
  'restock',
  'menipis',
  'prediksi',
  'besok',
  'minggu',
  'bulan',
  'rata',
  'hpp',
  'laba',
  'profit',
  'pendapatan',
]

const GENERAL_KEYWORDS = [
  'apa',
  'siapa',
  'jelaskan',
  'apa itu',
  'bagaimana',
  'gimana',
  'kenapa',
  'tolong',
  'bantu',
  'buatkan',
  'ceritain',
  'tulis',
  'ringkas',
  'ide',
  'rekomendasi',
  'contoh',
  'terjemahkan',
  'translate',
  'perbaiki',
  'bandingkan',
  'analisis',
  'detail',
]

function normalizeQuestion(question: string) {
  return question.toLowerCase().trim()
}

function includesAny(question: string, keywords: string[]) {
  return keywords.some(keyword => question.includes(keyword))
}

function isStoreQuestion(question: string) {
  return includesAny(normalizeQuestion(question), STORE_KEYWORDS)
}

function isGeneralQuestion(question: string) {
  const normalized = normalizeQuestion(question)
  return !isStoreQuestion(normalized) && includesAny(normalized, GENERAL_KEYWORDS)
}

const ASSISTANT_SYSTEM_PROMPT = [
  'Kamu adalah asisten AI serba guna dan ahli keamanan untuk aplikasi WariPOS.',
  'Kamu bisa menjawab pertanyaan umum, memberi penjelasan, mendalami error log, menganalisa keamanan aplikasi, serta membantu manajemen operasional.',
  'Jika pertanyaannya terkait data toko, gunakan konteks dashboard yang diberikan.',
  'Jika pengguna menanyakan soal error, kendala aplikasi, atau sistem keamanan, bantu berikan solusi teknis atau pemeriksaan menyeluruh.',
  'Gaya jawaban: ramah, lihai, profesional, solutif, dan tidak kaku.',
  'Gunakan Bahasa Indonesia yang enak dibaca. Boleh pakai pembuka singkat seperti "Tentu", "Siap", atau "Akan saya analisa" jika cocok.',
  'Jawab terstruktur dan informatif. Jika ada panduan perbaikan error, berikan langkah yang jelas.',
  'Kalau informasi tidak cukup, akui dengan jujur lalu beri saran atau minta detail tambahan dari log aplikasi.',
].join('\\n')

export function formatIdr(value: number | null | undefined) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value ?? 0)
}

function topProductSentence(summary: DashboardSummary) {
  const product = summary.topProducts?.[0]
  if (!product) return 'Belum ada produk terlaris minggu ini, jadi saya belum bisa menunjuk satu yang paling menonjol.'

  const name = product.nama_barang || product.kd_barang || 'Produk'
  return `Yang paling laku minggu ini adalah ${name} dengan ${product.total_qty.toLocaleString('id-ID')} terjual dan pemasukan ${formatIdr(product.total_revenue)}.`
}

function lowStockSentence(summary: DashboardSummary) {
  const products = summary.lowStockProducts || []
  if (products.length === 0) return 'Stok masih aman semua untuk saat ini.'

  const preview = products
    .slice(0, 3)
    .map(product => `${product.nama_barang || product.kd_barang} sisa ${product.stok ?? 0}`)
    .join(', ')

  return `Ada ${products.length} produk yang mulai menipis. Prioritas restock: ${preview}.`
}

export function buildLocalAssistantResponse(question: string, summary?: DashboardSummary | null) {
  const q = normalizeQuestion(question)

  if (!summary) {
    return isGeneralQuestion(q)
      ? 'Saya bisa bantu pertanyaan umum, tapi mode lokal belum bisa memberi jawaban seluas AI online. Aktifkan AI online untuk jawaban yang lebih lengkap.'
      : 'Data dashboard belum tersedia. Silakan tunggu sebentar atau aktifkan AI online untuk jawaban yang lebih luas.'
  }

  const averageWeekly = Math.round(summary.week.total / 7)
  const predicted = summary.predictedTomorrow || 0

  if (q.includes('minggu') || q.includes('week')) {
    return `Siap, Pemasukan minggu ini ${formatIdr(summary.week.total)} dari ${summary.week.count.toLocaleString('id-ID')} transaksi. Rata-rata per hari ${formatIdr(averageWeekly)}.`
  }

  if (q.includes('bulan') || q.includes('month')) {
    return `Bulan ini pemasukan ${formatIdr(summary.month.total)} dari ${summary.month.count.toLocaleString('id-ID')} transaksi.`
  }

  if (q.includes('hari ini') || q.includes('today') || q.includes('omzet') || q.includes('omset') || q.includes('pemasukan') || q.includes('penjualan')) {
    return `Tentu, pemasukan hari ini ${formatIdr(summary.today.total)} dari ${summary.today.count.toLocaleString('id-ID')} transaksi.`
  }

  if (q.includes('rata') || q.includes('average')) {
    return `Rata-rata pemasukan harian minggu ini ${formatIdr(averageWeekly)}. Angka ini dihitung dari total minggu ini dibagi 7 hari.`
  }

  if (q.includes('prediksi') || q.includes('forecast') || q.includes('besok') || q.includes('tomorrow')) {
    return `Kalau melihat tren 7 hari terakhir, besok diprediksi ${formatIdr(predicted)}.`
  }

  if (q.includes('produk') || q.includes('terlaris') || q.includes('best seller')) {
    return topProductSentence(summary)
  }

  if (q.includes('stok') || q.includes('restock') || q.includes('menipis') || q.includes('stock')) {
    return lowStockSentence(summary)
  }

  if (isGeneralQuestion(q)) {
    return 'Saya bisa bantu pertanyaan umum juga, tapi mode lokal lebih kuat untuk data toko. Kalau mau jawaban yang lebih luas, aktifkan AI online.'
  }

  return [
    `Saya rangkum ya: hari ini ${formatIdr(summary.today.total)}, minggu ini ${formatIdr(summary.week.total)}, dan bulan ini ${formatIdr(summary.month.total)}.`,
    `Rata-rata harian minggu ini ${formatIdr(averageWeekly)}. Prediksi besok ${formatIdr(predicted)}.`,
    `${topProductSentence(summary)} ${lowStockSentence(summary)} Kalau mau, saya bisa uraikan lagi per hari, produk, atau stok.`,
  ].join('\n')
}

export function buildAssistantSystemPrompt() {
  return ASSISTANT_SYSTEM_PROMPT
}

export function buildAssistantPrompt(question: string, summary?: DashboardSummary | null) {
  const storeQuestion = isStoreQuestion(question)

  if (!storeQuestion || !summary) {
    return [
      'Jawab pertanyaan pengguna secara umum, natural, dan berguna.',
      'Pertanyaan ini tidak wajib memakai konteks dashboard.',
      '',
      `Pertanyaan pengguna: ${question}`,
    ].join('\n')
  }

  return [
    'Pertanyaan ini terkait data toko. Gunakan konteks dashboard berikut bila relevan.',
    'Jika ada bagian yang tidak relevan, abaikan dan tetap jawab secara natural.',
    '',
    `Pertanyaan pengguna: ${question}`,
    '',
    `Konteks dashboard JSON: ${JSON.stringify(summary)}`,
  ].join('\n')
}
