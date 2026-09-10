import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { ShieldCheck } from 'lucide-react'
import { navItems } from './nav'

const sections = Array.from(new Set(navItems.map((n) => n.section)))

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
          <ShieldCheck size={20} />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-slate-900">여수 스마트 산업단지</p>
          <p className="text-xs text-slate-500">통합 안전관리 플랫폼</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section} className="mb-5">
            <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
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
                        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                      )
                    }
                  >
                    <item.icon size={17} strokeWidth={2} />
                    {item.label}
                  </NavLink>
                ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-4">
        <p className="text-[11px] leading-relaxed text-slate-400">
          여수 스마트 산업단지 통합 안전관리 플랫폼 개발<br />
          발주사: 한전KDN 스마트에너지사업부
        </p>
      </div>
    </aside>
  )
}
