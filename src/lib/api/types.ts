import type {
  AdminStats, HandoverInfo, Listing, ListingFilters, ListingInput, ListingPrivate, Notification, Order, Page,
  Profile, PublicReview, Rental, Report, ReportTarget, ReviewSummary, Settings,
} from '../types'

export interface AuthUser {
  id: string
  email: string
}

export type TxKind = 'rental' | 'order'

/**
 * The single boundary between UI and backend. Two implementations:
 *  - supabaseApi: real backend (Postgres + RLS + SQL functions)
 *  - demoApi: browser-only demo store used when no Supabase credentials are configured
 * All authorisation lives behind this boundary (RLS/SQL in Supabase; mirrored checks in demo).
 */
export interface Api {
  mode: 'supabase' | 'demo'

  auth: {
    getUser(): Promise<AuthUser | null>
    signUp(email: string, password: string, displayName: string): Promise<{ needsConfirmation: boolean }>
    signIn(email: string, password: string): Promise<void>
    signOut(): Promise<void>
    onChange(cb: () => void): () => void
  }

  profiles: {
    mine(): Promise<{ profile: Profile; phone: string | null } | null>
    updateMine(v: { display_name: string; city: string; phone: string }): Promise<void>
    rating(userId: string): Promise<{ avg: number; count: number }>
  }

  settings: {
    get(): Promise<Settings>
  }

  listings: {
    search(f: ListingFilters): Promise<Page<Listing>>
    recent(n: number): Promise<Listing[]>
    get(id: string): Promise<Listing | null>
    getPrivate(id: string): Promise<ListingPrivate | null>
    mine(): Promise<Listing[]>
    create(input: ListingInput): Promise<Listing>
    update(id: string, input: ListingInput): Promise<Listing>
    setStatus(id: string, status: 'active' | 'paused' | 'removed'): Promise<void>
    uploadImage(file: File): Promise<string>
  }

  rentals: {
    mine(): Promise<Rental[]>
    request(listingId: string, days: number): Promise<Rental>
    respond(id: string, accept: boolean, reason?: string): Promise<Rental>
    cancel(id: string): Promise<Rental>
    confirmHandover(id: string): Promise<Rental>
    requestReturn(id: string): Promise<Rental>
    confirmReturn(id: string): Promise<Rental>
    markOverdue(): Promise<void>
  }

  orders: {
    mine(): Promise<Order[]>
    create(listingId: string): Promise<Order>
    respond(id: string, accept: boolean, reason?: string): Promise<Order>
    cancel(id: string): Promise<Order>
    confirmHandover(id: string): Promise<Order>
  }

  transactions: {
    handoverInfo(kind: TxKind, id: string): Promise<HandoverInfo>
    markPaymentReceived(kind: TxKind, id: string): Promise<void>
    review(kind: TxKind, id: string, rating: number, comment: string): Promise<void>
  }

  reviews: {
    recent(n: number): Promise<PublicReview[]>
    summary(): Promise<ReviewSummary>
  }

  reports: {
    create(v: { target_type: ReportTarget; target_id: string; kind: 'report' | 'dispute'; reason: string; details: string }): Promise<void>
  }

  notifications: {
    list(): Promise<Notification[]>
    markRead(id: string | 'all'): Promise<void>
  }

  admin: {
    stats(): Promise<AdminStats>
    users(): Promise<Profile[]>
    listings(): Promise<Listing[]>
    rentals(): Promise<Rental[]>
    orders(): Promise<Order[]>
    reports(): Promise<Report[]>
    setUserSuspended(id: string, suspended: boolean): Promise<void>
    setListingModeration(id: string, v: { hidden?: boolean; flagged?: boolean }): Promise<void>
    resolveReport(id: string, status: 'resolved' | 'dismissed', note: string, outcome?: string): Promise<void>
    updateSettings(s: Settings): Promise<void>
    /** Admin check for UI gating only; the server enforces it independently. */
    isAdmin(): Promise<boolean>
  }

  /** Demo mode only. */
  demo?: { reset(): void }
}
