// ---------------------------------------------------------------------------
// Storage layer
//
// Every read/write to persisted data goes through this file. Today it's
// backed by localStorage; tomorrow it can be swapped for `fetch()` calls to
// a real backend without touching any component, because components only
// ever talk to the `Repository<T>` interface below (see hooks/useRepository.ts).
// ---------------------------------------------------------------------------

export interface Repository<T extends { id: string }> {
  getAll(): T[]
  getById(id: string): T | undefined
  save(item: T): T
  saveMany(items: T[]): T[]
  remove(id: string): void
  clear(): void
  subscribe(listener: () => void): () => void
}

const LISTENERS = new Map<string, Set<() => void>>()

function notify(key: string) {
  LISTENERS.get(key)?.forEach((cb) => cb())
}

function readRaw<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch (err) {
    console.error(`[storage] failed to read "${key}"`, err)
    return []
  }
}

function writeRaw<T>(key: string, items: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items))
    notify(key)
  } catch (err) {
    console.error(`[storage] failed to write "${key}"`, err)
  }
}

/** Creates a localStorage-backed repository for a given key/collection. */
export function createLocalStorageRepository<T extends { id: string }>(key: string): Repository<T> {
  return {
    getAll: () => readRaw<T>(key),
    getById: (id) => readRaw<T>(key).find((i) => i.id === id),
    save: (item) => {
      const all = readRaw<T>(key)
      const idx = all.findIndex((i) => i.id === item.id)
      if (idx >= 0) all[idx] = item
      else all.push(item)
      writeRaw(key, all)
      return item
    },
    saveMany: (items) => {
      const all = readRaw<T>(key)
      for (const item of items) {
        const idx = all.findIndex((i) => i.id === item.id)
        if (idx >= 0) all[idx] = item
        else all.push(item)
      }
      writeRaw(key, all)
      return items
    },
    remove: (id) => {
      const all = readRaw<T>(key).filter((i) => i.id !== id)
      writeRaw(key, all)
    },
    clear: () => writeRaw(key, []),
    subscribe: (listener) => {
      if (!LISTENERS.has(key)) LISTENERS.set(key, new Set())
      LISTENERS.get(key)!.add(listener)
      return () => LISTENERS.get(key)!.delete(listener)
    },
  }
}

export const STORAGE_KEYS = {
  inspections: 'fmd.inspections.v1',
  technicians: 'fmd.technicians.v1',
} as const

export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// ---------------------------------------------------------------------------
// API-backed repository
//
// Same `Repository<T>` interface, but data lives in the backend instead of
// localStorage. Because the interface is synchronous (getAll(): T[]) and HTTP
// is not, each repo keeps an in-memory cache: getAll() returns the cache
// immediately, and a background fetch refreshes it and fires notify() -> the
// existing useRepository subscription re-renders with fresh data. Writes update
// the cache optimistically, then POST/DELETE and re-sync.
// ---------------------------------------------------------------------------

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

type TokenGetter = () => Promise<string | null>

// Clerk's getToken() is only available inside React, so App registers it here
// at startup; repositories created at module load read it lazily per request.
let getAuthToken: TokenGetter = async () => null
export function setAuthTokenGetter(fn: TokenGetter) {
  getAuthToken = fn
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAuthToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText)
    throw new Error(`API ${init?.method ?? 'GET'} ${path} -> ${res.status}: ${detail}`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export function createApiRepository<T extends { id: string }>(basePath: string): Repository<T> {
  let cache: T[] = []
  let loaded = false
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((cb) => cb())

  const refresh = async () => {
    try {
      cache = await apiFetch<T[]>(basePath)
      loaded = true
      emit()
    } catch (err) {
      console.error(`[api] refresh "${basePath}" failed`, err)
    }
  }

  const upsertLocal = (item: T) => {
    const idx = cache.findIndex((i) => i.id === item.id)
    if (idx >= 0) cache = cache.map((i) => (i.id === item.id ? item : i))
    else cache = [item, ...cache]
  }

  return {
    getAll: () => cache,
    getById: (id) => cache.find((i) => i.id === id),
    save: (item) => {
      upsertLocal(item) // optimistic
      emit()
      apiFetch<T>(basePath, { method: 'POST', body: JSON.stringify(item) })
        .then((saved) => {
          if (saved) upsertLocal(saved)
          return refresh()
        })
        .catch((err) => {
          console.error(err)
          refresh()
        })
      return item
    },
    saveMany: (items) => {
      items.forEach(upsertLocal) // optimistic
      emit()
      apiFetch<T[]>(`${basePath}/batch`, { method: 'POST', body: JSON.stringify(items) })
        .then(() => refresh())
        .catch((err) => {
          console.error(err)
          refresh()
        })
      return items
    },
    remove: (id) => {
      cache = cache.filter((i) => i.id !== id) // optimistic
      emit()
      apiFetch(`${basePath}/${id}`, { method: 'DELETE' }).catch((err) => {
        console.error(err)
        refresh()
      })
    },
    clear: () => {
      cache = []
      emit()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      if (!loaded) void refresh() // kick off the first load when a component mounts
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
