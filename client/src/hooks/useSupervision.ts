import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/storage'
import type { StatusLevel } from '../types'

export interface SupervisionField {
  fieldId: string
  value: number | string | null
  status: StatusLevel
  recordedAt: string // ISO timestamp of the inspection this value came from
  date: string // inspection date (yyyy-MM-dd) of that value
}

export interface SupervisionEquipment {
  equipmentId: string
  equipmentName: string
  lastRecordedAt: string | null // newest field timestamp for this equipment
  fields: SupervisionField[]
}

export interface SupervisionPayload {
  serverTime: string
  equipment: SupervisionEquipment[]
}

export type Connection = 'connecting' | 'live' | 'error'

/**
 * Polls the supervision read model for the wall display. Refreshes on an
 * interval, on mount, and when the tab regains focus. Exposes a connection
 * state so the UI can show a live / reconnecting indicator.
 */
export function useSupervision(pollMs = 20_000) {
  const [data, setData] = useState<SupervisionPayload | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [connection, setConnection] = useState<Connection>('connecting')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const payload = await apiFetch<SupervisionPayload>('/api/supervision/latest')
      setData(payload)
      setLastUpdated(new Date())
      setConnection('live')
    } catch (err) {
      console.error('[supervision] refresh failed', err)
      setConnection('error')
    }
  }, [])

  useEffect(() => {
    void refresh()
    timer.current = setInterval(() => void refresh(), pollMs)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      if (timer.current) clearInterval(timer.current)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh, pollMs])

  return { data, lastUpdated, connection, refresh }
}
