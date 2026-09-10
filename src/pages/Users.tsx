import { useMemo, useState } from 'react'
import { Search, Lock, Unlock } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { users as initialUsers, accessLogs } from '../data/users'
import { formatDateTime } from '../data/random'
import type { AppUser, UserRole } from '../types'

const roles: UserRole[] = ['시스템관리자', '운영관리자', '수요기업담당자', '조회자']

const statusStyle: Record<AppUser['status'], string> = {
  활성: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  휴면: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  잠금: 'bg-red-50 text-red-700 ring-red-600/20',
}

export function UsersPage() {
  const [tab, setTab] = useState<'users' | 'logs'>('users')
  const [users, setUsers] = useState<AppUser[]>(initialUsers)
  const [query, setQuery] = useState('')

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.name.toLowerCase().includes(query.toLowerCase()) ||
          u.department.toLowerCase().includes(query.toLowerCase()),
      ),
    [users, query],
  )

  const [logQuery, setLogQuery] = useState('')
  const filteredLogs = useMemo(
    () =>
      accessLogs.filter(
        (l) =>
          l.userName.toLowerCase().includes(logQuery.toLowerCase()) ||
          l.action.toLowerCase().includes(logQuery.toLowerCase()) ||
          l.menu.toLowerCase().includes(logQuery.toLowerCase()),
      ),
    [logQuery],
  )

  function changeRole(id: string, role: UserRole) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)))
  }

  function toggleLock(id: string) {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: u.status === '잠금' ? '활성' : '잠금' } : u)),
    )
  }

  return (
    <div>
      <PageHeader
        title="사용자·권한 관리"
        description="역할 기반 접근 통제(RBAC)로 메뉴·기능별 접근 권한을 관리하고 접속 이력을 추적합니다."
      />

      <div className="mb-4 flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setTab('users')}
          className={`px-3 pb-2.5 text-sm font-medium ${
            tab === 'users' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-500'
          }`}
        >
          사용자 계정
        </button>
        <button
          onClick={() => setTab('logs')}
          className={`px-3 pb-2.5 text-sm font-medium ${
            tab === 'logs' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-500'
          }`}
        >
          접속 이력
        </button>
      </div>

      {tab === 'users' ? (
        <Card padded={false}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름, 소속 검색"
                className="w-60 rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-400"
              />
            </div>
            <p className="text-xs text-slate-400">총 {filteredUsers.length}명</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">이름</th>
                  <th className="px-4 py-2.5 font-medium">이메일</th>
                  <th className="px-4 py-2.5 font-medium">소속</th>
                  <th className="px-4 py-2.5 font-medium">권한(역할)</th>
                  <th className="px-4 py-2.5 font-medium">최근 로그인</th>
                  <th className="px-4 py-2.5 font-medium">상태</th>
                  <th className="px-4 py-2.5 font-medium text-right">계정 잠금</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3 text-slate-600">{u.department}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value as UserRole)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(u.lastLogin)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${statusStyle[u.status]}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleLock(u.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                      >
                        {u.status === '잠금' ? <Unlock size={12} /> : <Lock size={12} />}
                        {u.status === '잠금' ? '잠금 해제' : '잠금'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card padded={false}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" />
              <input
                value={logQuery}
                onChange={(e) => setLogQuery(e.target.value)}
                placeholder="사용자, 메뉴, 행위 검색"
                className="w-64 rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-400"
              />
            </div>
            <p className="text-xs text-slate-400">총 {filteredLogs.length}건</p>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">시각</th>
                  <th className="px-4 py-2.5 font-medium">사용자</th>
                  <th className="px-4 py-2.5 font-medium">메뉴</th>
                  <th className="px-4 py-2.5 font-medium">행위</th>
                  <th className="px-4 py-2.5 font-medium">IP</th>
                  <th className="px-4 py-2.5 font-medium">결과</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{formatDateTime(l.timestamp)}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{l.userName}</td>
                    <td className="px-4 py-2.5 text-slate-600">{l.menu}</td>
                    <td className="px-4 py-2.5 text-slate-600">{l.action}</td>
                    <td className="px-4 py-2.5 text-slate-500">{l.ip}</td>
                    <td className="px-4 py-2.5">
                      <Badge>{l.result}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
