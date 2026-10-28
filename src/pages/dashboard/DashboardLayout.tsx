import { NavLink, Outlet, useOutletContext } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { useAsync, usePageMeta } from '../../lib/hooks'
import type { Listing, Order, Payment, Rental } from '../../lib/types'

export interface DashData {
  me: string
  listings: Listing[]
  rentals: Rental[]
  orders: Order[]
  /** payments I made (as customer) and payments made to me (as owner) */
  paid: Payment[]
  received: Payment[]
  reload: () => void
}
export const useDash = () => useOutletContext<DashData>()

const tabs: [string, string, boolean?][] = [
  ['/dashboard', 'Overview', true],
  ['/dashboard/listings', 'My listings'],
  ['/dashboard/requests', 'Requests'],
  ['/dashboard/borrowings', 'Borrowings'],
  ['/dashboard/purchases', 'Purchases'],
  ['/dashboard/payments', 'Payments'],
  ['/dashboard/earnings', 'Earnings'],
]

export default function DashboardLayout() {
  usePageMeta('Dashboard')
  const { user, profile } = useAuth()
  const res = useAsync(async () => {
    await api.rentals.markOverdue().catch(() => {})
    const [listings, rentals, orders, paid, received] = await Promise.all([
      api.listings.mine(), api.rentals.mine(), api.orders.mine(), api.payments.mine(), api.payments.forOwner(),
    ])
    return { listings, rentals, orders, paid, received }
  }, [user?.id])

  return (
    <div className="container-page py-8">
      <div className="mb-5 rounded-2xl border border-line bg-pine-light/60 px-5 py-5">
        <p className="text-sm text-ink-mute">Signed in as {profile?.display_name}</p>
        <h1 className="text-3xl">Your dashboard</h1>
      </div>
      <nav aria-label="Dashboard" className="-mx-4 mb-6 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1">
          {tabs.map(([to, label, end]) => (
            <li key={to}>
              <NavLink to={to} end={end} className={({ isActive }) =>
                `block whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium no-underline ${isActive ? 'border-pine text-pine-dark' : 'border-transparent text-ink-soft hover:text-ink'}`}>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {res.loading && !res.data && <LoadingState />}
      {res.error && <ErrorState message={res.error} onRetry={res.reload} />}
      {res.data && user && <Outlet context={{ me: user.id, ...res.data, reload: res.reload } satisfies DashData} />}
    </div>
  )
}
