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
