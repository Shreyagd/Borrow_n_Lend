import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BackLink, EmptyState, ErrorState, Field, LoadingState, Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { CATEGORIES, CONDITIONS, LISTING_TYPES, MAX_IMAGES, PERIOD_CHOICES } from '../lib/constants'
import { useAsync, usePageMeta } from '../lib/hooks'
import { coverExists, isValidIsbn, openLibraryCoverUrl } from '../lib/covers'
import { validateListing, type FieldErrors } from '../lib/rules'
import type { Listing, ListingInput, ListingType } from '../lib/types'

const EMPTY: ListingInput = {
  title: '', author: '', isbn: '', category: '', description: '', condition: 'good', image_urls: [],
  listing_type: 'rent', rental_price: null, rental_period_options: [7, 14], sale_price: null,
  pickup_area: '', exact_address: '', handover_notes: '', status: 'active',
}

export default function ListingForm() {
  const { id } = useParams()
  const editing = !!id
  usePageMeta(editing ? 'Edit listing' : 'List a book', 'Add a book to rent or sell on BorrowLend.')
  const { user, profile } = useAuth()
  const { fmt, settings } = useSettings()
  const toast = useToast()
  const nav = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const existing = useAsync<{ l: Listing | null; priv: { exact_address: string | null; handover_notes: string | null } | null } | null>(
    async () => (id ? { l: await api.listings.get(id), priv: await api.listings.getPrivate(id) } : null), [id])

  const [v, setV] = useState<ListingInput>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [coverMsg, setCoverMsg] = useState('')
  const [coverBusy, setCoverBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [loaded, setLoaded] = useState(!editing)

  useEffect(() => {
    const l = existing.data?.l
    if (editing && l && !loaded) {
      setV({
        title: l.title, author: l.author, isbn: l.isbn ?? '', category: l.category, description: l.description ?? '',
        condition: l.condition, image_urls: l.image_urls, listing_type: l.listing_type, rental_price: l.rental_price,
        rental_period_options: l.rental_period_options.length ? l.rental_period_options : [7, 14], sale_price: l.sale_price,
        pickup_area: l.pickup_area, exact_address: existing.data?.priv?.exact_address ?? '',
        handover_notes: existing.data?.priv?.handover_notes ?? '', status: l.status === 'paused' ? 'paused' : 'active',
      })
      setLoaded(true)
    }
  }, [existing.data, editing, loaded])

  useEffect(() => {
    if (!editing && profile?.city && !v.pickup_area) setV((x) => ({ ...x, pickup_area: profile.city ?? '' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.city])

  if (editing && existing.loading) return <LoadingState />
  if (editing && existing.error) return <div className="container-page py-8"><ErrorState message={existing.error} onRetry={existing.reload} /></div>
  if (editing && (!existing.data?.l || existing.data.l.owner_id !== user?.id)) {
    return <div className="container-page py-8"><EmptyState title="Listing not found" action={<Link to="/dashboard/listings" className="btn-primary no-underline text-white">My listings</Link>}>You can only edit your own listings.</EmptyState></div>
  }

  const set = <K extends keyof ListingInput>(k: K, val: ListingInput[K]) => {
    setV((x) => ({ ...x, [k]: val }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const rent = v.listing_type !== 'sale'
  const sale = v.listing_type !== 'rent'
  const err = (k: keyof ListingInput) => (errors[k] ? 'input-error' : '')

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setUploadError('')
    setUploading(true)
    try {
      const urls: string[] = []
      for (const f of Array.from(files).slice(0, MAX_IMAGES - v.image_urls.length)) urls.push(await api.listings.uploadImage(f))
      set('image_urls', [...v.image_urls, ...urls])
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const fetchCover = async () => {
    setCoverMsg('')
    if (!isValidIsbn(v.isbn)) { setCoverMsg('Enter a valid 10 or 13 digit ISBN first.'); return }
    if (v.image_urls.length >= MAX_IMAGES) { setCoverMsg(`You already have ${MAX_IMAGES} photos. Remove one first.`); return }
    setCoverBusy(true)
    const url = openLibraryCoverUrl(v.isbn)
    if (v.image_urls.includes(url)) { setCoverMsg('That cover is already added.'); setCoverBusy(false); return }
    const ok = await coverExists(url)
    setCoverBusy(false)
    if (!ok) { setCoverMsg('No cover found for that ISBN. You can upload your own photo instead.'); return }
    set('image_urls', [url, ...v.image_urls])
    setCoverMsg('Cover added from Open Library. It’s shown first; remove it with ✕ if it’s not right.')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs = validateListing(v)
    setErrors(errs)
    setFormError('')
    if (Object.keys(errs).length) {
      setFormError('Please fix the highlighted fields.')
      document.getElementById(`lf-${Object.keys(errs)[0]}`)?.focus()
      return
    }
    setSaving(true)
    try {
      if (editing) await api.listings.update(id!, v)
      else await api.listings.create(v)
      toast(editing ? 'Listing updated.' : v.status === 'paused' ? 'Listing saved as paused.' : 'Your book is live!')
      nav('/dashboard/listings')
    } catch (e2) {
      setFormError(e2 instanceof Error ? e2.message : 'Could not save the listing.')
    } finally { setSaving(false) }
  }

  const togglePeriod = (d: number) =>
    set('rental_period_options', v.rental_period_options.includes(d) ? v.rental_period_options.filter((x) => x !== d) : [...v.rental_period_options, d])

  return (
    <div className="container-page max-w-3xl py-8">
      <BackLink to="/dashboard/listings">My listings</BackLink>
      <h1>{editing ? 'Edit listing' : 'List a book'}</h1>
      <p className="mt-1 text-ink-soft">Tell readers about your book. Your exact address stays private until you accept a request.</p>

      <form onSubmit={submit} noValidate className="mt-6 space-y-8">
        <section className="card space-y-4 p-5" aria-labelledby="s-book">
          <h2 id="s-book" className="text-xl">The book</h2>
          <Field label="Title *" htmlFor="lf-title" error={errors.title}>
            <input id="lf-title" className={`input ${err('title')}`} maxLength={200} value={v.title} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Author *" htmlFor="lf-author" error={errors.author}>
              <input id="lf-author" className={`input ${err('author')}`} maxLength={120} value={v.author} onChange={(e) => set('author', e.target.value)} />
            </Field>
            <Field label="ISBN (optional)" htmlFor="lf-isbn" error={errors.isbn}>
              <div className="flex gap-2">
                <input id="lf-isbn" className={`input ${err('isbn')}`} inputMode="numeric" value={v.isbn} onChange={(e) => { set('isbn', e.target.value); setCoverMsg('') }} />
                <button type="button" className="btn-secondary shrink-0" onClick={fetchCover} disabled={coverBusy || !v.isbn.trim()}>
                  {coverBusy ? <Spinner /> : 'Get cover'}
                </button>
              </div>
              {coverMsg && <p role="status" className="mt-1 text-xs text-ink-soft">{coverMsg}</p>}
            </Field>
            <Field label="Category *" htmlFor="lf-category" error={errors.category}>
              <select id="lf-category" className={`input ${err('category')}`} value={v.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Choose…</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Condition *" htmlFor="lf-condition" hint={CONDITIONS.find((c) => c.value === v.condition)?.hint}>
              <select id="lf-condition" className="input" value={v.condition} onChange={(e) => set('condition', e.target.value as ListingInput['condition'])}>
                {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description (optional)" htmlFor="lf-description" error={errors.description} hint={`${v.description.length}/2000`}>
            <textarea id="lf-description" rows={4} maxLength={2000} className={`input ${err('description')}`} value={v.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </section>

        <section className="card space-y-3 p-5" aria-labelledby="s-photos">
          <h2 id="s-photos" className="text-xl">Photos</h2>
          <p className="text-sm text-ink-soft">Up to {MAX_IMAGES} photos (JPG, PNG or WebP). The first is the cover. Tip: enter the ISBN above and tap “Get cover” to fetch the standard cover, or upload a photo of your own copy. Without either, a plain cover is shown.</p>
          <ul className="flex flex-wrap gap-3">
            {v.image_urls.map((u, i) => (
              <li key={i} className="relative w-24">
                <img src={u} alt={`Uploaded photo ${i + 1}`} className="aspect-[3/4] w-full rounded-md object-cover" />
                <button type="button" className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-sm text-white"
                  aria-label={`Remove photo ${i + 1}`} onClick={() => set('image_urls', v.image_urls.filter((_, j) => j !== i))}>✕</button>
                {i === 0 && <span className="chip mt-1 bg-pine-light text-pine-dark">Cover</span>}
              </li>
            ))}
            {v.image_urls.length < MAX_IMAGES && (
              <li>
                <label className="flex aspect-[3/4] w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-line text-center text-xs text-ink-soft hover:bg-pine-light">
                  {uploading ? <Spinner /> : <><span className="text-xl" aria-hidden="true">＋</span>Add photo</>}
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={uploading} onChange={(e) => onFiles(e.target.files)} />
                </label>
              </li>
            )}
          </ul>
          {uploadError && <p role="alert" className="text-sm text-red-700">{uploadError}</p>}
        </section>

        <section className="card space-y-4 p-5" aria-labelledby="s-offer">
          <h2 id="s-offer" className="text-xl">How do you want to offer it?</h2>
          <fieldset>
            <legend className="sr-only">Listing type</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {LISTING_TYPES.map((t) => (
                <label key={t.value} className={`btn-secondary cursor-pointer ${v.listing_type === t.value ? '!border-pine !bg-pine-light' : ''}`}>
                  <input type="radio" name="type" className="sr-only" checked={v.listing_type === t.value}
                    onChange={() => { set('listing_type', t.value as ListingType) }} />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>

          {rent && (
            <div className="space-y-4">
              <Field label={`Rental price per week (${settings.currency}) *`} htmlFor="lf-rental_price" error={errors.rental_price}
                hint={v.rental_price ? `Renters pay ${fmt((v.rental_price * 14) / 7)} for 14 days. You’d earn about ${fmt(((v.rental_price * 14) / 7) * (1 - settings.rental_commission_pct / 100))} after the ${settings.rental_commission_pct}% platform fee.` : undefined}>
                <input id="lf-rental_price" type="number" min={1} step="0.5" inputMode="decimal" className={`input ${err('rental_price')}`}
                  value={v.rental_price ?? ''} onChange={(e) => set('rental_price', e.target.value === '' ? null : Number(e.target.value))} />
              </Field>
              <fieldset>
                <legend className="label">Rental periods you allow *</legend>
                <div className="flex flex-wrap gap-2">
                  {PERIOD_CHOICES.map((d) => (
                    <label key={d} className={`btn-secondary cursor-pointer ${v.rental_period_options.includes(d) ? '!border-pine !bg-pine-light' : ''}`}>
                      <input type="checkbox" className="sr-only" checked={v.rental_period_options.includes(d)} onChange={() => togglePeriod(d)} />
                      {d} days
                    </label>
                  ))}
                </div>
                {errors.rental_period_options && <p role="alert" className="mt-1 text-sm text-red-700">{errors.rental_period_options}</p>}
              </fieldset>
            </div>
          )}
          {sale && (
            <Field label={`Sale price (${settings.currency}) *`} htmlFor="lf-sale_price" error={errors.sale_price}
              hint={v.sale_price ? `You’d earn about ${fmt(v.sale_price * (1 - settings.sale_commission_pct / 100))} after the ${settings.sale_commission_pct}% platform fee.` : undefined}>
              <input id="lf-sale_price" type="number" min={1} step="0.5" inputMode="decimal" className={`input ${err('sale_price')}`}
                value={v.sale_price ?? ''} onChange={(e) => set('sale_price', e.target.value === '' ? null : Number(e.target.value))} />
            </Field>
          )}
        </section>

        <section className="card space-y-4 p-5" aria-labelledby="s-pickup">
          <h2 id="s-pickup" className="text-xl">Pickup</h2>
          <Field label="Public pickup area *" htmlFor="lf-pickup_area" error={errors.pickup_area} hint="A neighbourhood or landmark — shown to everyone. Don’t put your house number here.">
            <input id="lf-pickup_area" className={`input ${err('pickup_area')}`} maxLength={100} value={v.pickup_area} onChange={(e) => set('pickup_area', e.target.value)} />
          </Field>
          <Field label="Exact address or meeting point (private)" htmlFor="lf-exact_address" hint="Shown only to the borrower/buyer after you accept their request.">
            <input id="lf-exact_address" className="input" maxLength={300} value={v.exact_address} onChange={(e) => set('exact_address', e.target.value)} />
          </Field>
          <Field label="Handover notes (private)" htmlFor="lf-handover_notes" hint="e.g. preferred times. Shown only after you accept.">
            <textarea id="lf-handover_notes" rows={2} maxLength={500} className="input" value={v.handover_notes} onChange={(e) => set('handover_notes', e.target.value)} />
          </Field>
        </section>

        <section className="card p-5">
          <Field label="Visibility" htmlFor="lf-status">
            <select id="lf-status" className="input" value={v.status} onChange={(e) => set('status', e.target.value as 'active' | 'paused')}>
              <option value="active">Live — visible to everyone</option>
              <option value="paused">Paused — hidden from browse</option>
            </select>
          </Field>
        </section>

        {formError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{formError}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <Link to="/dashboard/listings" className="btn-ghost no-underline">Cancel</Link>
          <button className="btn-primary" disabled={saving || uploading}>{saving && <Spinner className="border-white/40 border-t-white" />}{editing ? 'Save changes' : 'Publish listing'}</button>
        </div>
      </form>
    </div>
  )
}
