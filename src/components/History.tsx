import { Fragment, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Card, CardHeader, Button } from './ui/Primitives'
import { StatusBadge } from './ui/StatusBadge'
import { EQUIPMENT_DEFINITIONS } from '../data/equipment'
import type { InspectionRecord, StatusLevel } from '../types'
import { ChevronDown, ChevronUp } from 'lucide-react'

export function History({ inspections, onFilterChange }: { inspections: InspectionRecord[]; onFilterChange?: (f: FilterState) => void }) {
  const [filters, setFilters] = useState<FilterState>({ dateFrom: '', dateTo: '', equipmentId: 'all', status: 'all' })
  const [expanded, setExpanded] = useState<string | null>(null)

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
            <Button size="sm" variant="ghost" onClick={() => update({ dateFrom: '', dateTo: '', equipmentId: 'all', status: 'all' })}>Réinitialiser les filtres</Button>
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
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {r.equipmentReadings.filter((eq) => eq.status !== 'unknown').map((eq) => {
                          const def = EQUIPMENT_DEFINITIONS.find((d) => d.id === eq.equipmentId)
                          return (
                            <div key={eq.equipmentId} className="rounded-lg border border-[--color-graphite-200] bg-white p-3">
                              <div className="mb-1 flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wide text-[--color-graphite-700]">{def?.name}</span>
                                <StatusBadge status={eq.status} compact />
                              </div>
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
