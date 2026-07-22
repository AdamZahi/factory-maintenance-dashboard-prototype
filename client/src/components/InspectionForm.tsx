import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Card, CardHeader, Button, Badge } from './ui/Primitives'
import { StatusBadge } from './ui/StatusBadge'
import { EQUIPMENT_DEFINITIONS } from '../data/equipment'
import { evaluateEquipment, worstStatus } from '../lib/validation'
import { useInspections, useTechnicians } from '../hooks/useData'
import { generateId } from '../lib/storage'
import type { StatusLevel } from '../types'
import { ClipboardCheck, AlertTriangle } from 'lucide-react'

type ValuesState = Record<string, Record<string, string>>

export function InspectionForm({ technicianId }: { technicianId: string | null }) {
  const { items: technicians } = useTechnicians()
  const { save } = useInspections()
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [values, setValues] = useState<ValuesState>({})
  const [saved, setSaved] = useState(false)

  const technician = technicians.find((t) => t.id === technicianId)

  const readings = useMemo(
    () =>
      EQUIPMENT_DEFINITIONS.map((def) =>
        evaluateEquipment(
          def,
          Object.fromEntries(def.fields.map((f) => [f.id, values[def.id]?.[f.id] ?? null]))
        )
      ),
    [values]
  )

  const overallStatus: StatusLevel = readings.reduce<StatusLevel>(
    (acc, r) => worstStatus(acc, r.status === 'unknown' ? 'unknown' : r.status),
    'unknown'
  )
  const criticalCount = readings.filter((r) => r.status === 'critical').length
  const warningCount = readings.filter((r) => r.status === 'warning').length

  const setValue = (equipmentId: string, fieldId: string, value: string) => {
    setSaved(false)
    setValues((prev) => ({ ...prev, [equipmentId]: { ...prev[equipmentId], [fieldId]: value } }))
  }

  const handleSubmit = () => {
    save({
      id: generateId('insp'),
      date,
      technicianId: technician?.id ?? 'unassigned',
      technicianName: technician?.name ?? 'Technicien non renseigné',
      usine: 'SBM Tunisie',
      equipmentReadings: readings,
      overallStatus: overallStatus === 'unknown' ? 'normal' : overallStatus,
      createdAt: new Date().toISOString(),
    })
    setValues({})
    setSaved(true)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Inspection du jour"
          subtitle={technician ? `Technicien : ${technician.name}` : 'Technicien facultatif'}
          action={
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-[--color-graphite-200] px-2 py-1.5 text-sm"
              />
              <StatusBadge status={overallStatus} />
            </div>
          }
        />
        {(criticalCount > 0 || warningCount > 0) && (
          <div className="flex items-center gap-2 border-b border-[--color-graphite-100] bg-[--color-status-warning-bg]/40 px-5 py-2 text-xs text-[--color-graphite-700]">
            <AlertTriangle className="h-3.5 w-3.5 text-[--color-status-warning]" />
            {criticalCount > 0 && <span>{criticalCount} paramètre(s) critique(s)</span>}
            {warningCount > 0 && <span>{warningCount} paramètre(s) en alerte</span>}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {EQUIPMENT_DEFINITIONS.map((def, idx) => {
          const reading = readings[idx]
          return (
            <Card key={def.id}>
              <CardHeader
                title={def.name}
                action={<StatusBadge status={reading.status} compact />}
              />
              <div className="grid grid-cols-2 gap-3 p-5">
                {def.fields.map((field) => {
                  const fieldReading = reading.fields.find((f) => f.fieldId === field.id)!
                  return (
                    <div key={field.id} className={def.fields.length % 2 !== 0 && field === def.fields[def.fields.length - 1] ? 'col-span-2' : ''}>
                      <label className="mb-1 flex items-center justify-between text-xs font-medium text-[--color-graphite-500]">
                        <span>
                          {field.label} {field.unit && <span className="text-[--color-graphite-500]">({field.unit})</span>}
                        </span>
                        {fieldReading.status !== 'unknown' && fieldReading.status !== 'normal' && (
                          <span
                            className={`text-[10px] font-semibold ${
                              fieldReading.status === 'critical' ? 'text-[--color-status-critical]' : 'text-[--color-status-warning]'
                            }`}
                          >
                            {fieldReading.status === 'critical' ? 'Hors norme' : 'Attention'}
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={values[def.id]?.[field.id] ?? ''}
                        onChange={(e) => setValue(def.id, field.id, e.target.value)}
                        placeholder={field.rule ? ruleHint(field) : '—'}
                        className={`w-full rounded-lg border [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none px-3 py-2 text-sm font-mono focus:outline-none ${
                          fieldReading.status === 'critical'
                            ? 'border-[--color-status-critical] bg-[--color-status-critical-bg]'
                            : fieldReading.status === 'warning'
                              ? 'border-[--color-status-warning] bg-[--color-status-warning-bg]'
                              : 'border-[--color-graphite-200] focus:border-[--color-amber-signal]'
                        }`}
                      />
                      {field.helpText && <p className="mt-1 text-[10px] text-[--color-graphite-500]">{field.helpText}</p>}
                    </div>
                  )
                })}
              </div>
            </Card>
          )
        })}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-[--color-graphite-200] bg-white p-4">
        <div className="flex items-center gap-2 text-sm text-[--color-graphite-500]">
          {saved && (
            <Badge className="bg-[--color-status-normal-bg] text-[--color-status-normal]">
              <ClipboardCheck className="mr-1 inline h-3.5 w-3.5" /> Inspection enregistrée
            </Badge>
          )}
        </div>
        <Button variant="primary" className="ml-4 bg-green-800" onClick={handleSubmit}>
          Enregistrer l'inspection
        </Button>
      </div>
    </div>
  )
}

function ruleHint(field: { rule?: { min?: number; max?: number; equals?: number; thresholdBelow?: number; thresholdAbove?: number; greaterThan?: number; lessThan?: number } }): string {
  const r = field.rule
  if (!r) return '—'
  if (r.equals !== undefined) return `= ${r.equals}`
  if (r.thresholdBelow !== undefined) return `> ${r.thresholdBelow}`
  if (r.greaterThan !== undefined) return `> ${r.greaterThan}`
  if (r.lessThan !== undefined) return `< ${r.lessThan}`
  if (r.min !== undefined && r.max !== undefined) return `${r.min} – ${r.max}`
  if (r.max !== undefined) return `≤ ${r.max}`
  return '—'
}
