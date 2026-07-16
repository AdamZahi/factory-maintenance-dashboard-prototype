import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Card, CardHeader, Button } from './ui/Primitives'
import { useTechnicians } from '../hooks/useData'
import { generateId } from '../lib/storage'
import { User, Check } from 'lucide-react'

const schema = z.object({
  name: z.string().min(2, 'Nom trop court'),
  role: z.string().min(2, 'Fonction requise'),
})
type FormValues = z.infer<typeof schema>

export function TechnicianForm({ activeTechnicianId, onSelect }: { activeTechnicianId: string | null; onSelect: (id: string) => void }) {
  const { items: technicians, save } = useTechnicians()
  const [showForm, setShowForm] = useState(technicians.length === 0)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = (values: FormValues) => {
    const id = generateId('tech')
    save({ id, name: values.name, role: values.role })
    onSelect(id)
    reset()
    setShowForm(false)
  }

  return (
    <Card>
      <CardHeader
        title="Technicien"
        subtitle="Identifiez-vous avant de démarrer une inspection"
        action={
          <Button size="sm" variant="ghost" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Annuler' : '+ Nouveau'}
          </Button>
        }
      />
      <div className="space-y-3 p-5">
        {technicians.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {technicians.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelect(t.id)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  activeTechnicianId === t.id
                    ? 'border-[--color-amber-signal] bg-[--color-amber-signal]/10'
                    : 'border-[--color-graphite-200] hover:bg-[--color-graphite-50]'
                }`}
              >
                <User className="h-4 w-4 text-[--color-graphite-500]" />
                <span>
                  <span className="block font-medium leading-tight">{t.name}</span>
                  <span className="block text-xs text-[--color-graphite-500] leading-tight">{t.role}</span>
                </span>
                {activeTechnicianId === t.id && <Check className="h-4 w-4 text-[--color-amber-signal-dark]" />}
              </button>
            ))}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-3 border-t border-[--color-graphite-100] pt-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[--color-graphite-500]">Nom complet</label>
              <input {...register('name')} className="w-full rounded-lg border border-[--color-graphite-200] px-3 py-2 text-sm focus:border-[--color-amber-signal] focus:outline-none" placeholder="ex. Mabrouk Fehmi" />
              {errors.name && <p className="mt-1 text-xs text-[--color-status-critical]">{errors.name.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[--color-graphite-500]">Fonction</label>
              <input {...register('role')} className="w-full rounded-lg border border-[--color-graphite-200] px-3 py-2 text-sm focus:border-[--color-amber-signal] focus:outline-none" placeholder="ex. Coordinateur technique" />
              {errors.role && <p className="mt-1 text-xs text-[--color-status-critical]">{errors.role.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" variant="primary" size="sm">Enregistrer et sélectionner</Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  )
}
