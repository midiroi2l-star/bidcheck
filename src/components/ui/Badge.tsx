import { type ReactNode } from 'react'
import clsx from 'clsx'
import type { RiskLevel, ConnStatus, AlarmStatus } from '../../types'

const riskStyles: Record<RiskLevel, string> = {
  안전: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  주의: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  경고: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  위험: 'bg-red-50 text-red-700 ring-red-600/20',
}

const connStyles: Record<ConnStatus, string> = {
  정상: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  지연: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  장애: 'bg-red-50 text-red-700 ring-red-600/20',
}

const alarmStyles: Record<AlarmStatus, string> = {
  미확인: 'bg-red-50 text-red-700 ring-red-600/20',
  확인: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  처리중: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  처리완료: 'bg-slate-100 text-slate-600 ring-slate-500/20',
}

const genericStyles = 'bg-slate-100 text-slate-600 ring-slate-500/20'

const extraStyles: Record<string, string> = {
  성공: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  실패: 'bg-red-50 text-red-700 ring-red-600/20',
  가동중: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  운영중: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  정지: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  중단: 'bg-red-50 text-red-700 ring-red-600/20',
  점검중: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  발송완료: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  생성완료: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  예약됨: 'bg-slate-100 text-slate-600 ring-slate-500/20',
}

function styleFor(value: string): string {
  if (value in riskStyles) return riskStyles[value as RiskLevel]
  if (value in connStyles) return connStyles[value as ConnStatus]
  if (value in alarmStyles) return alarmStyles[value as AlarmStatus]
  if (value in extraStyles) return extraStyles[value]
  return genericStyles
}

export function Badge({ children, dot = false }: { children: ReactNode; dot?: boolean }) {
  const label = String(children)
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        styleFor(label),
      )}
    >
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', label === '정상' || label === '안전' ? 'bg-emerald-500' : label === '장애' || label === '위험' || label === '미확인' ? 'bg-red-500 pulse-dot' : 'bg-amber-500')} />}
      {children}
    </span>
  )
}
