import { useCallback, useEffect, useState } from 'react'

// Lightweight user preferences persisted in localStorage. These are UI-only
// (not synced to the backend) and applied immediately.
export interface Preferences {
  sidebarCollapsed: boolean
  reduceMotion: boolean
}

const KEY = 'fmd.prefs.v1'

const DEFAULTS: Preferences = {
  sidebarCollapsed: false,
  reduceMotion: false,
}

function read(): Preferences {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(read)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs))
    } catch {
      /* ignore quota errors */
    }
    document.documentElement.classList.toggle('reduce-motion', prefs.reduceMotion)
  }, [prefs])

  const set = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }))
  }, [])

  const toggle = useCallback((key: keyof Preferences) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  return { prefs, set, toggle }
}
