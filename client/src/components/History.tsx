import { Fragment, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Card, CardHeader, Button } from './ui/Primitives'
import { StatusBadge } from './ui/StatusBadge'
import { EQUIPMENT_DEFINITIONS } from '../data/equipment'
import { evaluateEquipment, worstStatus } from '../lib/validation'
import { useInspections } from '../hooks/useData'
import { useToast } from './ui/Toast'
import { useConfirm } from './ui/ConfirmDialog'
import type { InspectionRecord, StatusLevel } from '../types'
import { ChevronDown, ChevronUp, Pencil, Save, X } from 'lucide-react'

export function History({ inspections, onFilterChange }: { inspections: InspectionRecord[]; onFilterChange?: (f: FilterState) => void }) {
  const [filters, setFilters] = useState<FilterState>({ dateFrom: '', dateTo: '', equipmentId: 'all', status: 'all' })
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draftValues, setDraftValues] = useState<Record<string, string>>({})
  const { save, remove } = useInspections()
  const toast = useToast()
  const confirm = useConfirm()

  const update = (patch: Partial<FilterState>) => {
    const next = { ...filters, ...patch }
    setFilters(next)
    onFilterChange?.(next)
  }

  const filtered = useMemo(() => {
    return inspections
      .filter((r) => (filters.dateFrom ? r.date >= filters.dateFrom : true))
      .filter((r) => (filters.dateTo ? r.date <= filters.dateTo : true))
      .filter((r) => (filters.status === 'all' ? true : r.overallStatus === filters.status))
      .filter((r) =>
        filters.equipmentId === 'all'
          ? true
          : r.equipmentReadings.some((eq) => eq.equipmentId === filters.equipmentId && eq.status !== 'unknown')
      )
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [inspections, filters])

  const startEdit = (record: InspectionRecord, equipmentId: string) => {
    const reading = record.equipmentReadings.find((eq) => eq.equipmentId === equipmentId)
    const def = EQUIPMENT_DEFINITIONS.find((d) => d.id === equipmentId)
    if (!reading || !def) return

    const nextDraft: Record<string, string> = {}
    for (const field of def.fields) {
      const fieldReading = reading.fields.find((f) => f.fieldId === field.id)
      nextDraft[field.id] = fieldReading?.value === null || fieldReading?.value === undefined ? '' : String(fieldReading.value)
    }

    setDraftValues(nextDraft)
    setEditingKey(`${record.id}:${equipmentId}`)
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setDraftValues({})
  }

  const deleteInspection = async (record: InspectionRecord) => {
    const confirmed = await confirm({
      title: 'Supprimer l’inspection',
      message: `Supprimer l’inspection du ${format(parseISO(record.date), 'dd/MM/yyyy')} ? Cette action supprime toute la journée et est irréversible.`,
      confirmLabel: 'Supprimer',
      tone: 'danger',
    })
    if (!confirmed) return

    if (editingKey?.startsWith(`${record.id}:`)) {
      cancelEdit()
    }
    if (expanded === record.id) {
      setExpanded(null)
    }
    remove(record.id)
    toast.success('Inspection supprimée', `Journée du ${format(parseISO(record.date), 'dd/MM/yyyy')} supprimée.`)
  }

  const saveEdit = (record: InspectionRecord, equipmentId: string) => {
    const definition = EQUIPMENT_DEFINITIONS.find((d) => d.id === equipmentId)
    if (!definition) return

    const nextEquipmentReading = evaluateEquipment(
      definition,
      Object.fromEntries(definition.fields.map((field) => [field.id, draftValues[field.id] ?? null]))
    )

    const nextEquipmentReadings = record.equipmentReadings.map((reading) =>
      reading.equipmentId === equipmentId ? nextEquipmentReading : reading
    )

    const nextOverallStatus = nextEquipmentReadings.reduce<StatusLevel>(
      (acc, reading) => worstStatus(acc, reading.status === 'unknown' ? 'unknown' : reading.status),
      'unknown'
    )

    save({
      ...record,
      equipmentReadings: nextEquipmentReadings,
      overallStatus: nextOverallStatus === 'unknown' ? 'normal' : nextOverallStatus,
    })
    cancelEdit()
    toast.success('Modifications enregistrées', `${definition.name} mis à jour.`)
  }

  return (
    <Card>
      <CardHeader
        title="Historique des inspections"
        subtitle={`${filtered.length} résultat(s)`}
      />
      <div className="grid grid-cols-2 gap-3 border-b border-[--color-graphite-100] p-5 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-[--color-graphite-500]">Du</label>
          <input type="date" value={filters.dateFrom} onChange={(e) => update({ dateFrom: e.target.value })} className="w-full rounded-lg border border-[--color-graphite-200] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[--color-graphite-500]">Au</label>
          <input type="date" value={filters.dateTo} onChange={(e) => update({ dateTo: e.target.value })} className="w-full rounded-lg border border-[--color-graphite-200] px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[--color-graphite-500]">Équipement</label>
          <select value={filters.equipmentId} onChange={(e) => update({ equipmentId: e.target.value })} className="w-full rounded-lg border border-[--color-graphite-200] px-2 py-1.5 text-sm">
            <option value="all">Tous</option>
            {EQUIPMENT_DEFINITIONS.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[--color-graphite-500]">Statut</label>
          <select value={filters.status} onChange={(e) => update({ status: e.target.value as StatusLevel | 'all' })} className="w-full rounded-lg border border-[--color-graphite-200] px-2 py-1.5 text-sm">
            <option value="all">Tous</option>
            <option value="normal">Normal</option>
            <option value="warning">Alerte</option>
            <option value="critical">Critique</option>
          </select>
        </div>
        {(filters.dateFrom || filters.dateTo || filters.equipmentId !== 'all' || filters.status !== 'all') && (
          <div className="col-span-2 sm:col-span-4">
            <Button size="sm" variant="ghost" className="bg-graphite-400 hover:bg-graphite-700 text-white cursor-pointer" onClick={() => update({ dateFrom: '', dateTo: '', equipmentId: 'all', status: 'all' })}>Réinitialiser les filtres</Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[--color-graphite-100] text-left text-xs uppercase tracking-wide text-[--color-graphite-500]">
              <th className="px-5 py-2 font-medium">Date</th>
              <th className="px-5 py-2 font-medium">Technicien</th>
              <th className="px-5 py-2 font-medium">Statut</th>
              <th className="px-5 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-sm text-[--color-graphite-500]">Aucune inspection ne correspond aux filtres.</td>
              </tr>
            )}
            {filtered.map((r) => (
              <Fragment key={r.id}>
                <tr className="cursor-pointer border-b border-[--color-graphite-100] hover:bg-[--color-graphite-50]" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <td className="px-5 py-3 font-mono">{format(parseISO(r.date), 'dd/MM/yyyy')}</td>
                  <td className="px-5 py-3">{r.technicianName}</td>
                  <td className="px-5 py-3"><StatusBadge status={r.overallStatus} compact /></td>
                  <td className="px-5 py-3 text-right text-[--color-graphite-500]">
                    {expanded === r.id ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />}
                  </td>
                </tr>
                {expanded === r.id && (
                  <tr className="border-b border-[--color-graphite-100] bg-[--color-graphite-50]/60">
                    <td colSpan={4} className="px-5 py-4">
                      <div className="mb-4 flex items-center justify-end">
                        <Button size="sm" className='bg-red-600' variant="danger" onClick={() => deleteInspection(r)}>
                          Supprimer la journée
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {r.equipmentReadings.filter((eq) => eq.status !== 'unknown').map((eq) => {
                          const def = EQUIPMENT_DEFINITIONS.find((d) => d.id === eq.equipmentId)
                          const editKey = `${r.id}:${eq.equipmentId}`
                          const isEditing = editingKey === editKey
                          return (
                            <div key={eq.equipmentId} className="rounded-lg border border-[--color-graphite-200] bg-white p-3">
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold uppercase tracking-wide text-[--color-graphite-700]">{def?.name}</span>
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={eq.status} compact />
                                  <Button size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); isEditing ? cancelEdit() : startEdit(r, eq.equipmentId) }}>
                                    {isEditing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                                  </Button>
                                </div>
                              </div>

                              {isEditing ? (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-1 gap-2">
                                    {def?.fields.map((field) => (
                                      <div key={field.id}>
                                        <label className="mb-1 block text-[11px] font-medium text-[--color-graphite-500]">
                                          {field.label}{field.unit ? ` (${field.unit})` : ''}
                                        </label>
                                        <input
                                          type="text"
                                          value={draftValues[field.id] ?? ''}
                                          onChange={(e) => setDraftValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                                          className="w-full rounded-lg border border-[--color-graphite-200] px-3 py-2 text-sm font-mono focus:border-[--color-amber-signal] focus:outline-none"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <Button size="sm" className="bg-gray-500 hover:bg-gray-700 text-white cursor-pointer" variant="ghost" onClick={(event) => { event.stopPropagation(); cancelEdit() }}>
                                      Annuler
                                    </Button>
                                    <Button size="sm" className="bg-teal-600 hover:bg-teal-800 cursor-pointer" variant="primary" onClick={(event) => { event.stopPropagation(); saveEdit(r, eq.equipmentId) }}>
                                      <Save className="h-3.5 w-3.5" />
                                      Enregistrer
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <ul className="space-y-0.5 text-xs text-[--color-graphite-500]">
                                  {eq.fields.filter((f) => f.value !== null && f.value !== '').map((f) => {
                                    const fieldDef = def?.fields.find((fd) => fd.id === f.fieldId)
                                    return (
                                      <li key={f.fieldId} className="flex justify-between">
                                        <span>{fieldDef?.label}</span>
                                        <span className="font-mono text-[--color-graphite-900]">{f.value}{fieldDef?.unit ?? ''}</span>
                                      </li>
                                    )
                                  })}
                                </ul>
                              )}
                            </div>
                          )
                        })}
                        {r.equipmentReadings.every((eq) => eq.status === 'unknown') && (
                          <p className="text-xs text-[--color-graphite-500]">Aucune valeur enregistrée pour cette inspection.</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export interface FilterState {
  dateFrom: string
  dateTo: string
  equipmentId: string
  status: StatusLevel | 'all'
}
