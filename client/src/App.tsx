import { useEffect, useState } from 'react'
import { SignedIn, SignedOut, SignIn, UserButton, useAuth, useUser, useClerk } from '@clerk/clerk-react'
import { InspectionForm } from './components/InspectionForm'
import { Dashboard } from './components/Dashboard'
import { History } from './components/History'
import { ImportExport } from './components/ImportExport'
import { EquipmentParametersDetails } from './components/EquipmentParametersDetails'
import { AdminAssignments } from './components/AdminAssignments'
import { useInspections } from './hooks/useData'
import { setAuthTokenGetter } from './lib/storage'
import { LayoutDashboard, ClipboardList, History as HistoryIcon, FileSpreadsheet, Factory, Search, Bell, LifeBuoy, LogOut, Users } from 'lucide-react'

type Tab = 'dashboard' | 'inspection' | 'history' | 'excel' | 'assignments'
type Role = 'admin' | 'technician'

const ALL_TABS: { id: Tab; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'inspection', label: 'Inspection du jour', icon: <ClipboardList className="h-4 w-4" /> },
  { id: 'history', label: 'Historique', icon: <HistoryIcon className="h-4 w-4" /> },
  { id: 'excel', label: 'Import / Export', icon: <FileSpreadsheet className="h-4 w-4" />, adminOnly: true },
  { id: 'assignments', label: 'Affectations', icon: <Users className="h-4 w-4" />, adminOnly: true },
]

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
          <SignIn />
        </div>
      </SignedOut>
      <SignedIn>
        <AuthenticatedApp />
      </SignedIn>
    </>
  )
}

function AuthenticatedApp() {
  useAuthTokenBridge()
  const { user } = useUser()
  const { signOut } = useClerk()
  const role: Role = (user?.publicMetadata?.role as string | undefined) === 'admin' ? 'admin' : 'technician'
  const tabs = ALL_TABS.filter((t) => !t.adminOnly || role === 'admin')

  const [tab, setTab] = useState<Tab>('dashboard')
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null)
  const { items: inspections } = useInspections()

  const activeTitle = selectedEquipmentId
    ? 'Parameter details'
    : tab === 'dashboard'
      ? 'Dashboard'
      : tab === 'inspection'
        ? 'Inspection du jour'
        : tab === 'history'
          ? 'Historique'
          : tab === 'assignments'
            ? 'Affectations'
            : 'Import / Export'

  const openEquipmentDetails = (equipmentId: string) => {
    setSelectedEquipmentId(equipmentId)
    setTab('dashboard')
  }

  const closeEquipmentDetails = () => {
    setSelectedEquipmentId(null)
    setTab('dashboard')
  }

  const displayName = user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'Utilisateur'
  const roleLabel = role === 'admin' ? 'Administrateur' : 'Technicien'

  return (
    <div className="min-h-screen bg-white">
      <div className="flex min-h-screen">
        <aside className="flex h-screen w-70 flex-col border-r border-[--color-graphite-100] bg-white px-4 py-5">
          <div className="flex items-center gap-3 rounded-2xl bg-[--color-graphite-50] px-4 py-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[--color-amber-signal] text-black shadow-sm">
              <Factory className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-base font-semibold uppercase tracking-[0.12em] text-[--color-graphite-900]">SBM Tunisie</p>
              <p className="text-xs text-[--color-graphite-500]">Maintenance dashboard</p>
            </div>
          </div>

          <nav className="mt-6 space-y-2">
            {tabs.map((t) => {
              const active = tab === t.id && !selectedEquipmentId
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedEquipmentId(null)
                    setTab(t.id)
                  }}
                  className={`flex w-full items-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition-all ${
                    active
                      ? 'bg-[--color-status-normal-bg] text-[--color-status-normal] shadow-sm'
                      : 'text-[--color-graphite-500] hover:bg-[--color-graphite-50] hover:text-[--color-graphite-900]'
                  }`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${active ? 'bg-white/70' : 'bg-[--color-graphite-50]'}`}>
                    {t.icon}
                  </span>
                  <span>{t.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="mt-auto space-y-3 border-t border-[--color-graphite-100] pt-4">
            <button className="flex w-full items-center gap-3 rounded-full px-4 py-3 text-sm text-[--color-graphite-500] hover:bg-[--color-graphite-50] hover:text-[--color-graphite-900]">
              <LifeBuoy className="h-4 w-4" />
              Help &amp; information
            </button>
            <button
              onClick={() => signOut()}
              className="flex w-full items-center gap-3 rounded-full px-4 py-3 text-sm text-[--color-graphite-500] hover:bg-[--color-graphite-50] hover:text-[--color-graphite-900]"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col bg-[--color-graphite-50]">
          <header className="border-b border-[--color-graphite-100] bg-white px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[--color-graphite-500]">{activeTitle}</p>
                <h1 className="mt-1 font-display text-2xl font-semibold uppercase tracking-[0.12em] text-[--color-graphite-900]">Contrôle journalier des équipements</h1>
              </div>

              <div className="flex flex-1 items-center justify-end gap-3">
                <label className="relative hidden max-w-85 flex-1 md:block">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[--color-graphite-400]" />
                  <input
                    type="search"
                    placeholder="Search inspections, equipment, technicians"
                    className="w-full rounded-full border border-[--color-graphite-100] bg-[--color-graphite-50] py-3 pl-11 pr-4 text-sm outline-none transition-colors focus:border-[--color-amber-signal]"
                  />
                </label>
                <button className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[--color-graphite-100] bg-white text-[--color-graphite-500] shadow-sm transition-colors hover:text-[--color-graphite-900]">
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-[--color-status-critical]" />
                </button>
                <div className="flex items-center gap-3 rounded-full border border-[--color-graphite-100] bg-white px-3 py-2 shadow-sm">
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-semibold text-[--color-graphite-900]">{displayName}</p>
                    <p className="text-xs text-[--color-graphite-500]">{roleLabel}</p>
                  </div>
                  <UserButton />
                </div>
              </div>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            {selectedEquipmentId ? (
              <EquipmentParametersDetails
                equipmentId={selectedEquipmentId}
                inspections={inspections}
                onBack={closeEquipmentDetails}
              />
            ) : tab === 'dashboard' ? (
              <Dashboard inspections={inspections} onSelectEquipment={openEquipmentDetails} />
            ) : null}
            {tab === 'inspection' && !selectedEquipmentId && <InspectionForm role={role} />}
            {tab === 'history' && !selectedEquipmentId && <History inspections={inspections} />}
            {tab === 'excel' && !selectedEquipmentId && role === 'admin' && <ImportExport />}
            {tab === 'assignments' && !selectedEquipmentId && role === 'admin' && <AdminAssignments />}
          </main>

          <footer className="border-t border-[--color-graphite-100] bg-white px-6 py-4 text-center text-xs text-[--color-graphite-500]">
            SBM Tunisie — Contrôle journalier des équipements. Connecté en tant que {displayName} ({roleLabel}).
          </footer>
        </div>
      </div>
    </div>
  )
}
