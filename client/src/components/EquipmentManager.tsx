import { useState } from 'react'
import { Card, CardHeader, Button, Badge } from './ui/Primitives'
import { Modal } from './ui/Modal'
import { useToast } from './ui/Toast'
import { useConfirm } from './ui/ConfirmDialog'
import { useEquipmentDefinitions, saveEquipment, removeEquipment } from '../hooks/useEquipment'
import type { EquipmentDefinition, EquipmentField, ValidationRule } from '../types'
import { Plus, Pencil, Trash2, Loader2, Wrench, X, ArrowUp, ArrowDown, Settings2 } from 'lucide-react'

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

type RuleKind = 'none' | 'range' | 'equals' | 'thresholdBelow' | 'thresholdAbove' | 'greaterThan' | 'lessThan'

const RULE_OPTIONS: { value: RuleKind; label: string }[] = [
  { value: 'none', label: 'Aucune (informatif)' },
  { value: 'range', label: 'Plage normale (min – max)' },
  { value: 'equals', label: 'Valeur cible (= x)' },
  { value: 'thresholdBelow', label: 'Alerte sous un seuil (≤ x)' },
  { value: 'thresholdAbove', label: 'Alerte au-dessus d’un seuil (≥ x)' },
  { value: 'greaterThan', label: 'Alerte si supérieur à (> x)' },
  { value: 'lessThan', label: 'Alerte si inférieur à (< x)' },
]

// Editable form model for a single parameter.
interface FieldDraft {
  uid: string
  key: string
  label: string
  unit: string
  kind: 'number' | 'text'
  recordedOn: number[]
  helpText: string
  ruleKind: RuleKind
  a: string // range min / equals / threshold value
  b: string // range max
}

let uidSeq = 0
const nextUid = () => `f${uidSeq++}`

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

function ruleToDraft(rule?: ValidationRule): Pick<FieldDraft, 'ruleKind' | 'a' | 'b'> {
  if (!rule) return { ruleKind: 'none', a: '', b: '' }
  if (rule.min !== undefined || rule.max !== undefined)
    return { ruleKind: 'range', a: rule.min?.toString() ?? '', b: rule.max?.toString() ?? '' }
  if (rule.equals !== undefined) return { ruleKind: 'equals', a: String(rule.equals), b: '' }
  if (rule.thresholdBelow !== undefined) return { ruleKind: 'thresholdBelow', a: String(rule.thresholdBelow), b: '' }
  if (rule.thresholdAbove !== undefined) return { ruleKind: 'thresholdAbove', a: String(rule.thresholdAbove), b: '' }
  if (rule.greaterThan !== undefined) return { ruleKind: 'greaterThan', a: String(rule.greaterThan), b: '' }
  if (rule.lessThan !== undefined) return { ruleKind: 'lessThan', a: String(rule.lessThan), b: '' }
  return { ruleKind: 'none', a: '', b: '' }
}

function fieldToDraft(f: EquipmentField): FieldDraft {
  return {
    uid: nextUid(),
    key: f.id,
    label: f.label,
    unit: f.unit ?? '',
    kind: f.kind === 'text' ? 'text' : 'number',
    recordedOn: f.recordedOn ?? [],
    helpText: f.helpText ?? '',
    ...ruleToDraft(f.rule),
  }
}

function emptyDraft(): FieldDraft {
  return { uid: nextUid(), key: '', label: '', unit: '', kind: 'number', recordedOn: [], helpText: '', ruleKind: 'range', a: '', b: '' }
}

function draftToRule(d: FieldDraft): ValidationRule | undefined {
  const a = d.a.trim() === '' ? undefined : Number(d.a)
  const b = d.b.trim() === '' ? undefined : Number(d.b)
  switch (d.ruleKind) {
    case 'range':
      return a === undefined && b === undefined ? undefined : { min: a, max: b }
    case 'equals':
      return a === undefined ? undefined : { equals: a }
    case 'thresholdBelow':
      return a === undefined ? undefined : { thresholdBelow: a }
    case 'thresholdAbove':
      return a === undefined ? undefined : { thresholdAbove: a }
    case 'greaterThan':
      return a === undefined ? undefined : { greaterThan: a }
    case 'lessThan':
      return a === undefined ? undefined : { lessThan: a }
    default:
      return undefined
  }
}

export function EquipmentManager({ canManage = false }: { canManage?: boolean }) {
  const { definitions } = useEquipmentDefinitions()
  const [editing, setEditing] = useState<EquipmentDefinition | 'new' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const toast = useToast()
  const confirm = useConfirm()

  const onDelete = async (def: EquipmentDefinition) => {
    const ok = await confirm({
      title: 'Supprimer l’équipement',
      message: `Supprimer « ${def.name} » et tous ses paramètres ? Les inspections, affectations et l’historique liés à cet équipement seront également supprimés. Action irréversible.`,
      confirmLabel: 'Supprimer',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(def.id)
    try {
      await removeEquipment(def.id)
      toast.success('Équipement supprimé', def.name)
    } catch (err) {
      console.error('[equipment] delete failed', err)
      toast.error('Suppression impossible', 'La modification n’a pas pu être appliquée.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Équipements et paramètres"
          subtitle="Créez et configurez les équipements suivis et leurs paramètres de contrôle"
          action={
            canManage ? (
              <Button size="sm" variant="primary" onClick={() => setEditing('new')}>
                <Plus className="h-3.5 w-3.5" /> Nouvel équipement
              </Button>
            ) : undefined
          }
        />
        <div className="p-5">
          {definitions.length === 0 ? (
            <p className="py-8 text-center text-sm text-[--color-graphite-500]">Aucun équipement configuré.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {definitions.map((def) => (
                <div key={def.id} className="flex flex-col rounded-2xl border border-[--color-graphite-100] bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[--color-brand-50] text-[--color-brand-600]"><Wrench className="h-4 w-4" /></span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[--color-graphite-900]">{def.name}</p>
                        <p className="truncate font-mono text-[11px] text-[--color-graphite-400]">{def.id}</p>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setEditing(def)} title="Modifier" className="flex h-7 w-7 items-center justify-center rounded-lg text-[--color-graphite-400] transition-colors hover:bg-[--color-graphite-50] hover:text-[--color-graphite-900]"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => onDelete(def)} disabled={busy === def.id} title="Supprimer" className="flex h-7 w-7 items-center justify-center rounded-lg text-[--color-graphite-400] transition-colors hover:bg-[--color-status-critical-bg] hover:text-[--color-status-critical] disabled:opacity-40">
                          {busy === def.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Badge>{def.fields.length} paramètre{def.fields.length > 1 ? 's' : ''}</Badge>
                  </div>
                  <ul className="mt-2 space-y-0.5 text-xs text-[--color-graphite-500]">
                    {def.fields.slice(0, 6).map((f) => (
                      <li key={f.id} className="flex justify-between gap-2">
                        <span className="truncate">{f.label}</span>
                        {f.unit && <span className="shrink-0 text-[--color-graphite-400]">{f.unit}</span>}
                      </li>
                    ))}
                    {def.fields.length > 6 && <li className="text-[--color-graphite-400]">+ {def.fields.length - 6} autre(s)…</li>}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {editing && (
        <EquipmentFormModal
          existing={editing === 'new' ? null : editing}
          existingIds={new Set(definitions.map((d) => d.id))}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function EquipmentFormModal({
  existing,
  existingIds,
  onClose,
  onSaved,
}: {
  existing: EquipmentDefinition | null
  existingIds: Set<string>
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const isEdit = existing !== null
  const [name, setName] = useState(existing?.name ?? '')
  const [fields, setFields] = useState<FieldDraft[]>(existing ? existing.fields.map(fieldToDraft) : [emptyDraft()])
  const [saving, setSaving] = useState(false)

  const previewId = existing?.id ?? slugify(name)

  const patchField = (uid: string, patch: Partial<FieldDraft>) =>
    setFields((prev) => prev.map((f) => (f.uid === uid ? { ...f, ...patch } : f)))

  const addField = () => setFields((prev) => [...prev, emptyDraft()])
  const removeField = (uid: string) => setFields((prev) => prev.filter((f) => f.uid !== uid))
  const move = (index: number, dir: -1 | 1) =>
    setFields((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  const toggleDay = (uid: string, day: number) =>
    setFields((prev) =>
      prev.map((f) => {
        if (f.uid !== uid) return f
        const on = f.recordedOn.includes(day)
        return { ...f, recordedOn: on ? f.recordedOn.filter((d) => d !== day) : [...f.recordedOn, day].sort() }
      }),
    )

  const save = async () => {
    if (!name.trim()) {
      toast.warning('Nom requis', 'Renseignez le nom de l’équipement.')
      return
    }
    if (!isEdit && existingIds.has(previewId)) {
      toast.warning('Équipement déjà existant', `Un équipement « ${previewId} » existe déjà.`)
      return
    }
    const cleaned = fields.filter((f) => f.label.trim())
    if (cleaned.length === 0) {
      toast.warning('Aucun paramètre', 'Ajoutez au moins un paramètre avec un libellé.')
      return
    }
    // Resolve keys and guard against duplicates.
    const keys = new Set<string>()
    for (const f of cleaned) {
      const key = f.key.trim() || slugify(f.label)
      if (keys.has(key)) {
        toast.warning('Paramètre en double', `Deux paramètres partagent l’identifiant « ${key} ».`)
        return
      }
      keys.add(key)
    }

    const payloadFields: EquipmentField[] = cleaned.map((f) => ({
      id: f.key.trim() || slugify(f.label),
      label: f.label.trim(),
      unit: f.unit.trim() || undefined,
      kind: f.kind,
      recordedOn: f.recordedOn,
      helpText: f.helpText.trim() || undefined,
      rule: draftToRule(f),
    }))

    setSaving(true)
    try {
      await saveEquipment({ id: existing?.id, name: name.trim(), fields: payloadFields })
      toast.success(isEdit ? 'Équipement mis à jour' : 'Équipement créé', name.trim())
      onSaved()
    } catch (err) {
      console.error('[equipment] save failed', err)
      toast.error('Enregistrement impossible', (err as Error).message?.replace(/^API.*?:\s*/, '') || 'Vérifiez les valeurs saisies.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Modifier l’équipement' : 'Nouvel équipement'}
      subtitle={isEdit ? existing!.name : 'Nom, paramètres et règles de contrôle'}
      icon={<Settings2 className="h-5 w-5" />}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" disabled={saving} onClick={save}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enregistrer</Button>
        </>
      }
    >
      <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[--color-graphite-500]">Nom de l’équipement</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Chaudière" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[--color-graphite-500]">Identifiant {isEdit && '(non modifiable)'}</span>
            <input value={previewId} disabled className={`${inputCls} bg-[--color-graphite-50] font-mono text-[--color-graphite-500]`} />
          </label>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[--color-graphite-500]">Paramètres</p>
            <Button size="sm" variant="secondary" onClick={addField}><Plus className="h-3.5 w-3.5" /> Ajouter un paramètre</Button>
          </div>

          <div className="space-y-3">
            {fields.map((f, index) => (
              <div key={f.uid} className="rounded-xl border border-[--color-graphite-200] bg-[--color-graphite-50]/50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[--color-graphite-400]">Paramètre {index + 1}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => move(index, -1)} disabled={index === 0} title="Monter" className="flex h-6 w-6 items-center justify-center rounded text-[--color-graphite-400] hover:bg-white disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button onClick={() => move(index, 1)} disabled={index === fields.length - 1} title="Descendre" className="flex h-6 w-6 items-center justify-center rounded text-[--color-graphite-400] hover:bg-white disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button onClick={() => removeField(f.uid)} title="Retirer" className="flex h-6 w-6 items-center justify-center rounded text-[--color-graphite-400] hover:bg-[--color-status-critical-bg] hover:text-[--color-status-critical]"><X className="h-3.5 w-3.5" /></button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="col-span-2 block sm:col-span-2">
                    <span className={labelCls}>Libellé</span>
                    <input value={f.label} onChange={(e) => patchField(f.uid, { label: e.target.value })} placeholder="ex. Température" className={inputSm} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Unité</span>
                    <input value={f.unit} onChange={(e) => patchField(f.uid, { unit: e.target.value })} placeholder="°C" className={inputSm} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Type</span>
                    <select value={f.kind} onChange={(e) => patchField(f.uid, { kind: e.target.value as 'number' | 'text' })} className={inputSm}>
                      <option value="number">Numérique</option>
                      <option value="text">Texte</option>
                    </select>
                  </label>
                </div>

                {f.kind === 'number' && (
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label className="block">
                      <span className={labelCls}>Règle de contrôle</span>
                      <select value={f.ruleKind} onChange={(e) => patchField(f.uid, { ruleKind: e.target.value as RuleKind })} className={inputSm}>
                        {RULE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    {f.ruleKind === 'range' ? (
                      <>
                        <label className="block">
                          <span className={labelCls}>Minimum</span>
                          <input type="number" value={f.a} onChange={(e) => patchField(f.uid, { a: e.target.value })} placeholder="min" className={inputSm} />
                        </label>
                        <label className="block">
                          <span className={labelCls}>Maximum</span>
                          <input type="number" value={f.b} onChange={(e) => patchField(f.uid, { b: e.target.value })} placeholder="max" className={inputSm} />
                        </label>
                      </>
                    ) : f.ruleKind !== 'none' ? (
                      <label className="block sm:col-span-2">
                        <span className={labelCls}>Valeur</span>
                        <input type="number" value={f.a} onChange={(e) => patchField(f.uid, { a: e.target.value })} placeholder="valeur" className={inputSm} />
                      </label>
                    ) : null}
                  </div>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={labelCls}>Jours de relevé</span>
                  <div className="flex flex-wrap gap-1">
                    {DAY_LABELS.map((label, day) => {
                      const on = f.recordedOn.includes(day)
                      return (
                        <button
                          key={day}
                          onClick={() => toggleDay(f.uid, day)}
                          className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${on ? 'border-[--color-brand-300] bg-[--color-brand-50] text-[--color-brand-700]' : 'border-[--color-graphite-200] bg-white text-[--color-graphite-500] hover:bg-[--color-graphite-50]'}`}
                        >
                          {label}
                        </button>
                      )
                    })}
                    <span className="self-center text-[11px] text-[--color-graphite-400]">{f.recordedOn.length === 0 ? '(tous les jours)' : ''}</span>
                  </div>
                </div>

                <label className="mt-2 block">
                  <span className={labelCls}>Aide (optionnel)</span>
                  <input value={f.helpText} onChange={(e) => patchField(f.uid, { helpText: e.target.value })} placeholder="Note affichée sous le champ" className={inputSm} />
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

const inputCls = 'w-full rounded-lg border border-[--color-graphite-200] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[--color-brand-500]'
const inputSm = 'w-full rounded-lg border border-[--color-graphite-200] bg-white px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-[--color-brand-500]'
const labelCls = 'mb-1 block text-[11px] font-medium text-[--color-graphite-500]'
