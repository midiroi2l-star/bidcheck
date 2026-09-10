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
import {
  weatherHourly,
  fireIncidents,
  disasterAlerts,
  industryAccidentStats,
  chemicalSafetyNotices,
} from '../data/publicData'
import { formatDateTime } from '../data/random'

const levelBadge: Record<string, string> = {
  안전안내: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  주의보: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  경보: 'bg-red-50 text-red-700 ring-red-600/20',
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
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} interval={2} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Area type="monotone" dataKey="temperature" name="기온(°C)" stroke="#f97316" fill="url(#tempGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="precipitation" name="강수량(mm)" stroke="#2563eb" fill="url(#rainGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader title="재난 발령 현황" subtitle="행정안전부 국가재난관리시스템 연계" />
          <div className="flex flex-col gap-3">
            {disasterAlerts.map((d) => (
              <div key={d.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-800">{d.type}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${levelBadge[d.level]}`}>
                    {d.level}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{d.message}</p>
                <p className="mt-1 text-[11px] text-slate-400">
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
            action={<Flame size={16} className="text-orange-500" />}
          />
          <div className="flex flex-col divide-y divide-slate-100">
            {fireIncidents.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800">{f.location}</p>
                  <p className="text-[11px] text-slate-500">
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
            action={<AlertOctagon size={16} className="text-red-500" />}
          />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={industryAccidentStats} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} unit="%" />
              <YAxis type="category" dataKey="industry" tick={{ fontSize: 11, fill: '#64748b' }} width={80} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="companyRate" name="산단 평균" fill="#2563eb" radius={[0, 4, 4, 0]} />
              <Bar dataKey="industryAvgRate" name="전국 업종 평균" fill="#cbd5e1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="유해화학물질 안전정보"
          subtitle="환경부 화학물질안전원 연계 · 위험성 및 사고대응 절차 참조"
          action={<FlaskConical size={16} className="text-purple-500" />}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {chemicalSafetyNotices.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-800">{c.substance}</p>
              <p className="mt-1.5 text-[11px] text-slate-500">
                <span className="font-medium text-slate-600">위험정보 </span>
                {c.riskInfo}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                <span className="font-medium text-slate-600">대응절차 </span>
                {c.responseGuide}
              </p>
            </div>
          ))}
        </div>
      </Card>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
        <CloudRain size={12} /> 본 데이터는 공공데이터 연계 기능 시연을 위한 더미 데이터이며 실제 관측값이 아닙니다.
      </p>
    </div>
  )
}
