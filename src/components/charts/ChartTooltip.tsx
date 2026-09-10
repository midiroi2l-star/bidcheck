interface TooltipPayloadItem {
  name?: string
  value?: number | string
  color?: string
  unit?: string
}

export function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border border-white/10 bg-[#141a2b]/95 px-3 py-2 text-xs shadow-[0_12px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      {label && <p className="mb-1.5 font-medium text-[color:var(--color-ink-2)]">{label}</p>}
      <div className="flex flex-col gap-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-[color:var(--color-ink-3)]">{p.name}</span>
            <span className="tabular ml-auto font-semibold text-[color:var(--color-ink-1)]">
              {p.value}
              {p.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export const chartGrid = {
  stroke: 'rgba(255,255,255,0.07)',
}

export const chartAxisTick = { fontSize: 11, fill: '#707a93' }
