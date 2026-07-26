import { useCallback, useEffect, useState } from 'react'
import { apiFetch, createApiRepository } from '../lib/storage'
import type { InspectionRecord, Technician } from '../types'
import { useRepository } from './useRepository'

// API-backed repositories. Same interface as the old localStorage repos, so
// every component that consumes useInspections()/useTechnicians() is unchanged.
export const inspectionRepository = createApiRepository<InspectionRecord>('/api/inspections')
export const technicianRepository = createApiRepository<Technician>('/api/technicians')

export function useInspections() {
  return useRepository(inspectionRepository)
}

export function useTechnicians() {
  return useRepository(technicianRepository)
}

// --- Equipment assignments -------------------------------------------------

export interface Assignment {
  id: string
  technicianId: string
  equipmentId: string
  assignedBy: string
  assignedAt: string
}

/**
 * Loads equipment assignments. Pass 'me' for the signed-in technician's own
 * assignments (used by the inspection form), or a specific technicianId /
 * undefined (admin, all) for the admin screen.
 */
export function useAssignments(technicianId?: string) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const query = technicianId ? `?technicianId=${encodeURIComponent(technicianId)}` : ''
      setAssignments(await apiFetch<Assignment[]>(`/api/assignments${query}`))
    } catch (err) {
      console.error('[assignments] load failed', err)
    } finally {
      setLoading(false)
    }
  }, [technicianId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { assignments, loading, reload }
}

export async function createAssignment(technicianId: string, equipmentId: string) {
  return apiFetch<Assignment>('/api/assignments', {
    method: 'POST',
    body: JSON.stringify({ technicianId, equipmentId }),
  })
}

export async function deleteAssignment(technicianId: string, equipmentId: string) {
  const query = `?technicianId=${encodeURIComponent(technicianId)}&equipmentId=${encodeURIComponent(equipmentId)}`
  return apiFetch<void>(`/api/assignments${query}`, { method: 'DELETE' })
}

// --- Users (admin) ---------------------------------------------------------

export interface AppUser {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'TECHNICIAN'
}

export async function fetchUsers() {
  return apiFetch<AppUser[]>('/api/technicians')
}

export async function setUserRole(userId: string, role: 'ADMIN' | 'TECHNICIAN') {
  return apiFetch<AppUser>(`/api/technicians/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  })
}
