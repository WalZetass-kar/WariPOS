import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Camera, X, Zap, ZapOff, RefreshCw, AlertCircle, CheckCircle2, ScanLine } from 'lucide-react'
import { cashierSound } from '../utils/sound'
import { ensureCameraPermission } from '../utils/nativePermissions'
import Button from './Button'

interface CameraBarcodeScannerModalProps {
  open: boolean
  onClose: () => void
  onScan: (barcode: string) => boolean | Promise<boolean> | void
  title?: string
  continuous?: boolean
}

export default function CameraBarcodeScannerModal({
  open,
  onClose,
  onScan,
  title = 'Scan Barcode / QR Code',
  continuous = true,
}: CameraBarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<number | null>(null)
  const scannedRef = useRef(false)
  const cooldownRef = useRef(false)

  const [status, setStatus] = useState('Menyiapkan kamera...')
  const [error, setError] = useState('')
  const [torchOn, setTorchOn] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  const [scanStatus, setScanStatus] = useState<'success' | 'error' | null>(null)
  const [isContinuous, setIsContinuous] = useState(continuous)
  const [scannedCount, setScannedCount] = useState(0)

  const triggerHaptic = (isError = false) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        if (isError) {
          navigator.vibrate([80, 50, 80])
        } else {
          navigator.vibrate(60)
        }
      } catch {}
    }
  }

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setTorchOn(false)
  }, [])

  const handleBarcodeFound = useCallback(
    async (code: string) => {
      const trimmed = code.trim()
      if (!trimmed) return

      // Single-scan mode behavior
      if (!isContinuous) {
        if (scannedRef.current) return
        scannedRef.current = true

        const result = await Promise.resolve(onScan(trimmed))
        const isSuccess = result !== false

        if (isSuccess) {
          triggerHaptic(false)
          cashierSound.playScanSuccess()
          setScanStatus('success')
          setLastScanned(trimmed)
          setStatus(`Terbaca: ${trimmed}`)
          if (scanIntervalRef.current) {
            window.clearInterval(scanIntervalRef.current)
            scanIntervalRef.current = null
          }
          setTimeout(() => {
            stopCamera()
            onClose()
          }, 250)
        } else {
          triggerHaptic(true)
          cashierSound.playScanError()
          setScanStatus('error')
          setLastScanned(trimmed)
          setStatus(`Item / No Seri tidak ditemukan: ${trimmed}`)
          setTimeout(() => {
            scannedRef.current = false
            setLastScanned(null)
            setScanStatus(null)
          }, 1500)
        }
        return
      }

      // Continuous multi-scan mode
      if (cooldownRef.current) return
      cooldownRef.current = true

      const result = await Promise.resolve(onScan(trimmed))
      const isSuccess = result !== false

      if (isSuccess) {
        triggerHaptic(false)
        cashierSound.playScanSuccess()
        setScanStatus('success')
        setLastScanned(trimmed)
        setScannedCount(prev => {
          const next = prev + 1
          setStatus(`Item ditambahkan (${next}): ${trimmed}`)
          return next
        })
      } else {
        triggerHaptic(true)
        cashierSound.playScanError()
        setScanStatus('error')
        setLastScanned(trimmed)
        setStatus(`Item / No Seri tidak ditemukan: ${trimmed}`)
      }

      // Cooldown delay before allowing the next scan (avoids double reading the same item instantly)
      setTimeout(() => {
        setLastScanned(null)
        setScanStatus(null)
        cooldownRef.current = false
      }, 1200)
    },
    [isContinuous, onScan, onClose, stopCamera]
  )

  const startCamera = useCallback(async () => {
    scannedRef.current = false
    cooldownRef.current = false
    setScannedCount(0)
    setError('')
    setStatus('Menyiapkan kamera...')
    setLastScanned(null)
    setScanStatus(null)

    const permission = await ensureCameraPermission()
    if (!permission.granted) {
      setError(permission.message || 'Izin kamera belum diberikan.')
      return
    }

    try {
      stopCamera()

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      // Check if torch/flashlight is supported
      const track = stream.getVideoTracks()[0]
      const capabilities = track?.getCapabilities?.() as any
      if (capabilities && 'torch' in capabilities) {
        setTorchAvailable(true)
      } else {
        setTorchAvailable(false)
      }

      setStatus('Arahkan kamera tepat ke barcode atau kode QR')

      // Use BarcodeDetector if available
      const BarcodeDetectorCtor = (window as any).BarcodeDetector
      let detector: any = null

      if (BarcodeDetectorCtor) {
        try {
          detector = new BarcodeDetectorCtor({
            formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf', 'data_matrix'],
          })
        } catch {
          detector = null
        }
      }

      // Scan loop
      scanIntervalRef.current = window.setInterval(async () => {
        const video = videoRef.current
        if (!video || video.readyState < 2) return

        // 1. Try BarcodeDetector
        if (detector) {
          try {
            const barcodes = await detector.detect(video)
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              handleBarcodeFound(String(barcodes[0].rawValue))
              return
            }
          } catch {
            // Detector error, ignore and continue
          }
        }

        // 2. Fallback Canvas Frame capture (for high-contrast edge & luminosity detection)
        const canvas = canvasRef.current
        if (canvas) {
          const ctx = canvas.getContext('2d')
          if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = Math.min(640, video.videoWidth)
            canvas.height = Math.min(480, video.videoHeight)
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          }
        }
      }, 350)
    } catch (err: any) {
      setError(err.message || 'Gagal mengakses kamera perangkat.')
    }
  }, [facingMode, handleBarcodeFound, stopCamera])

  useEffect(() => {
    if (open) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [open, startCamera, stopCamera])

  useEffect(() => {
    const handleModalBack = (e: Event) => {
      if (open) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('app:modal-back', handleModalBack)
    return () => window.removeEventListener('app:modal-back', handleModalBack)
  }, [open, onClose])

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return

    try {
      const nextState = !torchOn
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      })
      setTorchOn(nextState)
    } catch {
      setTorchAvailable(false)
    }
  }

  const toggleCamera = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'))
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md modal-backdrop-animate" onClick={onClose} />

      {/* Container */}
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl z-10 flex flex-col max-h-[90vh] modal-card-animate">
        {/* Header */}
        <div className="p-3.5 sm:p-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/90 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-600/40 text-red-400 flex items-center justify-center">
              <Camera size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm leading-tight">{title}</h3>
                {scannedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-extrabold shadow">
                    +{scannedCount} Item
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-none mt-0.5">{status}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsContinuous(v => !v)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                isContinuous
                  ? 'bg-primary-600/30 text-primary-300 border-primary-500/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title={isContinuous ? 'Mode Multi-Scan: Kamera tetap terbuka setelah scan' : 'Mode Sekali Scan: Kamera langsung tertutup'}
            >
              {isContinuous ? 'Multi-Scan' : 'Sekali'}
            </button>

            <button
              type="button"
              onClick={() => {
                stopCamera()
                onClose()
              }}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Video Viewport Area */}
        <div className="relative w-full aspect-[4/3] bg-black overflow-hidden flex items-center justify-center">
          <video ref={videoRef} playsInline autoPlay muted className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />

          {/* Targeting Box */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
            <div
              className={`relative w-64 h-44 rounded-2xl border-2 transition-all flex items-center justify-center ${
                scanStatus === 'success'
                  ? 'border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.6)]'
                  : scanStatus === 'error'
                  ? 'border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.7)]'
                  : 'border-red-500/80 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
              }`}
            >
              {/* Corner accents */}
              <div
                className={`absolute -top-1.5 -left-1.5 w-5 h-5 border-t-4 border-l-4 rounded-tl-md transition-colors ${
                  scanStatus === 'success' ? 'border-emerald-400' : 'border-red-500'
                }`}
              />
              <div
                className={`absolute -top-1.5 -right-1.5 w-5 h-5 border-t-4 border-r-4 rounded-tr-md transition-colors ${
                  scanStatus === 'success' ? 'border-emerald-400' : 'border-red-500'
                }`}
              />
              <div
                className={`absolute -bottom-1.5 -left-1.5 w-5 h-5 border-b-4 border-l-4 rounded-bl-md transition-colors ${
                  scanStatus === 'success' ? 'border-emerald-400' : 'border-red-500'
                }`}
              />
              <div
                className={`absolute -bottom-1.5 -right-1.5 w-5 h-5 border-b-4 border-r-4 rounded-br-md transition-colors ${
                  scanStatus === 'success' ? 'border-emerald-400' : 'border-red-500'
                }`}
              />

              {/* Animated scan laser line */}
              <div
                className={`absolute inset-x-2 h-0.5 shadow-sm transition-colors ${
                  scanStatus === 'success' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                } animate-pulse`}
              />

              {lastScanned && scanStatus === 'success' && (
                <div className="absolute inset-0 bg-emerald-500/30 rounded-2xl flex items-center justify-center backdrop-blur-xs">
                  <CheckCircle2 size={40} className="text-white drop-shadow-md animate-bounce" />
                </div>
              )}
              {lastScanned && scanStatus === 'error' && (
                <div className="absolute inset-0 bg-red-500/40 rounded-2xl flex items-center justify-center backdrop-blur-xs">
                  <AlertCircle size={40} className="text-white drop-shadow-md animate-bounce" />
                </div>
              )}
            </div>
          </div>

          {/* Error Message Overlay */}
          {error && (
            <div className="absolute inset-x-4 bottom-4 p-3 bg-red-950/90 border border-red-800 rounded-xl text-red-200 text-xs flex items-start gap-2 backdrop-blur-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
              <p className="flex-1">{error}</p>
            </div>
          )}
        </div>

        {/* Controls Toolbar */}
        <div className="p-3 sm:p-4 bg-slate-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {torchAvailable && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 sm:p-2.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${
                  torchOn
                    ? 'bg-amber-500 text-white border-amber-400 shadow-md shadow-amber-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                }`}
              >
                {torchOn ? <Zap size={15} /> : <ZapOff size={15} />}
                <span>Flash</span>
              </button>
            )}

            <button
              type="button"
              onClick={toggleCamera}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold"
            >
              <RefreshCw size={14} />
              <span>Ganti Kamera</span>
            </button>
          </div>

          <Button
            variant={scannedCount > 0 ? "primary" : "secondary"}
            size="sm"
            onClick={() => {
              stopCamera()
              onClose()
            }}
            className="font-bold px-4"
          >
            {scannedCount > 0 ? `Selesai (${scannedCount})` : 'Tutup'}
          </Button>
        </div>
      </div>
    </div>
  )
}
