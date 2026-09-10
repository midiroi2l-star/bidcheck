import { useMemo, useState } from 'react'
import { Search, CheckCheck, Settings2, Power } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { inputBase, filterPill, btnGhostSm } from '../components/ui/styles'
import * as tb from '../components/ui/table'
import { alarms as initialAlarms, alarmRules as initialRules } from '../data/alarms'
import { formatDateTime } from '../data/random'
import type { Alarm, AlarmRule, AlarmStatus } from '../types'

const statusFlow: Record<AlarmStatus, AlarmStatus> = {
  미확인: '확인',
  확인: '처리중',
  처리중: '처리완료',
  처리완료: '처리완료',
}

export function Alarms() {
  const [tab, setTab] = useState<'list' | 'rules'>('list')
  const [alarms, setAlarms] = useState<Alarm[]>(initialAlarms)
  const [rules, setRules] = useState<AlarmRule[]>(initialRules)
  const [severityFilter, setSeverityFilter] = useState<'전체' | Alarm['severity']>('전체')
  const [statusFilter, setStatusFilter] = useState<'전체' | AlarmStatus>('전체')
  const [query, setQuery] = useState('')

  const filtered = useMemo(
    () =>
      alarms.filter((a) => {
        const matchSeverity = severityFilter === '전체' || a.severity === severityFilter
        const matchStatus = statusFilter === '전체' || a.status === statusFilter
        const matchQuery =
          a.tenantName.toLowerCase().includes(query.toLowerCase()) ||
          a.message.toLowerCase().includes(query.toLowerCase())
        return matchSeverity && matchStatus && matchQuery
      }),
    [alarms, severityFilter, statusFilter, query],
  )

  function advance(id: string) {
    setAlarms((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: statusFlow[a.status], assignee: a.assignee ?? '관리자' }
          : a,
      ),
    )
  }

  function toggleRule(id: string) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)))
  }

  const counts = {
    미확인: alarms.filter((a) => a.status === '미확인').length,
    확인: alarms.filter((a) => a.status === '확인').length,
    처리중: alarms.filter((a) => a.status === '처리중').length,
    처리완료: alarms.filter((a) => a.status === '처리완료').length,
  }

  return (
    <div>
      <PageHeader
        title="이상감지·경보 관리"
        description="임계값 초과 및 외부 연계 시스템 경보를 실시간으로 확인·처리하고 경보 규칙을 관리합니다."
      />

      <div className="mb-4 flex gap-2 border-b border-white/[0.08]">
        <button
          onClick={() => setTab('list')}
          className={`px-3 pb-2.5 text-sm font-medium transition ${
            tab === 'list'
              ? 'border-b-2 border-[#3987e5] text-[color:var(--color-ink-1)]'
              : 'text-[color:var(--color-ink-3)] hover:text-[color:var(--color-ink-2)]'
          }`}
        >
          경보 처리 현황
        </button>
        <button
          onClick={() => setTab('rules')}
          className={`px-3 pb-2.5 text-sm font-medium transition ${
            tab === 'rules'
              ? 'border-b-2 border-[#3987e5] text-[color:var(--color-ink-1)]'
              : 'text-[color:var(--color-ink-3)] hover:text-[color:var(--color-ink-2)]'
          }`}
        >
          경보 규칙 관리
        </button>
      </div>

      {tab === 'list' ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(Object.keys(counts) as AlarmStatus[]).map((k) => (
              <button
                key={k}
                onClick={() => setStatusFilter(statusFilter === k ? '전체' : k)}
                className={`rounded-xl border p-3 text-left transition ${
                  statusFilter === k
                    ? 'border-[#3987e5]/50 bg-[#3987e5]/10'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                }`}
              >
                <p className="text-xs text-[color:var(--color-ink-3)]">{k}</p>
                <p className="tabular mt-1 text-lg font-bold text-[color:var(--color-ink-1)]">{counts[k]}</p>
              </button>
            ))}
          </div>

          <Card className="mt-4" padded={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] p-4">
              <div className="flex items-center gap-2">
                {(['전체', '위험', '경고', '주의'] as const).map((s) => (
                  <button key={s} onClick={() => setSeverityFilter(s)} className={filterPill(severityFilter === s)}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-[color:var(--color-ink-3)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="수용가명, 메시지 검색"
                  className={`${inputBase} pl-8`}
                />
              </div>
            </div>

            <div className={tb.tableWrap}>
              <table className={`${tb.table} min-w-[900px]`}>
                <thead className={tb.thead}>
                  <tr>
                    <th className={tb.th}>발생시각</th>
                    <th className={tb.th}>수용가</th>
                    <th className={tb.th}>설비</th>
                    <th className={tb.th}>내용</th>
                    <th className={tb.th}>심각도</th>
                    <th className={tb.th}>담당자</th>
                    <th className={tb.th}>상태</th>
                    <th className={`${tb.th} text-right`}>처리</th>
                  </tr>
                </thead>
                <tbody className={tb.tbody}>
                  {filtered.slice(0, 40).map((a) => (
                    <tr key={a.id} className={tb.tr}>
                      <td className={`${tb.td} tabular whitespace-nowrap`}>{formatDateTime(a.occurredAt)}</td>
                      <td className={tb.tdStrong}>{a.tenantName}</td>
                      <td className={tb.td}>{a.equipmentName}</td>
                      <td className={tb.td}>{a.message}</td>
                      <td className={tb.td}>
                        <Badge>{a.severity}</Badge>
                      </td>
                      <td className={tb.td}>{a.assignee ?? '-'}</td>
                      <td className={tb.td}>
                        <Badge dot>{a.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {a.status !== '처리완료' && (
                          <button onClick={() => advance(a.id)} className={btnGhostSm}>
                            <CheckCheck size={12} />
                            {a.status === '미확인' ? '확인 처리' : a.status === '확인' ? '처리 시작' : '완료 처리'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-[color:var(--color-ink-3)]">
                        조건에 맞는 경보가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <Card padded={false}>
          <CardHeader
            title="설비·센서별 경보 발생 임계값"
            subtitle="센서 데이터가 임계값을 초과하면 실시간 경보 이벤트가 생성됩니다"
            action={
              <div className="flex items-center gap-1 rounded-lg bg-white/[0.05] px-2.5 py-1.5 text-xs text-[color:var(--color-ink-3)]">
                <Settings2 size={13} /> 총 {rules.length}개 규칙
              </div>
            }
          />
          <div className="overflow-x-auto px-1">
            <table className={`${tb.table} min-w-[900px]`}>
              <thead className={tb.thead}>
                <tr>
                  <th className={tb.th}>센서유형</th>
                  <th className={tb.th}>적용 대상</th>
                  <th className={tb.th}>주의 구간</th>
                  <th className={tb.th}>위험 구간</th>
                  <th className={tb.th}>심각도</th>
                  <th className={tb.th}>알림 대상</th>
                  <th className={tb.th}>사용 여부</th>
                </tr>
              </thead>
              <tbody className={tb.tbody}>
                {rules.map((r) => (
                  <tr key={r.id} className={tb.tr}>
                    <td className={tb.tdStrong}>{r.sensorType}</td>
                    <td className={tb.td}>{r.targetScope}</td>
                    <td className={`${tb.td} tabular`}>
                      {r.warnMin} ~ {r.warnMax}
                    </td>
                    <td className={`${tb.td} tabular`}>
                      {r.dangerMin} ~ {r.dangerMax}
                    </td>
                    <td className={tb.td}>
                      <Badge>{r.severity}</Badge>
                    </td>
                    <td className={tb.td}>{r.notifyTargets.join(', ')}</td>
                    <td className={tb.td}>
                      <button
                        onClick={() => toggleRule(r.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${
                          r.enabled
                            ? 'bg-[#0ca30c]/15 text-[#3ddb3d] ring-[#0ca30c]/30'
                            : 'bg-white/[0.05] text-[color:var(--color-ink-3)] ring-white/10'
                        }`}
                      >
                        <Power size={12} />
                        {r.enabled ? '사용' : '중지'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 pb-4 pt-2 text-[11px] text-[color:var(--color-ink-3)]">
            ※ 임계값 초과 시 지정된 수신자에게 알림톡이 자동 발송되며, 미확인 경보는 종합 대시보드에 실시간 반영됩니다.
          </p>
        </Card>
      )}
    </div>
  )
}
