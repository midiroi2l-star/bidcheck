import type { ReactNode } from 'react'
import clsx from 'clsx'

const toneStyles = {
  slate: 'bg-slate-50 text-slate-600',
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
}

export function StatTile({
  label,
  value,
  unit,
  icon,
  tone = 'slate',
  trend,
}: {
  label: string
  value: string | number
  unit?: string
  icon?: ReactNode
  tone?: keyof typeof toneStyles
  trend?: { value: string; positive: boolean }
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {icon && <div className={clsx('rounded-lg p-2', toneStyles[tone])}>{icon}</div>}
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-2xl font-bold tracking-tight text-slate-900">{value}</span>
        {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
      </div>
      {trend && (
        <p className={clsx('mt-2 text-xs font-medium', trend.positive ? 'text-emerald-600' : 'text-red-600')}>
          {trend.value}
        </p>
      )}
    </div>
  )
}
