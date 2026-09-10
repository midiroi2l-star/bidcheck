import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { ShieldCheck, X } from 'lucide-react'
import { navItems } from './nav'

const sections = Array.from(new Set(navItems.map((n) => n.section)))

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-30 lg:hidden">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-white/[0.06] bg-[color:var(--color-bg-elevated)] shadow-2xl">
        <div className="flex h-16 items-center justify-between border-b border-white/[0.06] px-4">
          <div className="flex items-center gap-2">
            <div className="glow-ring flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#3987e5] to-[#1c5cab] text-white">
              <ShieldCheck size={20} />
            </div>
            <p className="text-sm font-bold text-[color:var(--color-ink-1)]">통합 안전관리 플랫폼</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-[color:var(--color-ink-3)] hover:bg-white/[0.06]">
            <X size={20} />
          </button>
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
                      onClick={onClose}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium',
                          isActive
                            ? 'bg-[#3987e5]/12 text-[color:var(--color-ink-1)]'
                            : 'text-[color:var(--color-ink-2)] hover:bg-white/[0.05]',
                        )
                      }
                    >
                      <item.icon size={17} />
                      {item.label}
                    </NavLink>
                  ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </div>
  )
}
