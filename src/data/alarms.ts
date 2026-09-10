import type { Alarm, AlarmRule, AlarmSeverity } from '../types'
import { sensors } from './sensors'
import { equipment } from './equipment'
import { tenants } from './tenants'
import { mulberry32, pick, randInt, minutesAgo } from './random'

const rng = mulberry32(555)

const equipmentById = new Map(equipment.map((e) => [e.id, e]))
const tenantById = new Map(tenants.map((t) => [t.id, t]))

const messageByType: Record<string, (v: number, u: string) => string> = {
  온도: (v, u) => `설비 온도 이상 상승 감지 (${v}${u})`,
  압력: (v, u) => `배관 압력 임계치 초과 (${v}${u})`,
  가스농도: (v, u) => `가스 누출 의심 농도 감지 (${v}${u})`,
  진동: (v, u) => `설비 이상 진동 감지 (${v}${u})`,
  수위: (v, u) => `저장탱크 수위 이상 (${v}${u})`,
  유량: (v, u) => `배관 유량 이상치 감지 (${v}${u})`,
}

function severityFromStatus(status: string): AlarmSeverity {
  if (status === '위험') return '위험'
  if (status === '경고') return '경고'
  return '주의'
}

const activeAlarms: Alarm[] = sensors
  .filter((s) => s.status === '위험' || s.status === '경고')
  .map((s, i) => {
    const eq = equipmentById.get(s.equipmentId)!
    const tenant = tenantById.get(s.tenantId)!
    const status = pick(rng, ['미확인', '미확인', '확인', '처리중']) as Alarm['status']
    return {
      id: `AL-${String(1000 + i)}`,
      tenantId: tenant.id,
      tenantName: tenant.name,
      equipmentName: eq.name,
      sensorType: s.type,
      severity: severityFromStatus(s.status),
      message: messageByType[s.type](s.currentValue, s.unit),
      value: s.currentValue,
      unit: s.unit,
      occurredAt: minutesAgo(randInt(rng, 1, 240)),
      status,
      assignee: status === '미확인' ? null : pick(rng, ['김도윤', '이서연', '박지훈', '최민서']),
      notifiedVia: status === '미확인' ? ['알림톡', '팝업'] : ['알림톡'],
    } satisfies Alarm
  })

// 처리 완료된 과거 이력도 추가하여 목록을 풍부하게 구성
const resolvedHistory: Alarm[] = Array.from({ length: 18 }, (_, i) => {
  const tenant = pick(rng, tenants)
  const tEquip = equipment.filter((e) => e.tenantId === tenant.id)
  const eq = pick(rng, tEquip.length ? tEquip : equipment)
  const type = pick(rng, ['온도', '압력', '가스농도', '진동', '수위', '유량'])
  const value = randInt(rng, 40, 120)
  return {
    id: `AL-${String(900 - i)}`,
    tenantId: tenant.id,
    tenantName: tenant.name,
    equipmentName: eq.name,
    sensorType: type,
    severity: pick(rng, ['주의', '경고', '위험']) as AlarmSeverity,
    message: messageByType[type](value, '단위'),
    value,
    unit: '',
    occurredAt: minutesAgo(randInt(rng, 300, 60 * 24 * 14)),
    status: '처리완료',
    assignee: pick(rng, ['김도윤', '이서연', '박지훈', '최민서', '정하윤']),
    notifiedVia: ['알림톡'],
  } satisfies Alarm
})

export const alarms: Alarm[] = [...activeAlarms, ...resolvedHistory].sort(
  (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
)

export const alarmRules: AlarmRule[] = [
  {
    id: 'RULE-001',
    sensorType: '온도',
    targetScope: '전체 저장탱크/반응기',
    warnMin: 70,
    warnMax: 85,
    dangerMin: 85,
    dangerMax: 120,
    severity: '위험',
    notifyTargets: ['설비담당자', '안전관리자'],
    enabled: true,
  },
  {
    id: 'RULE-002',
    sensorType: '압력',
    targetScope: '배관 매니폴드',
    warnMin: 310,
    warnMax: 360,
    dangerMin: 360,
    dangerMax: 450,
    severity: '위험',
    notifyTargets: ['설비담당자', '안전관리자', '발주사 상황실'],
    enabled: true,
  },
  {
    id: 'RULE-003',
    sensorType: '가스농도',
    targetScope: '전체 수요기업',
    warnMin: 16,
    warnMax: 30,
    dangerMin: 30,
    dangerMax: 80,
    severity: '위험',
    notifyTargets: ['설비담당자', '안전관리자', '발주사 상황실', '소방연계'],
    enabled: true,
  },
  {
    id: 'RULE-004',
    sensorType: '진동',
    targetScope: '회전설비(터빈, 압축기, 펌프)',
    warnMin: 3.6,
    warnMax: 6,
    dangerMin: 6,
    dangerMax: 12,
    severity: '경고',
    notifyTargets: ['설비담당자'],
    enabled: true,
  },
  {
    id: 'RULE-005',
    sensorType: '수위',
    targetScope: '저장탱크',
    warnMin: 80,
    warnMax: 90,
    dangerMin: 90,
    dangerMax: 100,
    severity: '경고',
    notifyTargets: ['설비담당자', '안전관리자'],
    enabled: true,
  },
  {
    id: 'RULE-006',
    sensorType: '유량',
    targetScope: '이송펌프/배관',
    warnMin: 81,
    warnMax: 95,
    dangerMin: 95,
    dangerMax: 130,
    severity: '주의',
    notifyTargets: ['설비담당자'],
    enabled: false,
  },
]
