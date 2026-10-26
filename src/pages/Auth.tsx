import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Field, Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { DEMO_ADMIN_EMAIL, DEMO_PASSWORD } from '../lib/api/demoSeed'
import { IS_DEMO } from '../lib/env'
import { usePageMeta } from '../lib/hooks'

export default function AuthPage() {
  usePageMeta('Sign in or sign up', 'Sign in to BorrowLend to rent, buy and list books.')
  const { user, signIn, signUp, loading } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/dashboard'
  const [mode, setMode] = useState<'in' | 'up'>((loc.state as { mode?: 'in' | 'up' } | null)?.mode ?? 'in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  if (!loading && user) return <Navigate to={from} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (mode === 'up' && name.trim().length < 2) errs.name = 'Enter your name (at least 2 characters).'
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'Enter a valid email address.'
    if (password.length < (mode === 'up' ? 8 : 1)) errs.password = mode === 'up' ? 'Use at least 8 characters.' : 'Enter your password.'
    setErrors(errs); setFormError(''); setNotice('')
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      if (mode === 'in') {
        await signIn(email.trim(), password)
        nav(from, { replace: true })
      } else {
        const r = await signUp(email.trim(), password, name.trim())
        if (r.needsConfirmation) { setNotice('Almost there! Check your email for a confirmation link, then sign in.'); setMode('in') }
        else nav(from, { replace: true })
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally { setBusy(false) }
  }

  return (
    <div className="container-page flex justify-center py-10">
      <div className="w-full max-w-md">
        <h1 className="text-center text-3xl">{mode === 'in' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="mt-2 text-center text-sm text-ink-soft">One account to borrow, buy and lend.</p>

        <div role="tablist" aria-label="Sign in or sign up" className="mt-6 grid grid-cols-2 rounded-lg border border-line bg-card p-1">
          {([['in', 'Log in'], ['up', 'Sign up']] as const).map(([m, label]) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setErrors({}); setFormError('') }}
              className={`min-h-[40px] rounded-md text-sm font-semibold ${mode === m ? 'bg-pine text-white' : 'text-ink-soft'}`}>{label}</button>
          ))}
        </div>

        <form onSubmit={submit} noValidate className="card mt-4 space-y-4 p-5">
          {notice && <p role="status" className="rounded-lg bg-pine-light p-3 text-sm text-pine-dark">{notice}</p>}
          {mode === 'up' && (
            <Field label="Your name" htmlFor="a-name" error={errors.name}>
              <input id="a-name" className={`input ${errors.name ? 'input-error' : ''}`} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          )}
          <Field label="Email" htmlFor="a-email" error={errors.email}>
            <input id="a-email" type="email" inputMode="email" className={`input ${errors.email ? 'input-error' : ''}`} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" htmlFor="a-pass" error={errors.password} hint={mode === 'up' ? 'At least 8 characters.' : undefined}>
            <input id="a-pass" type="password" className={`input ${errors.password ? 'input-error' : ''}`} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="border-white/40 border-t-white" />}{mode === 'in' ? 'Log in' : 'Create account'}</button>
          {mode === 'up' && <p className="text-xs text-ink-mute">By signing up you agree to the draft Terms and Privacy policy linked in the footer.</p>}
        </form>

        {IS_DEMO && (
          <div className="mt-4 rounded-lg bg-clay-light p-4 text-sm text-clay-dark">
            <p className="font-semibold">Demo mode sign-ins</p>
            <p>Password for all: <code>{DEMO_PASSWORD}</code></p>
            <ul className="mt-1 list-disc pl-5">
              <li><code>asha@borrowlend.demo</code>, <code>ravi@borrowlend.demo</code>, <code>meera@borrowlend.demo</code></li>
              <li>Admin: <code>{DEMO_ADMIN_EMAIL}</code></li>
            </ul>
            <p className="mt-1">Or sign up with any email — it never leaves your browser.</p>
          </div>
        )}
      </div>
    </div>
  )
}
