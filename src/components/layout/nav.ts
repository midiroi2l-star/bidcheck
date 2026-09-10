import {
  LayoutDashboard,
  Map,
  Activity,
  AlertTriangle,
  Building2,
  Cpu,
  CloudSun,
  FileBarChart,
  Users,
  ScrollText,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  section: string
}

export const navItems: NavItem[] = [
  { to: '/', label: '종합 대시보드', icon: LayoutDashboard, section: '모니터링' },
  { to: '/map', label: '산업단지 맵', icon: Map, section: '모니터링' },
  { to: '/monitoring', label: '연동 시스템 상태', icon: Activity, section: '모니터링' },
  { to: '/alarms', label: '이상감지·경보관리', icon: AlertTriangle, section: '안전관리' },
  { to: '/public-data', label: '공공데이터 연계', icon: CloudSun, section: '안전관리' },
  { to: '/reports', label: '안전 리포트', icon: FileBarChart, section: '안전관리' },
  { to: '/tenants', label: '수요기업 관리', icon: Building2, section: '기준정보' },
  { to: '/equipment', label: '설비·센서 관리', icon: Cpu, section: '기준정보' },
  { to: '/users', label: '사용자·권한 관리', icon: Users, section: '시스템관리' },
  { to: '/logs', label: '운영정보 로그', icon: ScrollText, section: '시스템관리' },
]
