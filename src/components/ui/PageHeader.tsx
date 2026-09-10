import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6 flex flex-wrap items-start justify-between gap-3"
    >
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[color:var(--color-ink-1)]">{title}</h1>
        {description && <p className="mt-1 text-sm text-[color:var(--color-ink-3)]">{description}</p>}
      </div>
      {action}
    </motion.div>
  )
}
