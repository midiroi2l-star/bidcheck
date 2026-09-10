// 공통 다크 UI 클래스 (입력창, 필터 pill, 버튼 등 재사용)
export const inputBase =
  'rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-[color:var(--color-ink-1)] placeholder:text-[color:var(--color-ink-3)] outline-none transition focus:border-[#3987e5]/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-[#3987e5]/20'

export function filterPill(active: boolean): string {
  return active
    ? 'rounded-full bg-[#3987e5] px-3 py-1.5 text-xs font-medium text-white shadow-[0_0_0_1px_rgba(57,135,229,0.4),0_0_16px_rgba(57,135,229,0.35)]'
    : 'rounded-full bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-[color:var(--color-ink-2)] ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.09] hover:text-[color:var(--color-ink-1)]'
}

export const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-[#3987e5] px-3.5 py-2 text-sm font-medium text-white shadow-[0_0_0_1px_rgba(57,135,229,0.4),0_8px_20px_-8px_rgba(57,135,229,0.6)] transition hover:bg-[#2f78cf] disabled:opacity-40 disabled:shadow-none'

export const btnGhost =
  'inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-[color:var(--color-ink-2)] transition hover:bg-white/[0.07] hover:text-[color:var(--color-ink-1)]'

export const btnGhostSm =
  'inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-[color:var(--color-ink-2)] transition hover:bg-white/[0.07] hover:text-[color:var(--color-ink-1)]'

export const iconBtn =
  'rounded-lg p-1.5 text-[color:var(--color-ink-3)] transition hover:bg-white/[0.07] hover:text-[color:var(--color-ink-1)]'
