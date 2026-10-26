import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import { money } from '../lib/format'
import type { Settings } from '../lib/types'

interface SettingsState {
  settings: Settings
  fmt: (n: number) => string
  reload: () => Promise<void>
}

// Fallback shown only until the real settings load (or if loading fails).
const FALLBACK: Settings = { commission_pct: 10, currency: 'INR', launch_city: '' }
const Ctx = createContext<SettingsState>({ settings: FALLBACK, fmt: (n) => money(n, 'INR'), reload: async () => {} })

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(FALLBACK)
  const reload = useCallback(async () => {
    try { setSettings(await api.settings.get()) } catch { /* keep fallback */ }
  }, [])
  useEffect(() => { void reload() }, [reload])
  const value = useMemo(() => ({ settings, reload, fmt: (n: number) => money(n, settings.currency) }), [settings, reload])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useSettings = () => useContext(Ctx)
