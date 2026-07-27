import { useEffect, useState } from 'react'
import { SignedIn, SignedOut, SignIn, useAuth, useUser, useClerk } from '@clerk/clerk-react'
import { InspectionForm } from './components/InspectionForm'
import { Dashboard } from './components/Dashboard'
import { History } from './components/History'
import { ImportExport } from './components/ImportExport'
import { EquipmentParametersDetails } from './components/EquipmentParametersDetails'
import { AdminAssignments } from './components/AdminAssignments'
import { Sidebar, type NavItem } from './components/layout/Sidebar'
import { SettingsPanel } from './components/SettingsPanel'
import { ToastProvider } from './components/ui/Toast'
import { ConfirmProvider } from './components/ui/ConfirmDialog'
import { useInspections } from './hooks/useData'
import { usePreferences } from './hooks/usePreferences'
import { setAuthTokenGetter } from './lib/storage'
import { LayoutDashboard, ClipboardList, History as HistoryIcon, FileSpreadsheet, Users, Search, Bell, Menu } from 'lucide-react'

type Tab = 'dashboard' | 'inspection' | 'history' | 'excel' | 'assignments'
type Role = 'admin' | 'technician'

const ALL_TABS: (NavItem & { adminOnly?: boolean })[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'inspection', label: 'Inspection du jour', icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'history', label: 'Historique', icon: <HistoryIcon className="h-4 w-4" /> },
  { id: 'excel', label: 'Import / Export', icon: <FileSpreadsheet className="h-4 w-4" />, adminOnly: true },
  { id: 'assignments', label: 'Affectations', icon: <Users className="h-4 w-4" />, adminOnly: true },
]

const TAB_TITLES: Record<Tab, string> = {
  dashboard: 'Tableau de bord',
  inspection: 'Inspection du jour',
  history: 'Historique',
  excel: 'Import / Export',
  assignments: 'Affectations des équipements',
}

/** Bridges Clerk's getToken() into the storage layer so API calls are authenticated. */
function useAuthTokenBridge() {
  const { getToken } = useAuth()
  useEffect(() => {
    setAuthTokenGetter(() => getToken())
  }, [getToken])
}

export default function App() {
  return (
    <>
      <SignedOut>
        <div className="flex min-h-screen items-center justify-center bg-[--color-graphite-50] p-6">
          <div className="animate-fade-in-up">
            <SignIn />
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <ToastProvider>
          <ConfirmProvider>
            <AuthenticatedApp />
          </ConfirmProvider>
        </ToastProvider>
      </SignedIn>
    </>
  )
}

function AuthenticatedApp() {
  useAuthTokenBridge()
  const { user } = useUser()
  const { signOut } = useClerk()
  const { prefs, toggle } = usePreferences()

  const role: Role = (user?.publicMetadata?.role as string | undefined) === 'admin' ? 'admin' : 'technician'
  const tabs = ALL_TABS.filter((t) => !t.adminOnly || role === 'admin')

  const [tab, setTab] = useState<Tab>('dashboard')
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { items: inspections } = useInspections()

  const displayName = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'Utilisateur'
  const roleLabel = role === 'admin' ? 'Administrateur' : 'Technicien'
  const email = user?.primaryEmailAddress?.emailAddress ?? ''

  const openEquipmentDetails = (equipmentId: string) => {
    setSelectedEquipmentId(equipmentId)
    setTab('dashboard')
  }
  const closeEquipmentDetails = () => setSelectedEquipmentId(null)

  const selectTab = (id: string) => {
    setSelectedEquipmentId(null)
    setTab(id as Tab)
  }

  const pageTitle = selectedEquipmentId ? 'Détails du paramètre' : TAB_TITLES[tab]

  return (
    <div className="flex h-dvh overflow-hidden bg-[--color-graphite-50]">
      <Sidebar
        items={tabs}
        activeId={selectedEquipmentId ? '' : tab}
        onSelect={selectTab}
        collapsed={prefs.sidebarCollapsed}
        onToggleCollapse={() => toggle('sidebarCollapsed')}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        user={{ name: displayName, roleLabel, imageUrl: user?.hasImage ? user.imageUrl : undefined }}
        onOpenSettings={() => setSettingsOpen(true)}
        onSignOut={() => signOut()}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-[--color-graphite-100] bg-white/85 px-4 py-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setMobileNavOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[--color-graphite-200] text-[--color-graphite-500] transition-colors hover:bg-[--color-graphite-50] lg:hidden"
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[--color-graphite-400]">SBM Tunisie · Maintenance</p>
                <h1 className="truncate text-xl font-bold tracking-tight text-[--color-graphite-900] sm:text-2xl">{pageTitle}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <label className="relative hidden max-w-72 flex-1 md:block">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[--color-graphite-400]" />
                <input
                  type="search"
                  placeholder="Rechercher…"
                  className="w-full rounded-full border border-[--color-graphite-100] bg-[--color-graphite-50] py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-[--color-amber-signal] focus:bg-white"
                />
              </label>
              <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[--color-graphite-100] bg-white text-[--color-graphite-500] transition-colors hover:text-[--color-graphite-900]">
                <Bell className="h-4 w-4" />
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[--color-status-critical]" />
              </button>
            </div>
          </div>
        </header>

        <main key={selectedEquipmentId ?? tab} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="animate-fade-in-up">
            {selectedEquipmentId ? (
              <EquipmentParametersDetails equipmentId={selectedEquipmentId} inspections={inspections} onBack={closeEquipmentDetails} />
            ) : tab === 'dashboard' ? (
              <Dashboard inspections={inspections} role={role} onSelectEquipment={openEquipmentDetails} />
            ) : tab === 'inspection' ? (
              <InspectionForm role={role} />
            ) : tab === 'history' ? (
              <History inspections={inspections} />
            ) : tab === 'excel' && role === 'admin' ? (
              <ImportExport />
            ) : tab === 'assignments' && role === 'admin' ? (
              <AdminAssignments />
            ) : null}
          </div>
        </main>
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        prefs={prefs}
        onToggle={toggle}
        user={{ name: displayName, email, roleLabel }}
      />
    </div>
  )
}
