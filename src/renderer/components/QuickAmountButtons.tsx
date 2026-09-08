import { formatRupiah } from '../utils/format'

interface Props {
  total: number
  onAmount: (amount: number) => void
}

export function getSmartCashAmounts(total: number): number[] {
  if (total <= 0) return []
  const amounts = new Set<number>()

  // 1. Selalu sertakan total ("Uang Pas")
  amounts.add(total)

  // 2. Round-up pecahan umum belanja Indonesia (1k, 2k, 5k, 10k, 20k, 50k, 100k)
  const roundSteps = [1000, 2000, 5000, 10000, 20000, 50000, 100000]
  for (const step of roundSteps) {
    const rounded = Math.ceil(total / step) * step
    if (rounded > total) {
      amounts.add(rounded)
    }
  }

  // 3. Pecahan uang kertas Rupiah standar yang lebih besar dari total belanja
  const banknotes = [2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000]
  for (const note of banknotes) {
    if (note > total) {
      amounts.add(note)
    }
  }

  // 4. Jika total >= 100.000, tambahkan kelipatan 50.000 dan 100.000 berikutnya
  if (total >= 100000) {
    const next50k = Math.ceil(total / 50000) * 50000
    const next100k = (Math.floor(total / 100000) + 1) * 100000
    const next200k = (Math.floor(total / 100000) + 2) * 100000
    if (next50k > total) amounts.add(next50k)
    amounts.add(next100k)
    amounts.add(next200k)
  }

  // Urutkan dari terkecil ke terbesar, ambil maksimal 6 opsi (1 Uang Pas + 5 pecahan cepat)
  return Array.from(amounts).sort((a, b) => a - b).slice(0, 6)
}

export default function QuickAmountButtons({ total, onAmount }: Props) {
  if (total <= 0) return null
  const amounts = getSmartCashAmounts(total)
  if (amounts.length === 0) return null

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {amounts.map(amount => (
        <button
          key={amount}
          onClick={() => onAmount(amount)}
          className={`px-2 py-2 rounded-lg text-xs font-semibold border transition-all active:scale-[0.97] ${
            amount === total
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300'
          }`}
          aria-label={`Bayar ${formatRupiah(amount)}`}
        >
          {amount === total ? 'Uang Pas' : formatRupiah(amount)}
        </button>
      ))}
    </div>
  )
}
