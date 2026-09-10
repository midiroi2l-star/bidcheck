import type { LinkedSystem } from '../types'
import { tenants } from './tenants'
import { mulberry32, randInt, randFloat, minutesAgo } from './random'

const rng = mulberry32(88)

function mkSystem(partial: Omit<LinkedSystem, 'status' | 'uptime' | 'latencyMs' | 'lastSync'>): LinkedSystem {
  const status = randFloat(rng, 0, 1) > 0.9 ? '지연' : randFloat(rng, 0, 1) > 0.97 ? '장애' : '정상'
  return {
    ...partial,
    status,
    uptime: randFloat(rng, 97, 99.99, 2),
    latencyMs: status === '장애' ? randInt(rng, 3000, 8000) : randInt(rng, 40, 480),
    lastSync: minutesAgo(status === '장애' ? randInt(rng, 30, 180) : randInt(rng, 0, 5)),
  }
}

// 연동시스템 (기 개발구축모델) - SFR-001, SFR-014
export const linkedSystems: LinkedSystem[] = [
  mkSystem({
    id: 'SYS-DT',
    name: '디지털트윈 시스템',
    category: '연동시스템',
    description: '수요기업 설비 3D 시각화 및 시뮬레이션 연계',
    endpoint: 'https://dt-internal.example.com/api/v1',
    syncCycle: '실시간(5초)',
    owner: '한전KDN 디지털트윈팀',
  }),
  mkSystem({
    id: 'SYS-AI',
    name: 'AI 안전진단·예측 시스템',
    category: '연동시스템',
    description: '계측데이터 기반 이상진단 및 사고예측 모델 연계',
    endpoint: 'https://ai-safety.example.com/api/v1',
    syncCycle: '실시간(10초)',
    owner: '한전KDN AI분석팀',
  }),
  mkSystem({
    id: 'SYS-SUP',
    name: '안전관리지원 시스템',
    category: '연동시스템',
    description: '작업자 위험상황 인지 및 안전관리 업무지원 연계',
    endpoint: 'https://safety-support.example.com/api/v1',
    syncCycle: '실시간(30초)',
    owner: '한전KDN 안전지원팀',
  }),
  mkSystem({
    id: 'SYS-CCTV',
    name: 'AI 영상감시(CCTV) 시스템',
    category: '연동시스템',
    description: '수요기업 CCTV 영상 취득 및 AI 이상행동 분석 연계',
    endpoint: 'https://vision-ai.example.com/api/v1',
    syncCycle: '실시간(1초)',
    owner: '한전KDN 영상분석팀',
  }),
  // 공공데이터 연계 - SFR-004
  mkSystem({
    id: 'PUB-KMA',
    name: '기상청 기상정보시스템',
    category: '공공데이터',
    description: '여수지역 기온·풍속·풍향·강수량 데이터 연계',
    endpoint: 'https://apihub.kma.go.kr/api',
    syncCycle: '10분',
    owner: '기상청',
  }),
  mkSystem({
    id: 'PUB-NFA',
    name: '소방청 국가화재정보시스템',
    category: '공공데이터',
    description: '여수 지역 화재발생 및 119 출동 현황 데이터 연계',
    endpoint: 'https://api.nfa.go.kr/fire',
    syncCycle: '5분',
    owner: '소방청',
  }),
  mkSystem({
    id: 'PUB-MOIS',
    name: '행안부 국가재난관리시스템',
    category: '공공데이터',
    description: '긴급재난문자·풍수해·지진 등 광역 재난 발령 현황 연계',
    endpoint: 'https://www.safekorea.go.kr/api',
    syncCycle: '실시간',
    owner: '행정안전부',
  }),
  mkSystem({
    id: 'PUB-ME',
    name: '환경부 화학물질안전원',
    category: '공공데이터',
    description: '유해화학물질 위험성·사고대응 절차 데이터 참조',
    endpoint: 'https://icis.me.go.kr/api',
    syncCycle: '1일',
    owner: '환경부',
  }),
  mkSystem({
    id: 'PUB-KOSHA',
    name: '산재예방정보시스템',
    category: '공공데이터',
    description: '업종별 산업재해 통계 및 사고사례 데이터 연계',
    endpoint: 'https://kosha.or.kr/api/stats',
    syncCycle: '1일',
    owner: '안전보건공단',
  }),
  // 수요기업 연계 - VPN
  ...tenants.map((t) =>
    mkSystem({
      id: `VPN-${t.id}`,
      name: `${t.name} 연계 VPN`,
      category: '수요기업연계',
      description: `${t.name} 계측기 및 설비 데이터 수집을 위한 전용 VPN 연계(방화벽 포함)`,
      endpoint: `vpn://${t.id.toLowerCase()}.tenant.example.com`,
      syncCycle: '실시간(1분)',
      owner: t.name,
    }),
  ),
]
