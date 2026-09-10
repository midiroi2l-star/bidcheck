import { useEffect, useState } from 'react'
import { Bell, Menu } from 'lucide-react'
import { alarms } from '../../data/alarms'
import { currentUser } from '../../data/users'

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const [now, setNow] = useState(new Date())
  const unread = alarms.filter((a) => a.status === '미확인').length

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/[0.06] bg-[color:var(--color-bg-elevated)]/80 px-4 backdrop-blur-xl lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-[color:var(--color-ink-3)] hover:bg-white/[0.06] lg:hidden"
          aria-label="메뉴 열기"
        >
          <Menu size={20} />
        </button>
        <div className="hidden sm:flex sm:items-center sm:gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0ca30c] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0ca30c]" />
          </span>
          <div>
            <p className="text-xs text-[color:var(--color-ink-3)]">
              {now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
            <p className="tabular text-sm font-semibold text-[color:var(--color-ink-1)]">
              {now.toLocaleTimeString('ko-KR')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="relative rounded-lg p-2 text-[color:var(--color-ink-2)] transition hover:bg-white/[0.06] hover:text-[color:var(--color-ink-1)]"
          aria-label="알림"
        >
          <Bell size={19} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d03b3b] px-1 text-[10px] font-bold text-white shadow-[0_0_8px_rgba(208,59,59,0.7)]">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
        <div className="flex items-center gap-2.5 border-l border-white/[0.08] pl-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#3987e5] to-[#1c5cab] text-sm font-semibold text-white">
            {currentUser.name.slice(0, 1)}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-semibold text-[color:var(--color-ink-1)]">{currentUser.name}</p>
            <p className="text-xs text-[color:var(--color-ink-3)]">{currentUser.role}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
