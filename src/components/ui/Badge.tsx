import { type ReactNode } from 'react'
import clsx from 'clsx'
import type { RiskLevel, ConnStatus, AlarmStatus } from '../../types'

// 상태 팔레트 (dataviz 스킬 status palette 고정값): good/warning/serious/critical
const riskStyles: Record<RiskLevel, string> = {
  안전: 'bg-[#0ca30c]/15 text-[#3ddb3d] ring-[#0ca30c]/30',
  주의: 'bg-[#fab219]/15 text-[#ffc94d] ring-[#fab219]/30',
  경고: 'bg-[#ec835a]/15 text-[#ff9d76] ring-[#ec835a]/35',
  위험: 'bg-[#d03b3b]/15 text-[#ff6b6b] ring-[#d03b3b]/35',
}

const connStyles: Record<ConnStatus, string> = {
  정상: 'bg-[#0ca30c]/15 text-[#3ddb3d] ring-[#0ca30c]/30',
  지연: 'bg-[#fab219]/15 text-[#ffc94d] ring-[#fab219]/30',
  장애: 'bg-[#d03b3b]/15 text-[#ff6b6b] ring-[#d03b3b]/35',
}

const alarmStyles: Record<AlarmStatus, string> = {
  미확인: 'bg-[#d03b3b]/15 text-[#ff6b6b] ring-[#d03b3b]/35',
  확인: 'bg-[#fab219]/15 text-[#ffc94d] ring-[#fab219]/30',
  처리중: 'bg-[#3987e5]/15 text-[#7ab1f2] ring-[#3987e5]/35',
  처리완료: 'bg-white/[0.06] text-[color:var(--color-ink-2)] ring-white/10',
}

const genericStyles = 'bg-white/[0.06] text-[color:var(--color-ink-2)] ring-white/10'

const extraStyles: Record<string, string> = {
  성공: 'bg-[#0ca30c]/15 text-[#3ddb3d] ring-[#0ca30c]/30',
  실패: 'bg-[#d03b3b]/15 text-[#ff6b6b] ring-[#d03b3b]/35',
  가동중: 'bg-[#0ca30c]/15 text-[#3ddb3d] ring-[#0ca30c]/30',
  운영중: 'bg-[#0ca30c]/15 text-[#3ddb3d] ring-[#0ca30c]/30',
  정지: 'bg-white/[0.06] text-[color:var(--color-ink-2)] ring-white/10',
  중단: 'bg-[#d03b3b]/15 text-[#ff6b6b] ring-[#d03b3b]/35',
  점검중: 'bg-[#fab219]/15 text-[#ffc94d] ring-[#fab219]/30',
  발송완료: 'bg-[#0ca30c]/15 text-[#3ddb3d] ring-[#0ca30c]/30',
  생성완료: 'bg-[#3987e5]/15 text-[#7ab1f2] ring-[#3987e5]/35',
  예약됨: 'bg-white/[0.06] text-[color:var(--color-ink-2)] ring-white/10',
}

const dotColor: Record<string, string> = {
  안전: '#0ca30c', 정상: '#0ca30c', 성공: '#0ca30c', 가동중: '#0ca30c', 운영중: '#0ca30c', 발송완료: '#0ca30c',
  주의: '#fab219', 지연: '#fab219', 확인: '#fab219', 점검중: '#fab219',
  경고: '#ec835a',
  위험: '#d03b3b', 장애: '#d03b3b', 미확인: '#d03b3b', 실패: '#d03b3b', 중단: '#d03b3b',
  처리중: '#3987e5', 생성완료: '#3987e5',
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
  const isPulse = label === '위험' || label === '장애' || label === '미확인'
  const color = dotColor[label]
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        styleFor(label),
      )}
    >
      {dot && color && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {isPulse && (
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
              style={{ backgroundColor: color }}
            />
          )}
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        </span>
      )}
      {children}
    </span>
  )
}
