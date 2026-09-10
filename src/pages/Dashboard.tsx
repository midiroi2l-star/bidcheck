import { useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Building2, Cpu, AlertTriangle, Gauge } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { StatTile } from '../components/ui/StatTile'
import { Card, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { tenants } from '../data/tenants'
import { equipment } from '../data/equipment'
import { sensors } from '../data/sensors'
import { alarms } from '../data/alarms'
import { linkedSystems } from '../data/systems'
import { formatDateTime } from '../data/random'

const RISK_COLORS: Record<string, string> = {
  안전: '#10b981',
  주의: '#f59e0b',
  경고: '#f97316',
  위험: '#ef4444',
}

export function Dashboard() {
  const activeEquipment = equipment.filter((e) => e.status === '가동중').length
  const unresolvedAlarms = alarms.filter((a) => a.status === '미확인' || a.status === '확인' || a.status === '처리중')
  const avgUptime = (linkedSystems.reduce((s, l) => s + l.uptime, 0) / linkedSystems.length).toFixed(2)

  const riskDist = useMemo(() => {
    const counts: Record<string, number> = { 안전: 0, 주의: 0, 경고: 0, 위험: 0 }
    sensors.forEach((s) => (counts[s.status] += 1))
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [])

  const tenantRisk = useMemo(
    () =>
      tenants.map((t) => {
        const tSensors = sensors.filter((s) => s.tenantId === t.id)
        const danger = tSensors.filter((s) => s.status === '위험').length
        const warn = tSensors.filter((s) => s.status === '경고').length
        const caution = tSensors.filter((s) => s.status === '주의').length
        const safe = tSensors.filter((s) => s.status === '안전').length
        return { name: t.name.replace(/\(주\)/, ''), 안전: safe, 주의: caution, 경고: warn, 위험: danger }
      }),
    [],
  )

  const tempTrend = useMemo(() => {
    const tempSensors = sensors.filter((s) => s.type === '온도').slice(0, 4)
    const points = tempSensors[0]?.history.length ?? 0
    return Array.from({ length: points }, (_, i) => {
      const row: Record<string, string | number> = {
        time: new Date(tempSensors[0].history[i].timestamp).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      }
      tempSensors.forEach((s, idx) => {
        row[`설비${idx + 1}`] = s.history[i].value
      })
      return row
    })
  }, [])

  const recentAlarms = alarms.slice(0, 6)
  const tempLineColors = ['#2563eb', '#7c3aed', '#0d9488', '#d97706']

  return (
    <div>
      <PageHeader
        title="종합 안전관리 대시보드"
        description="디지털트윈·안전예측·안전관리지원 시스템 연계 정보를 단일 화면에서 종합적으로 확인합니다."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="등록 수요기업"
          value={tenants.length}
          unit="개사"
          icon={<Building2 size={18} />}
          tone="blue"
          trend={{ value: '최대 20개사까지 확장 가능', positive: true }}
        />
        <StatTile
          label="가동중 설비"
          value={activeEquipment}
          unit={`/ ${equipment.length}대`}
          icon={<Cpu size={18} />}
          tone="emerald"
        />
        <StatTile
          label="처리 필요 경보"
          value={unresolvedAlarms.length}
          unit="건"
          icon={<AlertTriangle size={18} />}
          tone="red"
          trend={{
            value: `미확인 ${alarms.filter((a) => a.status === '미확인').length}건 포함`,
            positive: false,
          }}
        />
        <StatTile
          label="연계 시스템 평균 가동률"
          value={avgUptime}
          unit="%"
          icon={<Gauge size={18} />}
          tone="amber"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="설비 온도 센서 추이 (최근 24시간)" subtitle="디지털트윈·AI 안전예측 연계 계측 데이터" />
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={tempTrend} margin={{ left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit="°C" />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {['설비1', '설비2', '설비3', '설비4'].map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={tempLineColors[i]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader title="센서 상태 분포" subtitle={`총 ${sensors.length}개 센서`} />
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie
                data={riskDist}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
              >
                {riskDist.map((d) => (
                  <Cell key={d.name} fill={RISK_COLORS[d.name]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {riskDist.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RISK_COLORS[d.name] }} />
                {d.name} {d.value}건
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="수요기업별 센서 상태 현황" subtitle="안전(정상) / 주의 / 경고 / 위험 단계별 집계" />
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={tenantRisk} margin={{ left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="안전" stackId="a" fill={RISK_COLORS['안전']} radius={[0, 0, 0, 0]} />
              <Bar dataKey="주의" stackId="a" fill={RISK_COLORS['주의']} />
              <Bar dataKey="경고" stackId="a" fill={RISK_COLORS['경고']} />
              <Bar dataKey="위험" stackId="a" fill={RISK_COLORS['위험']} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader title="최근 이상감지 알림" subtitle="실시간 경보 발생 현황" />
          <div className="flex flex-col divide-y divide-slate-100">
            {recentAlarms.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800">{a.tenantName}</p>
                  <p className="truncate text-xs text-slate-500">{a.message}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{formatDateTime(a.occurredAt)}</p>
                </div>
                <Badge dot>{a.severity}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
