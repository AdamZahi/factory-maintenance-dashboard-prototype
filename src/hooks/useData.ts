import { createLocalStorageRepository, STORAGE_KEYS } from '../lib/storage'
import type { InspectionRecord, Technician } from '../types'
import { useRepository } from './useRepository'

export const inspectionRepository = createLocalStorageRepository<InspectionRecord>(STORAGE_KEYS.inspections)
export const technicianRepository = createLocalStorageRepository<Technician>(STORAGE_KEYS.technicians)

export function useInspections() {
  return useRepository(inspectionRepository)
}

export function useTechnicians() {
  return useRepository(technicianRepository)
}
