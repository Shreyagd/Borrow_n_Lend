import { useSyncExternalStore } from 'react'

// "Saved books" (heart) are a per-browser convenience kept in localStorage; they are not synced to the account.
const KEY = 'borrowlend-saved'
const listeners = new Set<() => void>()

function load(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}
let snapshot: string[] = load()

function set(next: string[]) {
  snapshot = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage unavailable: stays in memory */ }
  listeners.forEach((l) => l())
}

export function toggleSaved(id: string) {
  set(snapshot.includes(id) ? snapshot.filter((x) => x !== id) : [id, ...snapshot].slice(0, 100))
}

export function useSaved() {
  const ids = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => snapshot,
  )
  return { ids, has: (id: string) => ids.includes(id), toggle: toggleSaved }
}
