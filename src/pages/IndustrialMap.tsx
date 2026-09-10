import { useEffect, useRef, useState } from 'react'
import { Map as MapLibreMap, Marker, NavigationControl } from 'maplibre-gl'
import { Flame, Wind, Thermometer, Droplets, Navigation, Layers, WifiOff } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { tenants } from '../data/tenants'
import { currentWeather } from '../data/publicData'
import type { RiskLevel, Tenant } from '../types'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const YEOSU_CENTER: [number, number] = [127.685, 34.785]
const MAP_LOAD_TIMEOUT_MS = 7000

const riskFill: Record<RiskLevel, string> = {
  안전: '#0ca30c',
  주의: '#fab219',
  경고: '#ec835a',
  위험: '#d03b3b',
}

const safetyFacilities = [
  { id: 'F-1', name: '중앙 소방서', lat: 34.79, lng: 127.68 },
  { id: 'F-2', name: '산단 통합관제센터', lat: 34.775, lng: 127.705 },
  { id: 'F-3', name: '긴급의료 지원센터', lat: 34.805, lng: 127.665 },
]

const windRotation: Record<string, number> = {
  북: 0, 북동: 45, 동: 90, 남동: 135, 남: 180, 남서: 225, 서: 270, 북서: 315,
}

function buildMarkerEl(tenant: Tenant, isSelected: boolean): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'group relative cursor-pointer'
  el.innerHTML = `
    <div class="relative flex items-center justify-center">
      ${
        tenant.riskLevel === '위험' || tenant.riskLevel === '경고'
          ? `<span class="absolute h-9 w-9 rounded-full opacity-40" style="background:${riskFill[tenant.riskLevel]};animation:pulse-ring 1.8s cubic-bezier(0.2,0.6,0.4,1) infinite"></span>`
          : ''
      }
      <span class="relative flex items-center justify-center rounded-full border-2 border-white/90 shadow-lg transition-transform group-hover:scale-110"
        style="width:${isSelected ? 20 : 15}px;height:${isSelected ? 20 : 15}px;background:${riskFill[tenant.riskLevel]};box-shadow:0 0 0 ${isSelected ? 4 : 0}px rgba(255,255,255,0.15), 0 2px 10px rgba(0,0,0,0.5);"></span>
    </div>
    <div class="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#141a2b]/95 px-2 py-1 text-[10px] font-medium text-white shadow-lg ring-1 ring-white/10 opacity-0 transition-opacity group-hover:opacity-100">
      ${tenant.name.replace('(주)', '')}
    </div>
  `
  return el
}

// 여수산단 좌표 범위 -> SVG viewBox(0~100) 투영 (자체 제작 지도 폴백용)
const LAT_MIN = 34.73
const LAT_MAX = 34.85
const LNG_MIN = 127.63
const LNG_MAX = 127.75

function project(lat: number, lng: number) {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * 100
  const y = 100 - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * 100
  return { x, y }
}

type MapState = 'loading' | 'ready' | 'error'

export function IndustrialMap() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Record<string, Marker>>({})
  const loadedRef = useRef(false)
  const [selected, setSelected] = useState<Tenant>(tenants[0])
  const [showWeather, setShowWeather] = useState(true)
  const [showFacilities, setShowFacilities] = useState(true)
  const [mapState, setMapState] = useState<MapState>('loading')

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const timeout = window.setTimeout(() => {
      if (!loadedRef.current) setMapState('error')
    }, MAP_LOAD_TIMEOUT_MS)

    let map: MapLibreMap
    try {
      map = new MapLibreMap({
        container: mapContainer.current,
        style: MAP_STYLE,
        center: YEOSU_CENTER,
        zoom: 12.4,
        pitch: 35,
        attributionControl: { compact: true },
      })
    } catch {
      setMapState('error')
      return
    }
    map.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-right')
    map.on('load', () => {
      loadedRef.current = true
      window.clearTimeout(timeout)
      setMapState('ready')
    })
    // 초기 스타일 로딩 실패(fatal)만 폴백으로 처리 — 로드 완료 후 발생하는
    // 개별 타일/스프라이트 등의 non-fatal 오류는 지도를 계속 사용 가능하므로 무시
    map.on('error', () => {
      if (!loadedRef.current) {
        window.clearTimeout(timeout)
        setMapState('error')
      }
    })
    mapRef.current = map

    return () => {
      window.clearTimeout(timeout)
      map.remove()
      mapRef.current = null
      markersRef.current = {}
    }
  }, [])

  // 수용가 마커 렌더링/갱신
  useEffect(() => {
    const map = mapRef.current
    if (!map || mapState !== 'ready') return

    tenants.forEach((t) => {
      const existing = markersRef.current[t.id]
      if (existing) existing.remove()
      const el = buildMarkerEl(t, selected.id === t.id)
      el.addEventListener('click', () => setSelected(t))
      const marker = new Marker({ element: el, anchor: 'center' })
        .setLngLat([t.lng, t.lat])
        .addTo(map)
      markersRef.current[t.id] = marker
    })

    return () => {
      Object.values(markersRef.current).forEach((m) => m.remove())
      markersRef.current = {}
    }
  }, [mapState, selected.id])

  // 안전시설 마커
  useEffect(() => {
    const map = mapRef.current
    if (!map || mapState !== 'ready') return
    const markers: Marker[] = []
    if (showFacilities) {
      safetyFacilities.forEach((f) => {
        const el = document.createElement('div')
        el.className = 'group relative cursor-pointer'
        el.innerHTML = `
          <div class="flex h-7 w-7 items-center justify-center rounded-full bg-[#141a2b] text-[#7ab1f2] shadow-lg ring-1 ring-[#3987e5]/50">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
          </div>
          <div class="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#141a2b]/95 px-2 py-1 text-[10px] font-medium text-white shadow-lg ring-1 ring-white/10 opacity-0 transition-opacity group-hover:opacity-100">
            ${f.name}
          </div>
        `
        const marker = new Marker({ element: el, anchor: 'center' }).setLngLat([f.lng, f.lat]).addTo(map)
        markers.push(marker)
      })
    }
    return () => markers.forEach((m) => m.remove())
  }, [mapState, showFacilities])

  function focusTenant(t: Tenant) {
    setSelected(t)
    if (mapState === 'ready') {
      mapRef.current?.flyTo({ center: [t.lng, t.lat], zoom: 14.2, duration: 900 })
    }
  }

  return (
    <div>
      <PageHeader
        title="여수산업단지 맵"
        description="국토부 공간정보 오픈플랫폼 연계(더미) 기반 수용가 위치, 기상 및 안전시설 오버레이 — OpenStreetMap 기반 실시간 지도"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" padded={false}>
          <div className="flex items-center justify-between border-b border-white/[0.06] p-4">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-[#7ab1f2]" />
              <div>
                <h3 className="text-sm font-semibold text-[color:var(--color-ink-1)]">여수 국가산업단지 공간지도</h3>
                <p className="mt-0.5 text-xs text-[color:var(--color-ink-3)]">
                  수용가 좌표 · 경계 강조 표시
                  {mapState === 'error' && ' (오프라인 지도로 표시 중)'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowWeather((v) => !v)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                  showWeather
                    ? 'border-[#3987e5]/50 bg-[#3987e5]/15 text-[#7ab1f2]'
                    : 'border-white/10 text-[color:var(--color-ink-3)] hover:bg-white/[0.05]'
                }`}
              >
                기상 오버레이
              </button>
              <button
                onClick={() => setShowFacilities((v) => !v)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                  showFacilities
                    ? 'border-[#3987e5]/50 bg-[#3987e5]/15 text-[#7ab1f2]'
                    : 'border-white/10 text-[color:var(--color-ink-3)] hover:bg-white/[0.05]'
                }`}
              >
                안전시설 표시
              </button>
            </div>
          </div>

          <div className="relative h-[560px] w-full overflow-hidden">
            {/* MapLibre 실제 지도 (성공 시 표시) */}
            <div ref={mapContainer} className={`absolute inset-0 ${mapState === 'ready' ? '' : 'invisible'}`} />

            {mapState === 'loading' && <div className="skeleton absolute inset-0" />}

            {mapState === 'error' && (
              <FallbackSvgMap selected={selected} onSelect={setSelected} showFacilities={showFacilities} />
            )}

            {showWeather && mapState !== 'loading' && (
              <div className="glass-panel absolute right-3 top-3 flex flex-col gap-1.5 rounded-xl p-3 text-xs shadow-xl">
                <p className="mb-1 font-semibold text-[color:var(--color-ink-1)]">여수지역 실시간 기상</p>
                <div className="flex items-center gap-1.5 text-[color:var(--color-ink-2)]">
                  <Thermometer size={13} className="text-[#ec835a]" /> {currentWeather.temperature}°C
                </div>
                <div className="flex items-center gap-1.5 text-[color:var(--color-ink-2)]">
                  <Droplets size={13} className="text-[#7ab1f2]" /> 습도 {currentWeather.humidity}%
                </div>
                <div className="flex items-center gap-1.5 text-[color:var(--color-ink-2)]">
                  <Wind size={13} className="text-[color:var(--color-ink-3)]" />
                  {currentWeather.windSpeed}m/s
                  <Navigation
                    size={12}
                    style={{ transform: `rotate(${windRotation[currentWeather.windDirection]}deg)` }}
                    className="text-[color:var(--color-ink-3)]"
                  />
                  {currentWeather.windDirection}풍
                </div>
              </div>
            )}

            {mapState !== 'loading' && (
              <div className="glass-panel absolute bottom-3 left-3 flex flex-wrap items-center gap-3 rounded-xl px-3 py-2 text-[11px] text-[color:var(--color-ink-2)] shadow-xl">
                <span className="font-medium text-[color:var(--color-ink-1)]">범례</span>
                {(['안전', '주의', '경고', '위험'] as RiskLevel[]).map((r) => (
                  <span key={r} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: riskFill[r] }} />
                    {r}
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <Flame size={12} className="text-[#7ab1f2]" /> 안전시설
                </span>
              </div>
            )}

            {mapState === 'error' && (
              <div className="glass-panel absolute left-3 top-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-[color:var(--color-ink-3)] shadow-xl">
                <WifiOff size={12} />
                외부 지도 타일 서버에 연결할 수 없어 자체 좌표 기반 지도로 표시 중입니다
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="선택 수용가 정보" subtitle="지도에서 마커를 선택해 상세정보를 확인하세요" />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-[color:var(--color-ink-1)]">{selected.name}</h4>
              <Badge dot>{selected.riskLevel}</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-y-2 text-xs">
              <dt className="text-[color:var(--color-ink-3)]">업종</dt>
              <dd className="text-right text-[color:var(--color-ink-2)]">{selected.businessType}</dd>
              <dt className="text-[color:var(--color-ink-3)]">운영 상태</dt>
              <dd className="text-right text-[color:var(--color-ink-2)]">{selected.status}</dd>
              <dt className="text-[color:var(--color-ink-3)]">주소</dt>
              <dd className="text-right text-[color:var(--color-ink-2)]">{selected.address}</dd>
              <dt className="text-[color:var(--color-ink-3)]">담당자</dt>
              <dd className="text-right text-[color:var(--color-ink-2)]">{selected.contactName}</dd>
              <dt className="text-[color:var(--color-ink-3)]">연락처</dt>
              <dd className="tabular text-right text-[color:var(--color-ink-2)]">{selected.contactPhone}</dd>
              <dt className="text-[color:var(--color-ink-3)]">설비 수</dt>
              <dd className="tabular text-right text-[color:var(--color-ink-2)]">{selected.equipmentCount}대</dd>
              <dt className="text-[color:var(--color-ink-3)]">센서 수</dt>
              <dd className="tabular text-right text-[color:var(--color-ink-2)]">{selected.sensorCount}개</dd>
              <dt className="text-[color:var(--color-ink-3)]">디지털트윈 연계</dt>
              <dd className="text-right text-[color:var(--color-ink-2)]">{selected.digitalTwinLinked ? '연계됨' : '미연계'}</dd>
              <dt className="text-[color:var(--color-ink-3)]">AI 예측 연계</dt>
              <dd className="text-right text-[color:var(--color-ink-2)]">{selected.aiPredictionLinked ? '연계됨' : '미연계'}</dd>
            </dl>
          </div>

          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <p className="mb-2 text-xs font-semibold text-[color:var(--color-ink-2)]">전체 수용가</p>
            <div className="flex flex-col gap-1.5">
              {tenants.map((t) => (
                <button
                  key={t.id}
                  onClick={() => focusTenant(t)}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                    selected.id === t.id
                      ? 'bg-[#3987e5]/15 text-[color:var(--color-ink-1)]'
                      : 'text-[color:var(--color-ink-2)] hover:bg-white/[0.05]'
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

// MapLibre(외부 타일) 연결 실패 시 자체 좌표 투영 기반으로 표시하는 폴백 지도.
// 사내망 방화벽으로 외부 지도 서버 접속이 차단된 환경에서도 위치 정보를 계속 제공한다.
function FallbackSvgMap({
  selected,
  onSelect,
  showFacilities,
}: {
  selected: Tenant
  onSelect: (t: Tenant) => void
  showFacilities: boolean
}) {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-[#0d1420] via-[#0f1a24] to-[#0a1420]">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`v${i}`} x1={i * 12.5} y1={0} x2={i * 12.5} y2={100} stroke="rgba(255,255,255,0.05)" strokeWidth={0.15} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 12.5} x2={100} y2={i * 12.5} stroke="rgba(255,255,255,0.05)" strokeWidth={0.15} />
        ))}
        <path
          d="M -5 65 Q 20 55, 35 68 T 70 60 Q 90 55, 105 72 L 105 105 L -5 105 Z"
          fill="#3987e5"
          opacity={0.12}
        />
      </svg>

      {showFacilities &&
        safetyFacilities.map((f) => {
          const { x, y } = project(f.lat, f.lng)
          return (
            <div key={f.id} className="group absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#141a2b] text-[#7ab1f2] shadow ring-1 ring-[#3987e5]/50">
                <Flame size={13} />
              </div>
              <div className="pointer-events-none absolute left-1/2 top-7 -translate-x-1/2 whitespace-nowrap rounded bg-[#141a2b]/95 px-1.5 py-0.5 text-[10px] text-white opacity-0 shadow ring-1 ring-white/10 group-hover:opacity-100">
                {f.name}
              </div>
            </div>
          )
        })}

      {tenants.map((t) => {
        const { x, y } = project(t.lat, t.lng)
        const isSelected = selected.id === t.id
        return (
          <button key={t.id} onClick={() => onSelect(t)} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
            {(t.riskLevel === '위험' || t.riskLevel === '경고') && (
              <span
                className="absolute inset-0 -m-2 rounded-full opacity-40"
                style={{ backgroundColor: riskFill[t.riskLevel], animation: 'pulse-ring 1.8s cubic-bezier(0.2,0.6,0.4,1) infinite' }}
              />
            )}
            <span
              className={`relative flex rounded-full border-2 border-white/90 shadow-lg ${isSelected ? 'ring-2 ring-offset-1 ring-offset-[#0a1420] ring-[#3987e5]' : ''}`}
              style={{ width: isSelected ? 18 : 14, height: isSelected ? 18 : 14, backgroundColor: riskFill[t.riskLevel] }}
            />
            <span className="absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap rounded bg-[#141a2b]/95 px-1.5 py-0.5 text-[10px] font-medium text-white shadow ring-1 ring-white/10">
              {t.name.replace('(주)', '')}
            </span>
          </button>
        )
      })}
    </div>
  )
}
