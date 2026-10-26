import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type Kind = 'success' | 'error' | 'info'
interface Toast { id: number; kind: Kind; message: string }
interface Api { toast: (message: string, kind?: Kind) => void }

const Ctx = createContext<Api>({ toast: () => {} })
let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const toast = useCallback((message: string, kind: Kind = 'success') => {
    const id = nextId++
    setItems((xs) => [...xs, { id, kind, message }])
    setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 4000)
  }, [])
  const value = useMemo(() => ({ toast }), [toast])
  const color: Record<Kind, string> = {
    success: 'border-pine bg-pine-light text-pine-dark',
    error: 'border-red-300 bg-red-50 text-red-800',
    info: 'border-line bg-card text-ink',
  }
  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto max-w-md rounded-lg border px-4 py-3 text-sm shadow-lg ${color[t.kind]}`}>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx).toast
