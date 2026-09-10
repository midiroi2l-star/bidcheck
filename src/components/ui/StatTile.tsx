import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { AnimatedNumber } from './AnimatedNumber'
import { Sparkline } from './Sparkline'

const toneStyles = {
  slate: { bg: 'bg-white/[0.06]', text: 'text-[color:var(--color-ink-2)]', ring: 'ring-white/10' },
  blue: { bg: 'bg-[#3987e5]/15', text: 'text-[#7ab1f2]', ring: 'ring-[#3987e5]/25' },
  emerald: { bg: 'bg-[#0ca30c]/15', text: 'text-[#3ddb3d]', ring: 'ring-[#0ca30c]/25' },
  amber: { bg: 'bg-[#fab219]/15', text: 'text-[#ffc94d]', ring: 'ring-[#fab219]/25' },
  red: { bg: 'bg-[#d03b3b]/15', text: 'text-[#ff6b6b]', ring: 'ring-[#d03b3b]/25' },
}

export function StatTile({
  label,
  value,
  unit,
  icon,
  tone = 'slate',
  trend,
  decimals = 0,
  sparkline,
  sparklineColor,
}: {
  label: string
  value: number
  unit?: string
  icon?: ReactNode
  tone?: keyof typeof toneStyles
  trend?: { value: string; positive: boolean }
  decimals?: number
  sparkline?: number[]
  sparklineColor?: string
}) {
  const t = toneStyles[tone]
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="glass-panel relative overflow-hidden rounded-2xl p-5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_20px_40px_-24px_rgba(0,0,0,0.6)]"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[color:var(--color-ink-3)]">{label}</p>
        {icon && <div className={clsx('rounded-lg p-2 ring-1 ring-inset', t.bg, t.text, t.ring)}>{icon}</div>}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1">
          <span className="tabular text-2xl font-bold tracking-tight text-[color:var(--color-ink-1)]">
            <AnimatedNumber value={value} decimals={decimals} />
          </span>
          {unit && <span className="text-sm font-medium text-[color:var(--color-ink-3)]">{unit}</span>}
        </div>
        {sparkline && sparkline.length > 1 && (
          <Sparkline data={sparkline} color={sparklineColor ?? '#3987e5'} width={80} height={28} />
        )}
      </div>
      {trend && (
        <p className={clsx('mt-2 text-xs font-medium', trend.positive ? 'text-[#3ddb3d]' : 'text-[#ff6b6b]')}>
          {trend.value}
        </p>
      )}
    </motion.div>
  )
}
