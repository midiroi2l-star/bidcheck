import { useMemo, useState } from 'react'
import { Search, ChevronDown, ChevronRight } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { equipment } from '../data/equipment'
import { sensors } from '../data/sensors'
import { tenants } from '../data/tenants'
import { formatDate, formatDateTime } from '../data/random'

export function Equipment() {
  const [query, setQuery] = useState('')
  const [tenantFilter, setTenantFilter] = useState('전체')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      equipment.filter((e) => {
        const tenant = tenants.find((t) => t.id === e.tenantId)
        const matchTenant = tenantFilter === '전체' || e.tenantId === tenantFilter
        const matchQuery =
          e.name.toLowerCase().includes(query.toLowerCase()) ||
          (tenant?.name ?? '').toLowerCase().includes(query.toLowerCase())
        return matchTenant && matchQuery
      }),
    [query, tenantFilter],
  )

  return (
    <div>
      <PageHeader
        title="설비·센서 기준정보 관리"
        description="수용가별 대상 설비 기준정보 및 부착 센서 메타정보를 관리하고 디지털트윈·AI 안전예측 시스템과 동기화합니다."
      />

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="flex items-center gap-2">
            <select
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-blue-400"
            >
              <option value="전체">전체 수요기업</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="설비명, 기업명 검색"
                className="w-56 rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            총 {filtered.length}대 · 센서 {sensors.filter((s) => filtered.some((e) => e.id === s.equipmentId)).length}개
          </p>
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.slice(0, 60).map((eq) => {
            const tenant = tenants.find((t) => t.id === eq.tenantId)
            const eqSensors = sensors.filter((s) => s.equipmentId === eq.id)
            const isOpen = expanded === eq.id
            return (
              <div key={eq.id}>
                <button
                  onClick={() => setExpanded(isOpen ? null : eq.id)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50/60"
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? (
                      <ChevronDown size={15} className="text-slate-400" />
                    ) : (
                      <ChevronRight size={15} className="text-slate-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-800">{eq.name}</p>
                      <p className="text-xs text-slate-400">
                        {tenant?.name} · {eq.location} · 설치일 {formatDate(eq.installedDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">센서 {eqSensors.length}개</span>
                    <Badge>{eq.status}</Badge>
                    <Badge dot>{eq.riskLevel}</Badge>
                  </div>
                </button>
                {isOpen && (
                  <div className="grid grid-cols-1 gap-3 bg-slate-50/70 px-4 pb-4 pt-1 sm:grid-cols-2 lg:grid-cols-3">
                    {eqSensors.map((s) => (
                      <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-700">{s.type} 센서</p>
                          <Badge dot>{s.status}</Badge>
                        </div>
                        <p className="mt-1.5 text-lg font-bold text-slate-900">
                          {s.currentValue}
                          <span className="ml-1 text-xs font-normal text-slate-400">{s.unit}</span>
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          주의 {s.thresholdWarnMin}~{s.thresholdWarnMax} · 위험 {s.thresholdDangerMin}+
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">갱신: {formatDateTime(s.lastUpdated)}</p>
                      </div>
                    ))}
                    {eqSensors.length === 0 && (
                      <p className="col-span-full py-3 text-xs text-slate-400">부착된 센서가 없습니다.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && <p className="px-4 py-10 text-center text-xs text-slate-400">검색 결과가 없습니다.</p>}
        </div>
      </Card>
    </div>
  )
}
