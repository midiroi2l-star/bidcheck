import { useMemo } from 'react'
import { motion } from 'framer-motion'
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
import { Building2, Cpu, AlertTriangle, Gauge as GaugeIcon } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { StatTile } from '../components/ui/StatTile'
import { Card, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Gauge } from '../components/ui/Gauge'
import { ChartTooltip, chartGrid, chartAxisTick } from '../components/charts/ChartTooltip'
import { tenants } from '../data/tenants'
import { equipment } from '../data/equipment'
import { sensors } from '../data/sensors'
import { alarms } from '../data/alarms'
import { linkedSystems } from '../data/systems'
import { formatDateTime } from '../data/random'

const RISK_COLORS: Record<string, string> = {
  안전: '#0ca30c',
  주의: '#fab219',
  경고: '#ec835a',
  위험: '#d03b3b',
}

const CAT_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181']

export function Dashboard() {
  const activeEquipment = equipment.filter((e) => e.status === '가동중').length
  const unresolvedAlarms = alarms.filter((a) => a.status === '미확인' || a.status === '확인' || a.status === '처리중')
  const avgUptime = linkedSystems.reduce((s, l) => s + l.uptime, 0) / linkedSystems.length

  const alarmSparkline = useMemo(() => {
    const buckets = Array(12).fill(0)
    const now = Date.now()
    alarms.forEach((a) => {
      const ageHours = (now - new Date(a.occurredAt).getTime()) / 3_600_000
      if (ageHours >= 0 && ageHours < 24) {
        const idx = 11 - Math.floor(ageHours / 2)
        if (idx >= 0 && idx < 12) buckets[idx] += 1
      }
    })
    return buckets
  }, [])

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
          sparkline={alarmSparkline}
          sparklineColor="#ff6b6b"
          trend={{
            value: `미확인 ${alarms.filter((a) => a.status === '미확인').length}건 포함`,
            positive: false,
          }}
        />
        <StatTile
          label="연계 시스템 평균 가동률"
          value={avgUptime}
          unit="%"
          decimals={2}
          icon={<Gauge value={avgUptime} size={34} strokeWidth={4} color="#ffc94d" label="" />}
          tone="amber"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="설비 온도 센서 추이 (최근 24시간)" subtitle="디지털트윈·AI 안전예측 연계 계측 데이터" />
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={tempTrend} margin={{ left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid.stroke} vertical={false} />
              <XAxis dataKey="time" tick={chartAxisTick} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
              <YAxis tick={chartAxisTick} unit="°C" axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#aab2c8' }} />
              {['설비1', '설비2', '설비3', '설비4'].map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={CAT_COLORS[i]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
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
                paddingAngle={3}
                stroke="none"
              >
                {riskDist.map((d) => (
                  <Cell key={d.name} fill={RISK_COLORS[d.name]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {riskDist.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs text-[color:var(--color-ink-2)]">
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
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid.stroke} vertical={false} />
              <XAxis dataKey="name" tick={chartAxisTick} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
              <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#aab2c8' }} />
              <Bar dataKey="안전" stackId="a" fill={RISK_COLORS['안전']} />
              <Bar dataKey="주의" stackId="a" fill={RISK_COLORS['주의']} />
              <Bar dataKey="경고" stackId="a" fill={RISK_COLORS['경고']} />
              <Bar dataKey="위험" stackId="a" fill={RISK_COLORS['위험']} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader title="최근 이상감지 알림" subtitle="실시간 경보 발생 현황" />
          <div className="flex flex-col divide-y divide-white/[0.06]">
            {recentAlarms.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className="flex items-start justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[color:var(--color-ink-1)]">{a.tenantName}</p>
                  <p className="truncate text-xs text-[color:var(--color-ink-3)]">{a.message}</p>
                  <p className="tabular mt-0.5 text-[11px] text-[color:var(--color-ink-3)]">{formatDateTime(a.occurredAt)}</p>
                </div>
                <Badge dot>{a.severity}</Badge>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4">
          <GaugeIcon size={22} className="text-[#7ab1f2]" />
          <div>
            <p className="text-xs text-[color:var(--color-ink-3)]">평균 응답속도</p>
            <p className="tabular text-lg font-bold text-[color:var(--color-ink-1)]">
              {Math.round(linkedSystems.reduce((s, l) => s + l.latencyMs, 0) / linkedSystems.length)}ms
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <Building2 size={22} className="text-[#3ddb3d]" />
          <div>
            <p className="text-xs text-[color:var(--color-ink-3)]">전체 설비/센서</p>
            <p className="tabular text-lg font-bold text-[color:var(--color-ink-1)]">
              {equipment.length}대 / {sensors.length}개
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <AlertTriangle size={22} className="text-[#ffc94d]" />
          <div>
            <p className="text-xs text-[color:var(--color-ink-3)]">오늘 처리 완료 경보</p>
            <p className="tabular text-lg font-bold text-[color:var(--color-ink-1)]">
              {alarms.filter((a) => a.status === '처리완료').length}건
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
