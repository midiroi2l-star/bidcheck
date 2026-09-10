// 여수 스마트 산업단지 통합 안전관리 플랫폼 - 공통 타입 정의

export type RiskLevel = '안전' | '주의' | '경고' | '위험'
export type ConnStatus = '정상' | '지연' | '장애'
export type AlarmStatus = '미확인' | '확인' | '처리중' | '처리완료'
export type AlarmSeverity = '위험' | '경고' | '주의'
export type UserRole = '시스템관리자' | '운영관리자' | '수요기업담당자' | '조회자'
export type UserStatus = '활성' | '휴면' | '잠금'

export interface Tenant {
  id: string
  name: string
  businessType: string
  address: string
  lat: number
  lng: number
  status: '운영중' | '점검중' | '중단'
  riskLevel: RiskLevel
  contactName: string
  contactPhone: string
  contactEmail: string
  joinedDate: string
  equipmentCount: number
  sensorCount: number
  digitalTwinLinked: boolean
  aiPredictionLinked: boolean
}

export interface Equipment {
  id: string
  tenantId: string
  name: string
  type: string
  location: string
  installedDate: string
  status: '가동중' | '정지' | '점검중'
  riskLevel: RiskLevel
  sensorIds: string[]
}

export interface SensorReading {
  timestamp: string
  value: number
}

export interface Sensor {
  id: string
  equipmentId: string
  tenantId: string
  type: '온도' | '압력' | '가스농도' | '진동' | '수위' | '유량'
  unit: string
  currentValue: number
  thresholdWarnMin: number
  thresholdWarnMax: number
  thresholdDangerMin: number
  thresholdDangerMax: number
  status: RiskLevel
  lastUpdated: string
  history: SensorReading[]
}

export interface Alarm {
  id: string
  tenantId: string
  tenantName: string
  equipmentName: string
  sensorType: string
  severity: AlarmSeverity
  message: string
  value: number
  unit: string
  occurredAt: string
  status: AlarmStatus
  assignee: string | null
  notifiedVia: string[]
}

export interface AlarmRule {
  id: string
  sensorType: string
  targetScope: string
  warnMin: number
  warnMax: number
  dangerMin: number
  dangerMax: number
  severity: AlarmSeverity
  notifyTargets: string[]
  enabled: boolean
}

export interface LinkedSystem {
  id: string
  name: string
  category: '연동시스템' | '공공데이터' | '수요기업연계'
  description: string
  endpoint: string
  status: ConnStatus
  uptime: number
  latencyMs: number
  lastSync: string
  syncCycle: string
  owner: string
}

export interface WeatherData {
  time: string
  temperature: number
  windSpeed: number
  windDirection: string
  humidity: number
  precipitation: number
}

export interface FireIncident {
  id: string
  location: string
  occurredAt: string
  type: string
  dispatchedUnits: number
  status: '진행중' | '진압완료' | '잔불정리'
}

export interface DisasterAlert {
  id: string
  type: string
  region: string
  issuedAt: string
  message: string
  level: '안전안내' | '주의보' | '경보'
}

export interface IndustryAccidentStat {
  industry: string
  companyRate: number
  industryAvgRate: number
}

export interface AppUser {
  id: string
  name: string
  email: string
  department: string
  role: UserRole
  status: UserStatus
  lastLogin: string
  createdAt: string
}

export interface AccessLog {
  id: string
  userId: string
  userName: string
  action: string
  menu: string
  timestamp: string
  ip: string
  result: '성공' | '실패'
}

export interface OperationLog {
  id: string
  category: '등록' | '수정' | '삭제' | '조회' | '스케줄링' | '설정변경'
  target: string
  userName: string
  timestamp: string
  detail: string
}

export interface SafetyReport {
  id: string
  title: string
  templateName: string
  schedule: '일간' | '주간' | '월간' | '수시'
  recipients: string[]
  lastGeneratedAt: string | null
  nextScheduledAt: string
  status: '예약됨' | '생성완료' | '발송완료' | '실패'
}
