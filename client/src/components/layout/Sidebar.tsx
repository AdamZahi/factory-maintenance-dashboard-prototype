import { Factory, PanelLeftClose, PanelLeftOpen, Settings, LogOut } from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
}

interface SidebarProps {
  items: NavItem[]
  activeId: string
  onSelect: (id: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
  user: { name: string; roleLabel: string; imageUrl?: string }
  onOpenSettings: () => void
  onSignOut: () => void
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export function Sidebar({
  items,
  activeId,
  onSelect,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  user,
  onOpenSettings,
  onSignOut,
}: SidebarProps) {
  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="animate-overlay-in fixed inset-0 z-30 bg-[--color-graphite-950]/40 backdrop-blur-sm lg:hidden" onClick={onCloseMobile} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh flex-col border-r border-[--color-graphite-100] bg-white px-3 py-5 transition-[width,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:static lg:h-full lg:translate-x-0 ${
          collapsed ? 'lg:w-20' : 'lg:w-72'
        } w-72 ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:shadow-none'}`}
      >
        {/* Brand + collapse toggle */}
        <div className="flex items-center gap-3 rounded-2xl bg-[--color-graphite-50] px-3 py-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[--color-amber-signal] text-black shadow-sm">
            <Factory className="h-5 w-5" />
          </div>
          <div className={`min-w-0 flex-1 overflow-hidden transition-opacity duration-200 ${collapsed ? 'lg:w-0 lg:opacity-0' : 'opacity-100'}`}>
            <p className="truncate font-display text-base font-semibold uppercase tracking-[0.12em] text-[--color-graphite-900]">SBM Tunisie</p>
            <p className="truncate text-xs text-[--color-graphite-500]">Maintenance dashboard</p>
          </div>
          <button
            onClick={onToggleCollapse}
            className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-[--color-graphite-400] transition-colors hover:bg-white hover:text-[--color-graphite-900] lg:flex ${collapsed ? 'lg:hidden' : ''}`}
            aria-label="Réduire la barre latérale"
            title="Réduire"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {collapsed && (
          <button
            onClick={onToggleCollapse}
            className="mt-3 hidden h-9 w-full items-center justify-center rounded-xl text-[--color-graphite-400] transition-colors hover:bg-[--color-graphite-50] hover:text-[--color-graphite-900] lg:flex"
            aria-label="Déployer la barre latérale"
            title="Déployer"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        {/* Navigation */}
        <nav className="mt-6 min-h-0 flex-1 space-y-1.5 overflow-y-auto">
          {items.map((item) => {
            const active = item.id === activeId
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelect(item.id)
                  onCloseMobile()
                }}
                title={collapsed ? item.label : undefined}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-green-500 text-white shadow-sm'
                    : 'text-[--color-graphite-500] hover:bg-green-200 hover:text-[--color-graphite-900]'
                } ${collapsed ? 'lg:justify-center' : ''}`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    active ? 'bg-white/15 text-white' : 'bg-[--color-graphite-50] text-[--color-graphite-500] group-hover:bg-green-100  '
                  }`}
                >
                  {item.icon}
                </span>
                <span className={`truncate transition-all duration-200 ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* User card */}
        <div className="mt-auto border-t border-[--color-graphite-100] pt-4">
          <div className={`flex items-center gap-3 rounded-2xl bg-[--color-graphite-50] p-2.5 ${collapsed ? 'lg:justify-center' : ''}`}>
            {user.imageUrl ? (
              <img src={user.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs font-semibold text-white">
                {initials(user.name)}
              </div>
            )}
            <div className={`min-w-0 flex-1 overflow-hidden ${collapsed ? 'lg:hidden' : ''}`}>
              <p className="truncate text-sm font-semibold text-[--color-graphite-900]">{user.name}</p>
              <p className="truncate text-xs text-[--color-graphite-500]">{user.roleLabel}</p>
            </div>
          </div>

          <div className={`mt-2 flex gap-2 ${collapsed ? 'lg:flex-col' : ''}`}>
            <button
              onClick={onOpenSettings}
              title="Paramètres"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[--color-graphite-200] bg-white cursor-pointer px-3 py-2 text-xs font-medium text-[--color-graphite-700] transition-colors hover:bg-[--color-graphite-50]"
            >
              <Settings className="h-4 w-4" />
              <span className={collapsed ? 'lg:hidden' : ''}>Paramètres</span>
            </button>
            <button
              onClick={onSignOut}
              title="Se déconnecter"
              className="flex items-center justify-center gap-2 rounded-xl border border-[--color-graphite-200] bg-white cursor-pointer px-3 py-2 text-xs font-medium text-[--color-status-critical] transition-colors hover:bg-[--color-status-critical-bg]"
            >
              <LogOut className="h-4 w-4" />
              <span className={collapsed ? 'lg:hidden' : ''}>Quitter</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
