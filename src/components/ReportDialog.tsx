import { useState, type FormEvent } from 'react'
import { useToast } from '../context/ToastContext'
import { api } from '../lib/api'
import { REPORT_REASONS } from '../lib/constants'
import type { ReportTarget } from '../lib/types'
import { Field, Modal, Spinner } from './ui'

interface Props {
  targetType: ReportTarget
  targetId: string
  kind?: 'report' | 'dispute'
  heading?: string
  onClose: () => void
  onDone?: () => void
}

export function ReportDialog({ targetType, targetId, kind = 'report', heading, onClose, onDone }: Props) {
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!reason) { setError('Please choose a reason.'); return }
    setBusy(true); setError('')
    try {
      await api.reports.create({ target_type: targetType, target_id: targetId, kind, reason, details })
      toast(kind === 'dispute' ? 'Dispute opened. An admin will review it.' : 'Report sent. Thank you for helping keep BorrowLend safe.')
      onDone?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the report.')
    } finally { setBusy(false) }
  }

  return (
    <Modal title={heading ?? (kind === 'dispute' ? 'Open a dispute' : 'Report a problem')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {kind === 'dispute' && (
          <p className="rounded-lg bg-clay-light p-3 text-sm text-clay-dark">
            Opening a dispute pauses this transaction until an admin reviews it. Please only use this if you can’t resolve the issue directly.
          </p>
        )}
        <Field label="Reason" htmlFor="rep-reason">
          <select id="rep-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Choose a reason…</option>
            {REPORT_REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Details (optional)" htmlFor="rep-details" hint="Do not include passwords or payment details.">
          <textarea id="rep-details" className="input" rows={4} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
        </Field>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy && <Spinner className="border-white/40 border-t-white" />} Submit</button>
        </div>
      </form>
    </Modal>
  )
}
