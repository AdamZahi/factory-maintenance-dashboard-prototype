import { useCallback, useEffect, useState } from 'react'
import type { Repository } from '../lib/storage'

export function useRepository<T extends { id: string }>(repo: Repository<T>) {
  const [items, setItems] = useState<T[]>(() => repo.getAll())

  useEffect(() => {
    const unsubscribe = repo.subscribe(() => setItems(repo.getAll()))
    return unsubscribe
  }, [repo])

  const save = useCallback((item: T) => repo.save(item), [repo])
  const saveMany = useCallback((newItems: T[]) => repo.saveMany(newItems), [repo])
  const remove = useCallback((id: string) => repo.remove(id), [repo])
  const clear = useCallback(() => repo.clear(), [repo])

  return { items, save, saveMany, remove, clear }
}
