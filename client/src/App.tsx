import { useEffect, useMemo, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut, SignIn, SignUp, useAuth, useUser, useClerk } from '@clerk/clerk-react'
import { InspectionForm } from './components/InspectionForm'
import { Dashboard } from './components/Dashboard'
import { History } from './components/History'
import { ImportExport } from './components/ImportExport'
import { EquipmentParametersDetails } from './components/EquipmentParametersDetails'
import { AdminAssignments } from './components/AdminAssignments'
import { Sidebar, type NavItem } from './components/layout/Sidebar'
import { SettingsPanel } from './components/SettingsPanel'
import { NotificationBell } from './components/NotificationBell'
import { MaintenancePanel } from './components/MaintenancePanel'
import { MonitoringPage } from './components/MonitoringPage'
import { EquipmentManager } from './components/EquipmentManager'
import { UserManagement } from './components/UserManagement'
import { ToastProvider } from './components/ui/Toast'
import { ConfirmProvider } from './components/ui/ConfirmDialog'
import { useInspections } from './hooks/useData'
import { usePreferences } from './hooks/usePreferences'
import { setAuthTokenGetter } from './lib/storage'
import { LayoutDashboard, ClipboardList, History as HistoryIcon, FileSpreadsheet, Users, Wrench, MonitorDot, ShieldAlert, Search, Menu, Boxes } from 'lucide-react'

type Tab = 'dashboard' | 'monitoring' | 'inspection' | 'history' | 'maintenance' | 'equipment' | 'excel' | 'assignments' | 'users'
type Role = 'moderator' | 'admin' | 'technician'

const ALL_TABS: (NavItem & { adminOnly?: boolean; moderatorOnly?: boolean })[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'monitoring', label: 'Supervision', icon: <MonitorDot className="h-4 w-4" /> },
  { id: 'inspection', label: 'Inspection du jour', icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'history', label: 'Historique', icon: <HistoryIcon className="h-4 w-4" /> },
  { id: 'maintenance', label: 'Entretien', icon: <Wrench className="h-4 w-4" /> },
  { id: 'equipment', label: 'Équipements', icon: <Boxes className="h-4 w-4" />, adminOnly: true },
  { id: 'excel', label: 'Import / Export', icon: <FileSpreadsheet className="h-4 w-4" />, adminOnly: true },
  { id: 'assignments', label: 'Affectations', icon: <Users className="h-4 w-4" />, adminOnly: true },
  { id: 'users', label: 'Utilisateurs', icon: <ShieldAlert className="h-4 w-4" />, moderatorOnly: true },
]

const TAB_TITLES: Record<Tab, string> = {
  dashboard: 'Tableau de bord',
  monitoring: 'Supervision',
  inspection: 'Inspection du jour',
  history: 'Historique',
  maintenance: 'Entretien périodique',
  equipment: 'Équipements et paramètres',
  excel: 'Import / Export',
  assignments: 'Affectations des équipements',
  users: 'Gestion des utilisateurs',
}

/** Bridges Clerk's getToken() into the storage layer so API calls are authenticated. */
function useAuthTokenBridge() {
  const { getToken } = useAuth()
  useEffect(() => {
    setAuthTokenGetter(() => getToken())
  }, [getToken])
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[--color-graphite-50] p-6">
      <div className="animate-fade-in-up">{children}</div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Path-based Clerk pages so `__clerk_ticket` (invitation accept) and other
          query params are read straight from the real URL. */}
      <Route
        path="/sign-up/*"
        element={<AuthLayout><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" /></AuthLayout>}
      />
      <Route
        path="/sign-in/*"
        element={<AuthLayout><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" /></AuthLayout>}
      />
      <Route
        path="/*"
        element={
          <>
            {/* Path-routed <SignIn> only renders when the URL matches its `path`,
                so send signed-out users to the dedicated /sign-in route. */}
            <SignedOut>
              <Navigate to="/sign-in" replace />
            </SignedOut>
            <SignedIn>
              <ToastProvider>
                <ConfirmProvider>
                  <AuthenticatedApp />
                </ConfirmProvider>
              </ToastProvider>
            </SignedIn>
          </>
        }
      />
    </Routes>
  )
}

function AuthenticatedApp() {
  useAuthTokenBridge()
  const { user } = useUser()
  const { signOut } = useClerk()
  const { prefs, toggle } = usePreferences()

  const rawRole = (user?.publicMetadata?.role as string | undefined)?.toLowerCase()
  // 'superuser' is accepted as a legacy alias for accounts provisioned before the rename.
  const role: Role = rawRole === 'moderator' || rawRole === 'superuser' ? 'moderator' : rawRole === 'admin' ? 'admin' : 'technician'
  const isAdmin = role === 'admin' || role === 'moderator' // moderator is a superset of admin
  const isModerator = role === 'moderator'

  // Technician tab allowlist (set by a moderator). Empty = all default tabs.
  const allowedTabsStr = (Array.isArray(user?.publicMetadata?.allowedTabs) ? (user!.publicMetadata!.allowedTabs as string[]) : []).join(',')
  const tabs = useMemo(() => {
    const allowed = allowedTabsStr ? allowedTabsStr.split(',') : []
    return ALL_TABS.filter((t) => {
      if (t.moderatorOnly) return isModerator
      if (t.adminOnly) return isAdmin
      if (isAdmin) return true // admins/moderators see every base tab
      return allowed.length === 0 || allowed.includes(t.id) // technician: restricted set
    })
  }, [allowedTabsStr, isAdmin, isModerator])

  const [tab, setTab] = useState<Tab>('dashboard')
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [historyFocusId, setHistoryFocusId] = useState<string | null>(null)
  const { items: inspections } = useInspections()

  // If the active tab isn't visible (e.g. a technician's tab access was changed), fall back.
  useEffect(() => {
    if (!selectedEquipmentId && !tabs.some((t) => t.id === tab)) {
      setTab((tabs[0]?.id as Tab) ?? 'dashboard')
    }
  }, [tabs, tab, selectedEquipmentId])

  // Open a specific inspection in History (from a notification or an email deep-link).
  const focusInspection = (inspectionId: string) => {
    setSelectedEquipmentId(null)
    setTab('history')
    setHistoryFocusId(inspectionId)
    setMobileNavOpen(false)
  }

  // Email links point at /?inspection=<id> or /?tab=maintenance — honor once on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = params.get('inspection')
    const targetTab = params.get('tab')
    if (id) {
      focusInspection(id)
    } else if (targetTab === 'maintenance') {
      setSelectedEquipmentId(null)
      setTab('maintenance')
    }
    if (id || targetTab) window.history.replaceState({}, '', window.location.pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const displayName = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'Utilisateur'
  const roleLabel = role === 'moderator' ? 'Modérateur' : role === 'admin' ? 'Administrateur' : 'Technicien'
  const position = (user?.publicMetadata?.position as string | undefined) ?? ''
  const roleSubtitle = position || roleLabel
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
        user={{ name: displayName, roleLabel: roleSubtitle, imageUrl: user?.hasImage ? user.imageUrl : undefined }}
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
              <div className='min-w-0'>
                <img src="/public/images/logo-sbm.jpg" alt="SBM Tunisie" className="h-11 w-39" />
              </div>
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
              <NotificationBell onNavigate={focusInspection} />
            </div>
          </div>
        </header>

        <main key={selectedEquipmentId ?? tab} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="animate-fade-in-up">
            {selectedEquipmentId ? (
              <EquipmentParametersDetails equipmentId={selectedEquipmentId} inspections={inspections} onBack={closeEquipmentDetails} />
            ) : tab === 'dashboard' ? (
              <Dashboard inspections={inspections} onSelectEquipment={openEquipmentDetails} />
            ) : tab === 'monitoring' ? (
              <MonitoringPage />
            ) : tab === 'inspection' ? (
              <InspectionForm role={isAdmin ? 'admin' : 'technician'} />
            ) : tab === 'history' ? (
              <History inspections={inspections} focusInspectionId={historyFocusId} canModify={isAdmin} />
            ) : tab === 'maintenance' ? (
              <MaintenancePanel canManage={isAdmin} />
            ) : tab === 'equipment' && isAdmin ? (
              <EquipmentManager canManage={isAdmin} />
            ) : tab === 'excel' && isAdmin ? (
              <ImportExport />
            ) : tab === 'assignments' && isAdmin ? (
              <AdminAssignments />
            ) : tab === 'users' && isModerator ? (
              <UserManagement />
            ) : null}
          </div>
        </main>
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        prefs={prefs}
        onToggle={toggle}
        user={{ name: displayName, email, roleLabel: position ? `${position} · ${roleLabel}` : roleLabel }}
      />
    </div>
  )
}
