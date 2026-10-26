import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Field, Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { usePageMeta } from '../lib/hooks'

export default function Account() {
  usePageMeta('Profile & account')
  const { user, profile, phone, refresh, signOut } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [tel, setTel] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setName(profile?.display_name ?? ''); setCity(profile?.city ?? ''); setTel(phone ?? '')
  }, [profile, phone])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (name.trim().length < 2) errs.name = 'Enter your name (at least 2 characters).'
    if (tel.trim() && !/^[+\d][\d\s()-]{5,19}$/.test(tel.trim())) errs.tel = 'Enter a valid phone number.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try { await api.profiles.updateMine({ display_name: name, city, phone: tel }); await refresh(); toast('Profile saved.') }
    catch (err) { toast(err instanceof Error ? err.message : 'Could not save profile.', 'error') }
    finally { setBusy(false) }
  }

  return (
    <div className="container-page max-w-xl py-8">
      <h1>Profile & account</h1>
      <form onSubmit={submit} noValidate className="card mt-6 space-y-4 p-5">
        <Field label="Email" htmlFor="ac-email" hint="Used to sign in. Never shown publicly.">
          <input id="ac-email" className="input bg-stone-100" value={user?.email ?? ''} readOnly />
        </Field>
        <Field label="Display name" htmlFor="ac-name" error={errors.name} hint="Shown on your listings and to people you transact with.">
          <input id="ac-name" className={`input ${errors.name ? 'input-error' : ''}`} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="City / area" htmlFor="ac-city" hint="Public. Used as the default pickup area for new listings.">
          <input id="ac-city" className="input" maxLength={80} value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
        <Field label="Phone (private)" htmlFor="ac-tel" error={errors.tel} hint="Shared only with the other person after a request is accepted. Optional.">
          <input id="ac-tel" type="tel" className={`input ${errors.tel ? 'input-error' : ''}`} value={tel} onChange={(e) => setTel(e.target.value)} />
        </Field>
        <div className="flex justify-between gap-3">
          <button type="button" className="btn-secondary" onClick={async () => { await signOut(); nav('/') }}>Sign out</button>
          <button className="btn-primary" disabled={busy}>{busy && <Spinner className="border-white/40 border-t-white" />}Save changes</button>
        </div>
      </form>
    </div>
  )
}
