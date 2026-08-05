import { apiFetch, createApiRepository } from '../lib/storage'
import type { EquipmentDefinition } from '../types'
import { useRepository } from './useRepository'

// Equipment definitions (equipment + their parameters) now live in the DB and
// are served by GET /api/equipment in the exact EquipmentDefinition shape the
// app already used. Same cache-backed repository pattern as inspections, so
// getAll() is synchronous and components re-render when the fetch resolves.
export const equipmentRepository = createApiRepository<EquipmentDefinition>('/api/equipment')

export function useEquipmentDefinitions() {
  const { items, save, remove } = useRepository(equipmentRepository)
  return { definitions: items, save, remove }
}

/** Synchronous cache accessors for non-React call sites (e.g. Excel helpers). */
export function getEquipmentDefinitionsSync(): EquipmentDefinition[] {
  return equipmentRepository.getAll()
}
export function getEquipmentDefinitionSync(id: string): EquipmentDefinition | undefined {
  return equipmentRepository.getById(id)
}

// Admin CRUD. These await the request so validation errors surface to the UI,
// then refresh the shared cache so every consumer re-renders with fresh data.
export type EquipmentInput = Pick<EquipmentDefinition, 'name' | 'fields'> & { id?: string }

export async function saveEquipment(input: EquipmentInput): Promise<EquipmentDefinition> {
  const saved = await apiFetch<EquipmentDefinition>('/api/equipment', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  await equipmentRepository.refresh?.()
  return saved
}

export async function removeEquipment(id: string): Promise<void> {
  await apiFetch<void>(`/api/equipment/${id}`, { method: 'DELETE' })
  await equipmentRepository.refresh?.()
}
