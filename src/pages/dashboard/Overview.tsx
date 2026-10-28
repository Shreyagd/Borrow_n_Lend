import { Link } from 'react-router-dom'
import { useDash } from './DashboardLayout'
import { useSettings } from '../../context/SettingsContext'
import { computeEarnings } from '../../lib/earnings'
import { dateShort } from '../../lib/format'
import { daysUntil } from '../../lib/rules'

export default function Overview() {
  const { me, listings, rentals, orders, received } = useDash()
  const { fmt } = useSettings()

  const mine = (r: (typeof rentals)[number]) => r.owner_id === me
  const activeBorrowed = rentals.filter((r) => r.borrower_id === me && ['active', 'overdue', 'return_requested'].includes(r.status))
  const incoming = [...rentals.filter((r) => mine(r) && r.status === 'requested'), ...orders.filter((o) => o.seller_id === me && o.status === 'requested')]
  const completed = rentals.filter((r) => r.status === 'completed').length + orders.filter((o) => o.status === 'completed').length
  const earnings = computeEarnings(me, rentals, orders, received)

  const actions: { key: string; text: string; to: string; urgent?: boolean }[] = []
  for (const r of rentals) {
    const t = r.listing?.title ?? 'a book'
    if (mine(r) && r.status === 'requested') actions.push({ key: r.id, text: `Rental request for “${t}” is waiting for your answer`, to: '/dashboard/requests' })
    if (mine(r) && r.status === 'accepted' && !r.owner_handover_confirmed_at) actions.push({ key: r.id, text: `Confirm handover of “${t}”`, to: '/dashboard/requests' })
    if (!mine(r) && r.status === 'accepted' && !r.borrower_handover_confirmed_at) actions.push({ key: r.id, text: `Confirm you received “${t}”`, to: '/dashboard/borrowings' })
    if (mine(r) && r.status === 'return_requested') actions.push({ key: r.id, text: `“${t}” is on its way back — confirm return`, to: '/dashboard/requests' })
    if (!mine(r) && r.status === 'overdue') actions.push({ key: r.id, text: `“${t}” is overdue — please return it`, to: '/dashboard/borrowings', urgent: true })
    if (!mine(r) && r.status === 'active' && r.due_date && daysUntil(r.due_date) <= 2 && daysUntil(r.due_date) >= 0) actions.push({ key: r.id, text: `“${t}” is due ${dateShort(r.due_date)}`, to: '/dashboard/borrowings' })
  }
  for (const o of orders) {
    const t = o.listing?.title ?? 'a book'
    const seller = o.seller_id === me
    if (seller && o.status === 'requested') actions.push({ key: o.id, text: `Purchase request for “${t}” is waiting for your answer`, to: '/dashboard/requests' })
    if (o.status === 'accepted' && !(seller ? o.seller_confirmed_at : o.buyer_confirmed_at)) actions.push({ key: o.id, text: `Confirm handover of “${t}”`, to: seller ? '/dashboard/requests' : '/dashboard/purchases' })
  }

  const stats = [
    { label: 'Active borrowings', value: activeBorrowed.length, to: '/dashboard/borrowings', tint: 'tint-sage' },
    { label: 'Requests to answer', value: incoming.length, to: '/dashboard/requests', tint: 'tint-butter' },
    { label: 'My listings', value: listings.length, to: '/dashboard/listings', tint: 'tint-mist' },
    { label: 'Completed transactions', value: completed, to: '/dashboard/purchases', tint: 'tint-blush' },
  ]

  return (
    <div className="space-y-8">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label}>
            <Link to={s.to} className={`card block p-4 no-underline transition-transform hover:-translate-y-0.5 ${s.tint}`}>
              <span className="block font-sans text-3xl font-bold">{s.value}</span>
              <span className="text-sm opacity-80">{s.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section aria-labelledby="next">
        <h2 id="next" className="mb-3 text-xl">Next actions</h2>
        {actions.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-soft">
            You’re all caught up. <Link to="/browse">Find a book</Link> or <Link to="/list">list one</Link>.
          </div>
        ) : (
          <ul className="space-y-2">
            {actions.map((a, i) => (
              <li key={a.key + i}>
                <Link to={a.to} className={`card flex items-center justify-between gap-3 p-4 text-sm no-underline hover:bg-pine-light/50 ${a.urgent ? '!border-red-300 text-red-800' : 'text-ink'}`}>
                  <span>{a.text}</span><span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="earn" className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 id="earn" className="text-xl">Earnings</h2>
          <p className="text-sm text-ink-soft">Verified online payments, after platform commission. Off-platform and demo payments are not counted.</p>
        </div>
        <div className="text-right">
          <p className="font-serif text-3xl font-bold text-pine">{fmt(earnings.net)}</p>
          {earnings.pendingSettlement > 0 && <p className="text-xs text-ink-mute">{fmt(earnings.pendingSettlement)} pending settlement</p>}
          {earnings.expectedNet > 0 && <p className="text-xs text-ink-mute">+ {fmt(earnings.expectedNet)} expected once paid</p>}
        </div>
      </section>
    </div>
  )
}
