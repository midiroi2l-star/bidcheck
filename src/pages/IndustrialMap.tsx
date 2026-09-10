import { useState } from 'react'
import { Flame, Wind, Thermometer, Droplets, Navigation } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { tenants } from '../data/tenants'
import { currentWeather } from '../data/publicData'
import type { RiskLevel } from '../types'

const LAT_MIN = 34.73
const LAT_MAX = 34.85
const LNG_MIN = 127.63
const LNG_MAX = 127.75

function project(lat: number, lng: number) {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * 100
  const y = 100 - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * 100
  return { x, y }
}

const riskFill: Record<RiskLevel, string> = {
  안전: '#10b981',
  주의: '#f59e0b',
  경고: '#f97316',
  위험: '#ef4444',
}

const safetyFacilities = [
  { id: 'F-1', name: '중앙 소방서', lat: 34.79, lng: 127.68 },
  { id: 'F-2', name: '산단 통합관제센터', lat: 34.775, lng: 127.705 },
  { id: 'F-3', name: '긴급의료 지원센터', lat: 34.805, lng: 127.665 },
]

const windRotation: Record<string, number> = {
  북: 0,
  북동: 45,
  동: 90,
  남동: 135,
  남: 180,
  남서: 225,
  서: 270,
  북서: 315,
}

export function IndustrialMap() {
  const [selected, setSelected] = useState(tenants[0])
  const [showWeather, setShowWeather] = useState(true)
  const [showFacilities, setShowFacilities] = useState(true)

  return (
    <div>
      <PageHeader
        title="여수산업단지 맵"
        description="국토부 공간정보 오픈플랫폼 연계(더미) 기반 수용가 위치, 기상 및 안전시설 오버레이"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" padded={false}>
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">여수 국가산업단지 공간지도</h3>
              <p className="mt-0.5 text-xs text-slate-500">수용가 좌표 · 경계 강조 표시</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowWeather((v) => !v)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                  showWeather
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                기상 오버레이
              </button>
              <button
                onClick={() => setShowFacilities((v) => !v)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                  showFacilities
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                안전시설 표시
              </button>
            </div>
          </div>

          <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-slate-100 via-emerald-50 to-sky-50">
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
              {Array.from({ length: 9 }, (_, i) => (
                <line key={`v${i}`} x1={i * 12.5} y1={0} x2={i * 12.5} y2={100} stroke="#cbd5e1" strokeWidth={0.15} />
              ))}
              {Array.from({ length: 9 }, (_, i) => (
                <line key={`h${i}`} x1={0} y1={i * 12.5} x2={100} y2={i * 12.5} stroke="#cbd5e1" strokeWidth={0.15} />
              ))}
              <path
                d="M -5 65 Q 20 55, 35 68 T 70 60 Q 90 55, 105 72 L 105 105 L -5 105 Z"
                fill="#bfdbfe"
                opacity={0.5}
              />
            </svg>

            {showFacilities &&
              safetyFacilities.map((f) => {
                const { x, y } = project(f.lat, f.lng)
                return (
                  <div
                    key={f.id}
                    className="group absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-blue-600 shadow ring-1 ring-blue-200">
                      <Flame size={13} />
                    </div>
                    <div className="pointer-events-none absolute left-1/2 top-7 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100">
                      {f.name}
                    </div>
                  </div>
                )
              })}

            {tenants.map((t) => {
              const { x, y } = project(t.lat, t.lng)
              const isSelected = selected.id === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  <span
                    className="absolute inset-0 -m-2 rounded-full opacity-30"
                    style={{
                      backgroundColor: riskFill[t.riskLevel],
                      display: t.riskLevel === '위험' || t.riskLevel === '경고' ? 'block' : 'none',
                    }}
                  />
                  <span
                    className="pulse-dot absolute inset-0 -m-2 rounded-full"
                    style={{
                      backgroundColor: riskFill[t.riskLevel],
                      opacity: t.riskLevel === '위험' ? 0.35 : 0,
                    }}
                  />
                  <span
                    className={`relative flex h-4 w-4 items-center justify-center rounded-full border-2 border-white shadow ${
                      isSelected ? 'ring-2 ring-offset-1 ring-blue-500' : ''
                    }`}
                    style={{ backgroundColor: riskFill[t.riskLevel] }}
                  />
                  <span className="absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 shadow ring-1 ring-slate-200">
                    {t.name.replace('(주)', '')}
                  </span>
                </button>
              )
            })}

            {showWeather && (
              <div className="absolute right-3 top-3 flex flex-col gap-1.5 rounded-lg bg-white/90 p-3 text-xs shadow ring-1 ring-slate-200 backdrop-blur">
                <p className="mb-1 font-semibold text-slate-700">여수지역 실시간 기상</p>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Thermometer size={13} className="text-orange-500" /> {currentWeather.temperature}°C
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Droplets size={13} className="text-blue-500" /> 습도 {currentWeather.humidity}%
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Wind size={13} className="text-slate-500" />
                  {currentWeather.windSpeed}m/s
                  <Navigation
                    size={12}
                    style={{ transform: `rotate(${windRotation[currentWeather.windDirection]}deg)` }}
                    className="text-slate-400"
                  />
                  {currentWeather.windDirection}풍
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 p-3 text-xs text-slate-500">
            <span className="font-medium text-slate-600">범례</span>
            {(['안전', '주의', '경고', '위험'] as RiskLevel[]).map((r) => (
              <span key={r} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: riskFill[r] }} />
                {r}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <Flame size={12} className="text-blue-600" /> 안전시설
            </span>
          </div>
        </Card>

        <Card>
          <CardHeader title="선택 수용가 정보" subtitle="지도에서 마커를 선택해 상세정보를 확인하세요" />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-slate-900">{selected.name}</h4>
              <Badge dot>{selected.riskLevel}</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-y-2 text-xs">
              <dt className="text-slate-400">업종</dt>
              <dd className="text-right text-slate-700">{selected.businessType}</dd>
              <dt className="text-slate-400">운영 상태</dt>
              <dd className="text-right text-slate-700">{selected.status}</dd>
              <dt className="text-slate-400">주소</dt>
              <dd className="text-right text-slate-700">{selected.address}</dd>
              <dt className="text-slate-400">담당자</dt>
              <dd className="text-right text-slate-700">{selected.contactName}</dd>
              <dt className="text-slate-400">연락처</dt>
              <dd className="text-right text-slate-700">{selected.contactPhone}</dd>
              <dt className="text-slate-400">설비 수</dt>
              <dd className="text-right text-slate-700">{selected.equipmentCount}대</dd>
              <dt className="text-slate-400">센서 수</dt>
              <dd className="text-right text-slate-700">{selected.sensorCount}개</dd>
              <dt className="text-slate-400">디지털트윈 연계</dt>
              <dd className="text-right text-slate-700">{selected.digitalTwinLinked ? '연계됨' : '미연계'}</dd>
              <dt className="text-slate-400">AI 예측 연계</dt>
              <dd className="text-right text-slate-700">{selected.aiPredictionLinked ? '연계됨' : '미연계'}</dd>
            </dl>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-semibold text-slate-600">전체 수용가</p>
            <div className="flex flex-col gap-1.5">
              {tenants.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                    selected.id === t.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <span className="truncate">{t.name}</span>
                  <Badge>{t.riskLevel}</Badge>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
