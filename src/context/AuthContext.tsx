import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, type AuthUser } from '../lib/api'
import type { Profile } from '../lib/types'

interface AuthState {
  loading: boolean
  user: AuthUser | null
  profile: Profile | null
  phone: string | null
  /** UI gating only. Admin pages/actions are enforced by the server (RLS + SQL functions). */
  isAdmin: boolean
  refresh: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Pick<AuthState, 'loading' | 'user' | 'profile' | 'phone'>>({ loading: true, user: null, profile: null, phone: null })

  const refresh = useCallback(async () => {
    try {
      const user = await api.auth.getUser()
      if (!user) { setS({ loading: false, user: null, profile: null, phone: null }); return }
      const me = await api.profiles.mine()
      setS({ loading: false, user, profile: me?.profile ?? null, phone: me?.phone ?? null })
      void api.rentals.markOverdue().catch(() => {})
    } catch {
      setS({ loading: false, user: null, profile: null, phone: null })
    }
  }, [])

  useEffect(() => {
    void refresh()
    return api.auth.onChange(() => { void refresh() })
  }, [refresh])

  const value = useMemo<AuthState>(() => ({
    ...s,
    isAdmin: s.profile?.role === 'admin' && !s.profile.suspended,
    refresh,
    signIn: async (e, p) => { await api.auth.signIn(e, p); await refresh() },
    signUp: async (e, p, n) => { const r = await api.auth.signUp(e, p, n); await refresh(); return r },
    signOut: async () => { await api.auth.signOut(); await refresh() },
  }), [s, refresh])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}
