import { useSyncExternalStore } from 'react'

const KEY = 'borrowlend-request-list'
const listeners = new Set<() => void>()
function read(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch { return [] }
}
let ids = read()
function publish(next: string[]) {
  ids = [...new Set(next)].slice(0, 50)
  try { localStorage.setItem(KEY, JSON.stringify(ids)) } catch { /* retain this tab's in-memory list */ }
  listeners.forEach((listener) => listener())
}
export function toggleRequestList(id: string) {
  publish(ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id])
}
export function removeFromRequestList(id: string) { publish(ids.filter((value) => value !== id)) }
export function useRequestList() {
  const value = useSyncExternalStore((callback) => { listeners.add(callback); return () => listeners.delete(callback) }, () => ids)
  return { ids: value, has: (id: string) => value.includes(id), toggle: toggleRequestList, remove: removeFromRequestList }
}
