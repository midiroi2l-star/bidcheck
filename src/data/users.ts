import type { AppUser, AccessLog, OperationLog, UserRole } from '../types'
import { mulberry32, pick, randInt, minutesAgo, daysAgo } from './random'
import { tenants } from './tenants'

const rng = mulberry32(9911)

export const currentUser: AppUser = {
  id: 'U-0001',
  name: '관리자',
  email: 'admin@yeosu-safety.example.com',
  department: '스마트에너지사업부',
  role: '시스템관리자',
  status: '활성',
  lastLogin: minutesAgo(3),
  createdAt: daysAgo(400),
}

const roleNames: Record<UserRole, string> = {
  시스템관리자: '시스템관리자',
  운영관리자: '운영관리자',
  수요기업담당자: '수요기업담당자',
  조회자: '조회자',
}

export const users: AppUser[] = [
  currentUser,
  {
    id: 'U-0002',
    name: '오세훈',
    email: 'ohsh@kdn.example.com',
    department: '스마트에너지사업부',
    role: '운영관리자',
    status: '활성',
    lastLogin: minutesAgo(25),
    createdAt: daysAgo(380),
  },
  {
    id: 'U-0003',
    name: '한지민',
    email: 'hjm@kdn.example.com',
    department: '안전관리팀',
    role: '운영관리자',
    status: '활성',
    lastLogin: minutesAgo(120),
    createdAt: daysAgo(300),
  },
  ...tenants.map((t, i) => ({
    id: `U-01${10 + i}`,
    name: t.contactName,
    email: t.contactEmail,
    department: t.name,
    role: '수요기업담당자' as UserRole,
    status: '활성' as AppUser['status'],
    lastLogin: minutesAgo(randInt(rng, 10, 2000)),
    createdAt: t.joinedDate,
  })),
  {
    id: 'U-0201',
    name: '윤서준',
    email: 'yoon.sj@kdn.example.com',
    department: '감사팀',
    role: '조회자',
    status: '휴면',
    lastLogin: daysAgo(45),
    createdAt: daysAgo(500),
  },
  {
    id: 'U-0202',
    name: '임가은',
    email: 'lim.ge@kdn.example.com',
    department: '스마트에너지사업부',
    role: '조회자',
    status: '잠금',
    lastLogin: daysAgo(90),
    createdAt: daysAgo(410),
  },
]

const actions = ['로그인', '대시보드 조회', '알람 확인 처리', '리포트 다운로드', '설비정보 수정', '사용자 권한 변경', '경보규칙 등록']
const menus = ['종합대시보드', '경보관리', '수요기업관리', '설비관리', '사용자관리', '리포트', '시스템연계관리']

export const accessLogs: AccessLog[] = Array.from({ length: 40 }, (_, i) => {
  const user = pick(rng, users)
  return {
    id: `LOGIN-${String(1000 + i)}`,
    userId: user.id,
    userName: user.name,
    action: pick(rng, actions),
    menu: pick(rng, menus),
    timestamp: minutesAgo(randInt(rng, 1, 60 * 24 * 10)),
    ip: `10.${randInt(rng, 0, 255)}.${randInt(rng, 0, 255)}.${randInt(rng, 1, 254)}`,
    result: (rng() > 0.95 ? '실패' : '성공') as AccessLog['result'],
  }
}).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

const opCategories: OperationLog['category'][] = ['등록', '수정', '삭제', '조회', '스케줄링', '설정변경']
const opTargets = [
  '수요기업 정보',
  '설비 기준정보',
  '센서 메타정보',
  '경보 규칙',
  '사용자 계정',
  '리포트 템플릿',
  '연계 시스템 메타정보',
  '배치작업 스케줄',
]

export const operationLogs: OperationLog[] = Array.from({ length: 60 }, (_, i) => {
  const user = pick(rng, users)
  const category = pick(rng, opCategories)
  const target = pick(rng, opTargets)
  return {
    id: `OPLOG-${String(2000 + i)}`,
    category,
    target,
    userName: user.name,
    timestamp: minutesAgo(randInt(rng, 1, 60 * 24 * 20)),
    detail: `${user.name}님이 [${target}]을(를) ${category} 처리함`,
  }
}).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

export function roleLabel(role: UserRole): string {
  return roleNames[role]
}
