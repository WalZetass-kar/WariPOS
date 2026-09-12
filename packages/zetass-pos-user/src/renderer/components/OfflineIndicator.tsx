import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import { api } from '../utils/api'

type Status = 'ok' | 'error' | 'checking'

export default function OfflineIndicator() {
  const [status, setStatus] = useState<Status>('checking')

  const check = async () => {
    try {
      const r = await api<{ test: number }>('system:checkDb')
      if (r.success) {
        setStatus('ok')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [])

  if (status !== 'error') return null

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-red-500 px-3 py-2 text-xs font-medium text-white shadow-lg">
      <WifiOff size={14} />
      <span>Database bermasalah</span>
      <button onClick={check} className="ml-1 underline hover:no-underline">Coba lagi</button>
    </div>
  )
}
