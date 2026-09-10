import { useMemo, useState } from 'react'
import { CheckCircle2, Clock3, XCircle, Search } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { StatTile } from '../components/ui/StatTile'
import { Badge } from '../components/ui/Badge'
import { inputBase, filterPill } from '../components/ui/styles'
import * as t from '../components/ui/table'
import { linkedSystems } from '../data/systems'
import { formatDateTime } from '../data/random'
import type { LinkedSystem } from '../types'

const categories: LinkedSystem['category'][] = ['연동시스템', '공공데이터', '수요기업연계']

export function Monitoring() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'전체' | LinkedSystem['category']>('전체')

  const filtered = useMemo(
    () =>
      linkedSystems.filter((s) => {
        const matchesQuery =
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.owner.toLowerCase().includes(query.toLowerCase())
        const matchesCategory = category === '전체' || s.category === category
        return matchesQuery && matchesCategory
      }),
    [query, category],
  )

  const normal = linkedSystems.filter((s) => s.status === '정상').length
  const delayed = linkedSystems.filter((s) => s.status === '지연').length
  const failed = linkedSystems.filter((s) => s.status === '장애').length

  return (
    <div>
      <PageHeader
        title="연동 시스템 상태 모니터링"
        description="디지털트윈·AI안전예측·안전관리지원 시스템 및 공공데이터·수요기업 연계 통신상태를 실시간으로 확인합니다."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="정상 연계" value={normal} unit={`/ ${linkedSystems.length}`} icon={<CheckCircle2 size={18} />} tone="emerald" />
        <StatTile label="지연 발생" value={delayed} unit="건" icon={<Clock3 size={18} />} tone="amber" />
        <StatTile label="연계 장애" value={failed} unit="건" icon={<XCircle size={18} />} tone="red" />
      </div>

      <Card className="mt-4" padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] p-4">
          <div className="flex items-center gap-2">
            {(['전체', ...categories] as const).map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={filterPill(category === c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-[color:var(--color-ink-3)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="시스템명, 담당기관 검색"
              className={`${inputBase} pl-8`}
            />
          </div>
        </div>

        <div className={t.tableWrap}>
          <table className={`${t.table} min-w-[820px]`}>
            <thead className={t.thead}>
              <tr>
                <th className={t.th}>시스템명</th>
                <th className={t.th}>구분</th>
                <th className={t.th}>담당기관</th>
                <th className={t.th}>연계주기</th>
                <th className={t.th}>가동률</th>
                <th className={t.th}>응답속도</th>
                <th className={t.th}>최근 동기화</th>
                <th className={t.th}>상태</th>
              </tr>
            </thead>
            <tbody className={t.tbody}>
              {filtered.map((s) => (
                <tr key={s.id} className={t.tr}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[color:var(--color-ink-1)]">{s.name}</p>
                    <p className="mt-0.5 text-[11px] text-[color:var(--color-ink-3)]">{s.description}</p>
                  </td>
                  <td className={t.td}>{s.category}</td>
                  <td className={t.td}>{s.owner}</td>
                  <td className={t.td}>{s.syncCycle}</td>
                  <td className={`${t.td} tabular`}>{s.uptime}%</td>
                  <td className={`${t.td} tabular`}>{s.latencyMs}ms</td>
                  <td className={`${t.td} tabular`}>{formatDateTime(s.lastSync)}</td>
                  <td className={t.td}>
                    <Badge dot>{s.status}</Badge>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[color:var(--color-ink-3)]">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader title="API 전송 프로그램 규격 안내" subtitle="연동시스템 규격에 맞는 표준 인터페이스 모듈 운영 현황" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <p className="text-xs font-semibold text-[color:var(--color-ink-1)]">전송 프로토콜</p>
            <p className="mt-1 text-xs text-[color:var(--color-ink-3)]">REST API (JSON), MQTT (센서 실시간 스트림)</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <p className="text-xs font-semibold text-[color:var(--color-ink-1)]">인증 방식</p>
            <p className="mt-1 text-xs text-[color:var(--color-ink-3)]">OAuth2.0 Client Credentials + VPN 전용회선</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <p className="text-xs font-semibold text-[color:var(--color-ink-1)]">장애 처리</p>
            <p className="mt-1 text-xs text-[color:var(--color-ink-3)]">3회 재시도 후 통신 이상 이력 자동 저장 및 알림</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
