import { useClerk } from '@clerk/clerk-react'
import { UserCog, Sparkles, PanelLeft, Info, Database } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Primitives'
import type { Preferences } from '../hooks/usePreferences'

interface SettingsPanelProps {
  open: boolean
  onClose: () => void
  prefs: Preferences
  onToggle: (key: keyof Preferences) => void
  user: { name: string; email: string; roleLabel: string }
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
        checked ? 'bg-blue-400' : 'bg-gray-400'
      }`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

function Row({ icon, title, description, control }: { icon: React.ReactNode; title: string; description: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[--color-graphite-50] text-[--color-graphite-500]">{icon}</div>
        <div>
          <p className="text-sm font-medium text-[--color-graphite-900]">{title}</p>
          <p className="text-xs text-[--color-graphite-500]">{description}</p>
        </div>
      </div>
      {control}
    </div>
  )
}

export function SettingsPanel({ open, onClose, prefs, onToggle, user }: SettingsPanelProps) {
  const { openUserProfile } = useClerk()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Paramètres"
      subtitle={`${user.name} · ${user.roleLabel}`}
      icon={<UserCog className="h-5 w-5" />}
      size="md"
      footer={<Button variant="secondary" onClick={onClose}>Fermer</Button>}
    >
      <div className="space-y-6">
        <section>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[--color-graphite-400]">Compte</p>
          <Row
            icon={<UserCog className="h-4 w-4" />}
            title={user.email}
            description="Gérer le profil, l'email et le mot de passe via Clerk"
            control={<Button size="sm" variant="secondary" onClick={() => openUserProfile()}>Gérer</Button>}
          />
        </section>

        <section className="border-t border-[--color-graphite-100] pt-2">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[--color-graphite-400]">Préférences</p>
          <div className="divide-y divide-[--color-graphite-100]">
            <Row
              icon={<Sparkles className="h-4 w-4" />}
              title="Réduire les animations"
              description="Désactive les transitions et effets de mouvement"
              control={<Toggle checked={prefs.reduceMotion} onChange={() => onToggle('reduceMotion')} label="Réduire les animations" />}
            />
            <Row
              icon={<PanelLeft className="h-4 w-4" />}
              title="Barre latérale réduite"
              description="Afficher la navigation en mode icônes par défaut"
              control={<Toggle checked={prefs.sidebarCollapsed} onChange={() => onToggle('sidebarCollapsed')} label="Barre latérale réduite" />}
            />
          </div>
        </section>

        <section className="border-t border-[--color-graphite-100] pt-2">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[--color-graphite-400]">À propos</p>
          <Row
            icon={<Database className="h-4 w-4" />}
            title="Données"
            description="Stockées sur PostgreSQL (Aiven) — synchronisées en temps réel"
            control={<span className="inline-flex items-center gap-1.5 rounded-full bg-[--color-status-normal-bg] px-2.5 py-1 text-[11px] font-medium text-[--color-status-normal]"><span className="h-1.5 w-1.5 rounded-full bg-[--color-status-normal]" />Connecté</span>}
          />
          <Row
            icon={<Info className="h-4 w-4" />}
            title="Contrôle journalier des équipements"
            description="SBM Tunisie · version 1.0"
            control={null}
          />
        </section>
      </div>
    </Modal>
  )
}
