import { MotionConfig } from 'framer-motion'
import { lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireAdmin, RequireAuth } from './components/guards'
import { AuthProvider } from './context/AuthContext'
import { SettingsProvider } from './context/SettingsContext'
import { ToastProvider } from './context/ToastContext'
import AuthPage from './pages/Auth'
import BookDetail from './pages/BookDetail'
import { About, Contact, Faq, HowItWorks, NotFound, Policies, Privacy, Terms } from './pages/Static'

// Signed-in areas are code-split so the public catalogue loads fast on mobile.
const Account = lazy(() => import('./pages/Account'))
const editorial = () => import('./pages/EditorialPages')
const ListingForm = lazy(() => import('./pages/ListingForm'))
const DashboardLayout = lazy(() => import('./pages/dashboard/DashboardLayout'))
const Overview = lazy(() => import('./pages/dashboard/Overview'))
const named = <K extends string>(loader: () => Promise<Record<K, React.ComponentType>>, k: K) => lazy(async () => ({ default: (await loader())[k] }))
const EditorialHomePage = named(editorial, 'EditorialHomePage')
const EditorialBrowsePage = named(editorial, 'EditorialBrowsePage')
const EditorialSavedPage = named(editorial, 'EditorialSavedPage')
const RequestListPage = named(editorial, 'RequestListPage')
const lists = () => import('./pages/dashboard/Lists')
const MyListings = named(lists, 'MyListings')
const Requests = named(lists, 'Requests')
const Borrowings = named(lists, 'Borrowings')
const Purchases = named(lists, 'Purchases')
const Earnings = named(lists, 'Earnings')
const PaymentsTab = lazy(async () => ({ default: (await import('./pages/dashboard/PaymentsTab')).PaymentsTab }))
const admin = () => import('./pages/admin/Admin')
const AdminLayout = named(admin, 'AdminLayout')
const AdminOverview = named(admin, 'AdminOverview')
const AdminReports = named(admin, 'AdminReports')
const AdminUsers = named(admin, 'AdminUsers')
const AdminListings = named(admin, 'AdminListings')
const AdminRentals = named(admin, 'AdminRentals')
const AdminOrders = named(admin, 'AdminOrders')
const AdminSettings = named(admin, 'AdminSettings')
const AdminPayments = lazy(async () => ({ default: (await import('./pages/admin/AdminPayments')).AdminPayments }))

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
    <BrowserRouter>
      <ToastProvider>
        <SettingsProvider>
          <AuthProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<EditorialHomePage />} />
                <Route path="browse" element={<EditorialBrowsePage />} />
                <Route path="books/:id" element={<BookDetail />} />
                <Route path="how-it-works" element={<HowItWorks />} />
                <Route path="about" element={<About />} />
                <Route path="contact" element={<Contact />} />
                <Route path="faq" element={<Faq />} />
                <Route path="terms" element={<Terms />} />
                <Route path="privacy" element={<Privacy />} />
                <Route path="policies" element={<Policies />} />
                <Route path="auth" element={<AuthPage />} />
                <Route path="saved" element={<EditorialSavedPage />} />
                <Route path="request-list" element={<RequestListPage />} />

                <Route element={<RequireAuth />}>
                  <Route path="list" element={<ListingForm />} />
                  <Route path="list/:id" element={<ListingForm />} />
                  <Route path="account" element={<Account />} />
                  <Route path="dashboard" element={<DashboardLayout />}>
                    <Route index element={<Overview />} />
                    <Route path="listings" element={<MyListings />} />
                    <Route path="requests" element={<Requests />} />
                    <Route path="borrowings" element={<Borrowings />} />
                    <Route path="purchases" element={<Purchases />} />
                    <Route path="payments" element={<PaymentsTab />} />
                    <Route path="earnings" element={<Earnings />} />
                  </Route>
                  <Route element={<RequireAdmin />}>
                    <Route path="admin" element={<AdminLayout />}>
                      <Route index element={<AdminOverview />} />
                      <Route path="reports" element={<AdminReports />} />
                      <Route path="users" element={<AdminUsers />} />
                      <Route path="listings" element={<AdminListings />} />
                      <Route path="rentals" element={<AdminRentals />} />
                      <Route path="orders" element={<AdminOrders />} />
                      <Route path="payments" element={<AdminPayments />} />
                      <Route path="settings" element={<AdminSettings />} />
                    </Route>
                  </Route>
                </Route>
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </AuthProvider>
        </SettingsProvider>
      </ToastProvider>
    </BrowserRouter>
    </MotionConfig>
  )
}
