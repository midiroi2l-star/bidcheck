import type { ReactNode } from 'react'
import clsx from 'clsx'

export function Card({
  children,
  className,
  padded = true,
  hover = false,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
  hover?: boolean
}) {
  return (
    <div
      className={clsx(
        'glass-panel rounded-2xl shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_20px_40px_-24px_rgba(0,0,0,0.6)]',
        hover && 'transition-colors duration-200 hover:border-white/[0.16]',
        padded && 'p-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold text-[color:var(--color-ink-1)]">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-[color:var(--color-ink-3)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
