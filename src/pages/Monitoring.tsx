import { useMemo, useState } from 'react'
import { CheckCircle2, Clock3, XCircle, Search } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { StatTile } from '../components/ui/StatTile'
import { Badge } from '../components/ui/Badge'
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="flex items-center gap-2">
            {(['전체', ...categories] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  category === c ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="시스템명, 담당기관 검색"
              className="rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">시스템명</th>
                <th className="px-4 py-2.5 font-medium">구분</th>
                <th className="px-4 py-2.5 font-medium">담당기관</th>
                <th className="px-4 py-2.5 font-medium">연계주기</th>
                <th className="px-4 py-2.5 font-medium">가동률</th>
                <th className="px-4 py-2.5 font-medium">응답속도</th>
                <th className="px-4 py-2.5 font-medium">최근 동기화</th>
                <th className="px-4 py-2.5 font-medium">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{s.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{s.description}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.category}</td>
                  <td className="px-4 py-3 text-slate-600">{s.owner}</td>
                  <td className="px-4 py-3 text-slate-600">{s.syncCycle}</td>
                  <td className="px-4 py-3 text-slate-600">{s.uptime}%</td>
                  <td className="px-4 py-3 text-slate-600">{s.latencyMs}ms</td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(s.lastSync)}</td>
                  <td className="px-4 py-3">
                    <Badge dot>{s.status}</Badge>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
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
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-700">전송 프로토콜</p>
            <p className="mt-1 text-xs text-slate-500">REST API (JSON), MQTT (센서 실시간 스트림)</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-700">인증 방식</p>
            <p className="mt-1 text-xs text-slate-500">OAuth2.0 Client Credentials + VPN 전용회선</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-700">장애 처리</p>
            <p className="mt-1 text-xs text-slate-500">3회 재시도 후 통신 이상 이력 자동 저장 및 알림</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
