import { useMemo, useState } from 'react'
import { Search, Lock, Unlock } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { inputBase, btnGhostSm } from '../components/ui/styles'
import * as tb from '../components/ui/table'
import { users as initialUsers, accessLogs } from '../data/users'
import { formatDateTime } from '../data/random'
import type { AppUser, UserRole } from '../types'

const roles: UserRole[] = ['시스템관리자', '운영관리자', '수요기업담당자', '조회자']

const statusStyle: Record<AppUser['status'], string> = {
  활성: 'bg-[#0ca30c]/15 text-[#3ddb3d] ring-[#0ca30c]/30',
  휴면: 'bg-white/[0.06] text-[color:var(--color-ink-2)] ring-white/10',
  잠금: 'bg-[#d03b3b]/15 text-[#ff6b6b] ring-[#d03b3b]/35',
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

      <div className="mb-4 flex gap-2 border-b border-white/[0.08]">
        <button
          onClick={() => setTab('users')}
          className={`px-3 pb-2.5 text-sm font-medium transition ${
            tab === 'users'
              ? 'border-b-2 border-[#3987e5] text-[color:var(--color-ink-1)]'
              : 'text-[color:var(--color-ink-3)] hover:text-[color:var(--color-ink-2)]'
          }`}
        >
          사용자 계정
        </button>
        <button
          onClick={() => setTab('logs')}
          className={`px-3 pb-2.5 text-sm font-medium transition ${
            tab === 'logs'
              ? 'border-b-2 border-[#3987e5] text-[color:var(--color-ink-1)]'
              : 'text-[color:var(--color-ink-3)] hover:text-[color:var(--color-ink-2)]'
          }`}
        >
          접속 이력
        </button>
      </div>

      {tab === 'users' ? (
        <Card padded={false}>
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] p-4">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-[color:var(--color-ink-3)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름, 소속 검색"
                className={`${inputBase} w-60 pl-8`}
              />
            </div>
            <p className="text-xs text-[color:var(--color-ink-3)]">총 {filteredUsers.length}명</p>
          </div>
          <div className={tb.tableWrap}>
            <table className={`${tb.table} min-w-[820px]`}>
              <thead className={tb.thead}>
                <tr>
                  <th className={tb.th}>이름</th>
                  <th className={tb.th}>이메일</th>
                  <th className={tb.th}>소속</th>
                  <th className={tb.th}>권한(역할)</th>
                  <th className={tb.th}>최근 로그인</th>
                  <th className={tb.th}>상태</th>
                  <th className={`${tb.th} text-right`}>계정 잠금</th>
                </tr>
              </thead>
              <tbody className={tb.tbody}>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className={tb.tr}>
                    <td className={tb.tdStrong}>{u.name}</td>
                    <td className={tb.td}>{u.email}</td>
                    <td className={tb.td}>{u.department}</td>
                    <td className={tb.td}>
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value as UserRole)}
                        className={`${inputBase} py-1`}
                      >
                        {roles.map((r) => (
                          <option key={r} value={r} className="bg-[color:var(--color-surface)]">
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={`${tb.td} tabular`}>{formatDateTime(u.lastLogin)}</td>
                    <td className={tb.td}>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${statusStyle[u.status]}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => toggleLock(u.id)} className={btnGhostSm}>
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
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] p-4">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-[color:var(--color-ink-3)]" />
              <input
                value={logQuery}
                onChange={(e) => setLogQuery(e.target.value)}
                placeholder="사용자, 메뉴, 행위 검색"
                className={`${inputBase} w-64 pl-8`}
              />
            </div>
            <p className="text-xs text-[color:var(--color-ink-3)]">총 {filteredLogs.length}건</p>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            <table className={`${tb.table} min-w-[760px]`}>
              <thead className={tb.thead}>
                <tr>
                  <th className={tb.th}>시각</th>
                  <th className={tb.th}>사용자</th>
                  <th className={tb.th}>메뉴</th>
                  <th className={tb.th}>행위</th>
                  <th className={tb.th}>IP</th>
                  <th className={tb.th}>결과</th>
                </tr>
              </thead>
              <tbody className={tb.tbody}>
                {filteredLogs.map((l) => (
                  <tr key={l.id} className={tb.tr}>
                    <td className={`${tb.td} tabular whitespace-nowrap`}>{formatDateTime(l.timestamp)}</td>
                    <td className={tb.tdStrong}>{l.userName}</td>
                    <td className={tb.td}>{l.menu}</td>
                    <td className={tb.td}>{l.action}</td>
                    <td className={`${tb.td} tabular`}>{l.ip}</td>
                    <td className={tb.td}>
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
