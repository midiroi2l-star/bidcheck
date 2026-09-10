import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { ShieldCheck } from 'lucide-react'
import { navItems } from './nav'

const sections = Array.from(new Set(navItems.map((n) => n.section)))

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-white/[0.06] bg-[color:var(--color-bg-elevated)]/95 backdrop-blur lg:flex">
      <div className="flex h-16 items-center gap-2.5 border-b border-white/[0.06] px-5">
        <div className="glow-ring flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#3987e5] to-[#1c5cab] text-white">
          <ShieldCheck size={19} />
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-bold text-[color:var(--color-ink-1)]">여수 스마트 산업단지</p>
          <p className="truncate text-[11px] text-[color:var(--color-ink-3)]">통합 안전관리 플랫폼</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section} className="mb-5">
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--color-ink-3)]">
              {section}
            </p>
            <div className="flex flex-col gap-0.5">
              {navItems
                .filter((n) => n.section === section)
                .map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      clsx(
                        'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-[#3987e5]/12 text-[color:var(--color-ink-1)]'
                          : 'text-[color:var(--color-ink-2)] hover:bg-white/[0.04] hover:text-[color:var(--color-ink-1)]',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[#3987e5] shadow-[0_0_8px_rgba(57,135,229,0.8)]" />
                        )}
                        <item.icon
                          size={17}
                          strokeWidth={2}
                          className={isActive ? 'text-[#7ab1f2]' : 'text-[color:var(--color-ink-3)] group-hover:text-[color:var(--color-ink-2)]'}
                        />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/[0.06] p-4">
        <p className="text-[11px] leading-relaxed text-[color:var(--color-ink-3)]">
          여수 스마트 산업단지 통합 안전관리 플랫폼 개발<br />
          발주사: 한전KDN 스마트에너지사업부
        </p>
      </div>
    </aside>
  )
}
