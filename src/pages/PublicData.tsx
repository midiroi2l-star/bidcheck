import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from 'recharts'
import { Flame, AlertOctagon, CloudRain, FlaskConical } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { ChartTooltip, chartGrid, chartAxisTick } from '../components/charts/ChartTooltip'
import {
  weatherHourly,
  fireIncidents,
  disasterAlerts,
  industryAccidentStats,
  chemicalSafetyNotices,
} from '../data/publicData'
import { formatDateTime } from '../data/random'

const levelBadge: Record<string, string> = {
  안전안내: 'bg-[#3987e5]/15 text-[#7ab1f2] ring-[#3987e5]/30',
  주의보: 'bg-[#fab219]/15 text-[#ffc94d] ring-[#fab219]/30',
  경보: 'bg-[#d03b3b]/15 text-[#ff6b6b] ring-[#d03b3b]/35',
}

export function PublicData() {
  return (
    <div>
      <PageHeader
        title="공공데이터 연계"
        description="기상청·소방청·행안부·환경부·안전보건공단 개방형 데이터를 수집하여 공통 데이터 모델로 변환·연계한 현황입니다."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="여수지역 24시간 기상 추이" subtitle="기상청 기상정보시스템 연계 (기온 · 강수량)" />
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={weatherHourly} margin={{ left: -12 }}>
              <defs>
                <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ec835a" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ec835a" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3987e5" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#3987e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid.stroke} vertical={false} />
              <XAxis dataKey="time" tick={chartAxisTick} interval={2} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
              <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
              <Area type="monotone" dataKey="temperature" name="기온(°C)" stroke="#ec835a" fill="url(#tempGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="precipitation" name="강수량(mm)" stroke="#3987e5" fill="url(#rainGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader title="재난 발령 현황" subtitle="행정안전부 국가재난관리시스템 연계" />
          <div className="flex flex-col gap-3">
            {disasterAlerts.map((d) => (
              <div key={d.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[color:var(--color-ink-1)]">{d.type}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${levelBadge[d.level]}`}>
                    {d.level}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[color:var(--color-ink-2)]">{d.message}</p>
                <p className="tabular mt-1 text-[11px] text-[color:var(--color-ink-3)]">
                  {d.region} · {formatDateTime(d.issuedAt)}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="여수 지역 화재 발생 현황"
            subtitle="소방청 국가화재정보시스템 · 119 출동 현황 연계"
            action={<Flame size={16} className="text-[#ec835a]" />}
          />
          <div className="flex flex-col divide-y divide-white/[0.06]">
            {fireIncidents.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-[color:var(--color-ink-1)]">{f.location}</p>
                  <p className="text-[11px] text-[color:var(--color-ink-3)]">
                    {f.type} · 출동 {f.dispatchedUnits}대 · {formatDateTime(f.occurredAt)}
                  </p>
                </div>
                <Badge>{f.status}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="업종별 재해율 비교"
            subtitle="산재예방정보시스템 · 업종별 산업재해 통계 연계"
            action={<AlertOctagon size={16} className="text-[#ff6b6b]" />}
          />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={industryAccidentStats} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid.stroke} horizontal={false} />
              <XAxis type="number" tick={chartAxisTick} unit="%" axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="industry" tick={chartAxisTick} width={80} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#aab2c8' }} />
              <Bar dataKey="companyRate" name="산단 평균" fill="#3987e5" radius={[0, 4, 4, 0]} />
              <Bar dataKey="industryAvgRate" name="전국 업종 평균" fill="#3a4260" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="유해화학물질 안전정보"
          subtitle="환경부 화학물질안전원 연계 · 위험성 및 사고대응 절차 참조"
          action={<FlaskConical size={16} className="text-[#d55181]" />}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {chemicalSafetyNotices.map((c) => (
            <div key={c.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <p className="text-xs font-semibold text-[color:var(--color-ink-1)]">{c.substance}</p>
              <p className="mt-1.5 text-[11px] text-[color:var(--color-ink-2)]">
                <span className="font-medium text-[color:var(--color-ink-1)]">위험정보 </span>
                {c.riskInfo}
              </p>
              <p className="mt-1 text-[11px] text-[color:var(--color-ink-2)]">
                <span className="font-medium text-[color:var(--color-ink-1)]">대응절차 </span>
                {c.responseGuide}
              </p>
            </div>
          ))}
        </div>
      </Card>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[color:var(--color-ink-3)]">
        <CloudRain size={12} /> 본 데이터는 공공데이터 연계 기능 시연을 위한 더미 데이터이며 실제 관측값이 아닙니다.
      </p>
    </div>
  )
}
