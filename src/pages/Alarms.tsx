import { useMemo, useState } from 'react'
import { Search, CheckCheck, Settings2, Power } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
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

      <div className="mb-4 flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setTab('list')}
          className={`px-3 pb-2.5 text-sm font-medium ${
            tab === 'list' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-500'
          }`}
        >
          경보 처리 현황
        </button>
        <button
          onClick={() => setTab('rules')}
          className={`px-3 pb-2.5 text-sm font-medium ${
            tab === 'rules' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-500'
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
                  statusFilter === k ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <p className="text-xs text-slate-500">{k}</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{counts[k]}</p>
              </button>
            ))}
          </div>

          <Card className="mt-4" padded={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
              <div className="flex items-center gap-2">
                {(['전체', '위험', '경고', '주의'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSeverityFilter(s)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      severityFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="수용가명, 메시지 검색"
                  className="rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-400"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">발생시각</th>
                    <th className="px-4 py-2.5 font-medium">수용가</th>
                    <th className="px-4 py-2.5 font-medium">설비</th>
                    <th className="px-4 py-2.5 font-medium">내용</th>
                    <th className="px-4 py-2.5 font-medium">심각도</th>
                    <th className="px-4 py-2.5 font-medium">담당자</th>
                    <th className="px-4 py-2.5 font-medium">상태</th>
                    <th className="px-4 py-2.5 font-medium text-right">처리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.slice(0, 40).map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDateTime(a.occurredAt)}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{a.tenantName}</td>
                      <td className="px-4 py-3 text-slate-600">{a.equipmentName}</td>
                      <td className="px-4 py-3 text-slate-600">{a.message}</td>
                      <td className="px-4 py-3">
                        <Badge>{a.severity}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{a.assignee ?? '-'}</td>
                      <td className="px-4 py-3">
                        <Badge dot>{a.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {a.status !== '처리완료' && (
                          <button
                            onClick={() => advance(a.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
                          >
                            <CheckCheck size={12} />
                            {a.status === '미확인' ? '확인 처리' : a.status === '확인' ? '처리 시작' : '완료 처리'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
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
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-500">
                <Settings2 size={13} /> 총 {rules.length}개 규칙
              </div>
            }
          />
          <div className="overflow-x-auto px-1">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">센서유형</th>
                  <th className="px-4 py-2.5 font-medium">적용 대상</th>
                  <th className="px-4 py-2.5 font-medium">주의 구간</th>
                  <th className="px-4 py-2.5 font-medium">위험 구간</th>
                  <th className="px-4 py-2.5 font-medium">심각도</th>
                  <th className="px-4 py-2.5 font-medium">알림 대상</th>
                  <th className="px-4 py-2.5 font-medium">사용 여부</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.sensorType}</td>
                    <td className="px-4 py-3 text-slate-600">{r.targetScope}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.warnMin} ~ {r.warnMax}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.dangerMin} ~ {r.dangerMax}
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{r.severity}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.notifyTargets.join(', ')}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleRule(r.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          r.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
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
          <p className="px-4 pb-4 pt-2 text-[11px] text-slate-400">
            ※ 임계값 초과 시 지정된 수신자에게 알림톡이 자동 발송되며, 미확인 경보는 종합 대시보드에 실시간 반영됩니다.
          </p>
        </Card>
      )}
    </div>
  )
}
