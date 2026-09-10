import type { WeatherData, FireIncident, DisasterAlert, IndustryAccidentStat } from '../types'
import { mulberry32, randFloat, randInt, pick, minutesAgo, daysAgo } from './random'

const rng = mulberry32(4242)

// 기상청 기상정보시스템 연계 더미 (SFR-004, SFR-006)
export const weatherHourly: WeatherData[] = Array.from({ length: 24 }, (_, i) => {
  const hour = i
  const tempBase = 22 + 6 * Math.sin(((hour - 6) / 24) * Math.PI * 2)
  return {
    time: `${String(hour).padStart(2, '0')}:00`,
    temperature: Math.round((tempBase + randFloat(rng, -1, 1)) * 10) / 10,
    windSpeed: randFloat(rng, 1.5, 8.5, 1),
    windDirection: pick(rng, ['북', '북동', '동', '남동', '남', '남서', '서', '북서']),
    humidity: randInt(rng, 45, 85),
    precipitation: rng() > 0.85 ? randFloat(rng, 0.5, 12, 1) : 0,
  }
})

export const currentWeather = weatherHourly[new Date().getHours()] ?? weatherHourly[12]

// 소방청 국가화재정보시스템 연계 더미
export const fireIncidents: FireIncident[] = [
  {
    id: 'FIRE-001',
    location: '여수시 낙포동 산업단지 인근',
    occurredAt: minutesAgo(42),
    type: '화학물질 누출 의심 화재',
    dispatchedUnits: 6,
    status: '진압완료',
  },
  {
    id: 'FIRE-002',
    location: '여수시 월내동 발전설비 주변',
    occurredAt: minutesAgo(190),
    type: '전기설비 화재',
    dispatchedUnits: 3,
    status: '잔불정리',
  },
  {
    id: 'FIRE-003',
    location: '여수시 화치동 인근 야산',
    occurredAt: daysAgo(2),
    type: '임야화재',
    dispatchedUnits: 8,
    status: '진압완료',
  },
]

// 행안부 국가재난관리시스템 연계 더미
export const disasterAlerts: DisasterAlert[] = [
  {
    id: 'DIS-001',
    type: '강풍주의보',
    region: '전남 여수시',
    issuedAt: minutesAgo(75),
    message: '여수시 전역 강풍주의보 발효. 옥외 작업 시 안전에 유의 바랍니다.',
    level: '주의보',
  },
  {
    id: 'DIS-002',
    type: '호우예비특보',
    region: '전남 여수시·순천시',
    issuedAt: minutesAgo(300),
    message: '내일 오전까지 시간당 30mm 이상의 강한 비가 예상됩니다.',
    level: '안전안내',
  },
  {
    id: 'DIS-003',
    type: '건조경보',
    region: '전남 여수시',
    issuedAt: daysAgo(1),
    message: '대기 매우 건조. 화기 취급에 각별한 주의가 필요합니다.',
    level: '경보',
  },
]

// 산재예방정보시스템 연계 더미 - 업종별 재해율 비교
export const industryAccidentStats: IndustryAccidentStat[] = [
  { industry: '석유화학', companyRate: 0.31, industryAvgRate: 0.42 },
  { industry: '정유', companyRate: 0.28, industryAvgRate: 0.39 },
  { industry: '발전·에너지', companyRate: 0.19, industryAvgRate: 0.33 },
  { industry: '정밀화학', companyRate: 0.44, industryAvgRate: 0.41 },
  { industry: '가스저장·물류', companyRate: 0.22, industryAvgRate: 0.36 },
]

export const chemicalSafetyNotices = [
  {
    id: 'CHEM-001',
    substance: '암모니아',
    riskInfo: '독성·부식성, 누출 시 즉시 대피 및 방재',
    responseGuide: '유출 지역 통제, 물 분무로 확산 억제, 방독마스크 착용 필수',
  },
  {
    id: 'CHEM-002',
    substance: '황화수소',
    riskInfo: '고독성 가스, 낮은 농도에서도 후각 마비 위험',
    responseGuide: '가스 감지기 상시 모니터링, 밀폐공간 작업 시 2인1조 원칙',
  },
  {
    id: 'CHEM-003',
    substance: '벤젠',
    riskInfo: '발암성 물질, 장기 노출 주의',
    responseGuide: '국소배기장치 가동, 개인보호구 착용, 작업환경 측정 정기실시',
  },
]
