import React from 'react'
import { motion } from 'framer-motion'
import { Printer, QrCode, Monitor } from 'lucide-react'
import posImage from '../../assets/pos-showcase-3d.png'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

interface FloatingBadgeProps {
  icon: React.ReactNode
  label: string
  sub?: string
  className?: string
  delay?: number
  still?: boolean
}

function FloatingBadge({ icon, label, sub, className = '', delay = 0, still = false }: FloatingBadgeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: still ? 0 : [0, -6, 0],
      }}
      transition={{
        y: still
          ? undefined
          : {
              duration: 5.4,
              repeat: Infinity,
              ease: 'easeInOut',
              delay,
            },
        opacity: { duration: 0.5, delay: delay * 0.3 },
        scale: { duration: 0.5, delay: delay * 0.3 },
      }}
      whileHover={{ scale: 1.04, y: -2 }}
      className={`absolute z-10 flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-md shadow-slate-900/5 dark:shadow-black/25 select-none transition-shadow hover:shadow-lg ${className}`}
    >
      <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-100 dark:border-red-900/60 text-red-600 dark:text-red-400 shrink-0">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-bold tracking-tight text-slate-800 dark:text-slate-100 leading-tight">
          {label}
        </span>
        {sub && (
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-none mt-0.5">
            {sub}
          </span>
        )}
      </div>
    </motion.div>
  )
}

export default function PosStage() {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <div className="relative w-full aspect-[4/3] max-w-full flex items-center justify-center select-none">
      {/* Soft warm studio background glow to anchor the hardware */}
      <div
        className="absolute inset-0 rounded-3xl -z-10 pointer-events-none opacity-90 dark:opacity-15"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(255, 255, 255, 0.95) 0%, rgba(246, 244, 238, 0.6) 60%, transparent 80%)',
        }}
        aria-hidden="true"
      />

      {/* Main 3D Hardware Image */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative w-full h-full flex items-center justify-center p-0 sm:p-2"
      >
        <img
          src={posImage}
          alt="Showcase Perangkat Kasir WariPOS 3D"
          className="w-full h-full object-contain drop-shadow-2xl select-none pointer-events-none"
          loading="eager"
          decoding="async"
        />

        {/* 3 Focused Feature Badges in Negative Space (No device occlusion) */}
        {/* 1. Touchscreen Monitor: Top Left */}
        <FloatingBadge
          still={prefersReducedMotion}
          delay={0}
          icon={<Monitor className="w-3.5 h-3.5" />}
          label="Kasir Touchscreen"
          sub="Responsif & Modern"
          className="top-[3%] left-[1%] sm:left-[3%]"
        />

        {/* 2. Stand QRIS & Digital: Right Side */}
        <FloatingBadge
          still={prefersReducedMotion}
          delay={1.2}
          icon={<QrCode className="w-3.5 h-3.5" />}
          label="Stand QRIS"
          sub="Pembayaran Digital"
          className="top-[35%] right-[-1%] sm:right-[1%]"
        />

        {/* 3. Thermal Printer: Bottom Left */}
        <FloatingBadge
          still={prefersReducedMotion}
          delay={0.8}
          icon={<Printer className="w-3.5 h-3.5" />}
          label="Struk Thermal Instan"
          sub="Auto-Cutter Cepat"
          className="bottom-[2%] left-[10%] sm:left-[14%]"
        />
      </motion.div>
    </div>
  )
}