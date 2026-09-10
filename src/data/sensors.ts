import type { Sensor, SensorReading, RiskLevel } from '../types'
import { equipment } from './equipment'
import { tenants } from './tenants'
import { mulberry32, pick, randFloat } from './random'

const rng = mulberry32(2024)
const tenantById = new Map(tenants.map((t) => [t.id, t]))

interface SensorTypeDef {
  type: Sensor['type']
  unit: string
  base: [number, number]
  warn: [number, number]
  danger: [number, number]
}

const sensorTypeDefs: SensorTypeDef[] = [
  { type: '온도', unit: '°C', base: [20, 65], warn: [70, 85], danger: [85, 120] },
  { type: '압력', unit: 'kPa', base: [100, 300], warn: [310, 360], danger: [360, 450] },
  { type: '가스농도', unit: 'ppm', base: [0, 15], warn: [16, 30], danger: [30, 80] },
  { type: '진동', unit: 'mm/s', base: [0.5, 3.5], warn: [3.6, 6], danger: [6, 12] },
  { type: '수위', unit: '%', base: [30, 70], warn: [80, 90], danger: [90, 100] },
  { type: '유량', unit: 'm³/h', base: [10, 80], warn: [81, 95], danger: [95, 130] },
]

type Profile = '안전' | '주의' | '경고' | '위험'

// 수요기업 위험도에 따라 이상치 센서가 발생할 확률에 가중치를 둠 (더미 시나리오)
const profileWeights: Record<RiskLevel, [number, number, number, number]> = {
  // [안전, 주의, 경고, 위험] 누적 확률 아님 - 개별 확률
  안전: [0.86, 0.09, 0.04, 0.01],
  주의: [0.68, 0.18, 0.1, 0.04],
  경고: [0.5, 0.2, 0.2, 0.1],
  위험: [0.35, 0.2, 0.25, 0.2],
}

function pickProfile(tenantRisk: RiskLevel): Profile {
  const [, caution, warn, danger] = profileWeights[tenantRisk]
  const r = rng()
  if (r < danger) return '위험'
  if (r < danger + warn) return '경고'
  if (r < danger + warn + caution) return '주의'
  return '안전'
}

function targetRange(def: SensorTypeDef, profile: Profile): [number, number] {
  if (profile === '위험') return def.danger
  if (profile === '경고') return def.warn
  if (profile === '주의') return [def.base[1] * 0.82, def.base[1] * 0.98]
  return def.base
}

// 정상 구간에서 시작해 최근 시점에 목표 구간으로 점진 상승/하강하는 24시간 추이 생성
function genHistory(def: SensorTypeDef, profile: Profile, points = 24): SensorReading[] {
  const now = Date.now()
  const startMid = (def.base[0] + def.base[1]) / 2
  const startSpread = (def.base[1] - def.base[0]) / 2
  const [tMin, tMax] = targetRange(def, profile)
  const targetMid = (tMin + tMax) / 2
  const targetSpread = (tMax - tMin) / 2

  return Array.from({ length: points }, (_, i) => {
    const t = new Date(now - (points - 1 - i) * 60 * 60_000).toISOString()
    if (profile === '안전') {
      const noise = (rng() - 0.5) * startSpread * 0.6
      const drift = Math.sin(i / 3) * startSpread * 0.3
      return { timestamp: t, value: round1(startMid + noise + drift) }
    }
    // 이상치 프로파일: 앞부분은 정상, 뒤로 갈수록 목표 구간으로 수렴
    const progress = Math.min(1, Math.max(0, (i - points * 0.35) / (points * 0.65))) ** 1.4
    const mid = startMid + (targetMid - startMid) * progress
    const spread = startSpread + (targetSpread - startSpread) * progress
    const noise = (rng() - 0.5) * Math.max(spread, startSpread * 0.3) * 0.5
    return { timestamp: t, value: round1(mid + noise) }
  })
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

function classify(value: number, def: SensorTypeDef): RiskLevel {
  if (value >= def.danger[0]) return '위험'
  if (value >= def.warn[0]) return '경고'
  if (value >= def.base[1] * 0.82) return '주의'
  return '안전'
}

let seq = 1
export const sensors: Sensor[] = equipment.flatMap((eq) => {
  const tenantRisk = tenantById.get(eq.tenantId)?.riskLevel ?? '안전'
  // 설비당 2~4개 센서 부착
  const count = 2 + Math.floor(rng() * 3)
  const chosen = new Set<string>()
  while (chosen.size < count) {
    chosen.add(pick(rng, sensorTypeDefs).type)
  }
  return Array.from(chosen).map((type) => {
    const def = sensorTypeDefs.find((d) => d.type === type)!
    const profile = pickProfile(tenantRisk)
    const history = genHistory(def, profile)
    const currentValue = history[history.length - 1].value
    const id = `SN-${String(seq++).padStart(5, '0')}`
    eq.sensorIds.push(id)
    return {
      id,
      equipmentId: eq.id,
      tenantId: eq.tenantId,
      type: def.type,
      unit: def.unit,
      currentValue,
      thresholdWarnMin: def.warn[0],
      thresholdWarnMax: def.warn[1],
      thresholdDangerMin: def.danger[0],
      thresholdDangerMax: def.danger[1],
      status: classify(currentValue, def),
      lastUpdated: history[history.length - 1].timestamp,
      history,
    } satisfies Sensor
  })
})

export function sensorTypeUnit(type: string): string {
  return sensorTypeDefs.find((d) => d.type === type)?.unit ?? ''
}

// 랜덤 값 재계산 (대시보드 새로고침 시 살아있는 느낌을 주기 위한 유틸)
export function jitterValue(sensor: Sensor): number {
  const def = sensorTypeDefs.find((d) => d.type === sensor.type)!
  return randFloat(rng, def.base[0], def.warn[1], 1)
}
