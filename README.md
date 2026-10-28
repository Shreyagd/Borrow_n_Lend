# BorrowLend

Peer-to-peer book rental and resale marketplace (pilot MVP). React + TypeScript + Vite + Tailwind; Supabase (Postgres, Auth, Storage, RLS, SQL functions) as the backend.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # business rules, payment/ledger flow, Razorpay signature + webhook mapping
npm run test:sql   # runs every migration in an in-process Postgres and checks RLS, privileges, idempotency, ledger
npm run lint && npm run build
```

**Demo mode:** with no `.env`, the app runs against a browser-only demo backend (localStorage). Sample books/people are labelled "Sample"; a banner shows on every page. Demo logins (password `demo1234`): `asha@`, `ravi@`, `meera@borrowlend.demo`, admin `admin@borrowlend.demo`. Demo data is not secure and not shared between browsers.

## Connect Supabase (real mode)

1. Create a Supabase project.
2. SQL editor: run `supabase/migrations/0001_schema.sql` … `0004_payments.sql` in order (or `supabase db push`). Payments stay **off** until you follow [docs/PAYMENTS.md](docs/PAYMENTS.md).
3. Auth → Providers: enable Email. Decide whether to require email confirmation (the UI handles both). Set Site URL / redirect URLs to your deployed domain. Configure a real SMTP provider before launch.
4. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project settings → API). Never use the `service_role` key in the frontend.
5. Make yourself admin: sign up, then in the SQL editor run
   `update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');`
   (Clients cannot change `role`; a trigger blocks it.)
6. Storage: bucket `book-images` is created by migration 0003 (public read, 3 MB, jpeg/png/webp, users write only to their own folder).
7. Optional: schedule overdue marking with pg_cron: `select cron.schedule('overdue', '0 * * * *', 'select public.mark_overdue()');`. The app also calls it when users open the dashboard.

## Deploy (Vercel)

Import the repo, framework "Vite", build `npm run build`, output `dist`. Add the two `VITE_` env vars. `vercel.json` rewrites all routes to `index.html`.

## Routes

`/` · `/browse` · `/books/:id` · `/saved` · `/request-list` · `/how-it-works` · `/about` `/contact` `/faq` `/terms` `/privacy` `/policies` · `/auth`
Signed in: `/list`, `/list/:id`, `/account`, `/dashboard` (+ `/listings` `/requests` `/borrowings` `/purchases` `/payments` `/earnings`)
Admin: `/admin` (+ `/reports` `/users` `/listings` `/rentals` `/orders` `/payments` `/settings`)

## Architecture & security

- `src/lib/api/types.ts` is the single UI↔backend boundary; `supabaseApi.ts` and `demoApi.ts` implement it.
- All rental/order/report/review state changes are `SECURITY DEFINER` SQL functions that authorise against `auth.uid()`, lock the listing row, and enforce the rules. Clients have no insert/update rights on those tables (RLS + revoked grants).
- Overlap prevention: partial unique indexes allow only one in-progress rental (and one accepted/completed order) per listing, plus row locking.
- Private data: exact address, handover notes and phone live in `listing_private` / `profile_private`, readable only by the owner, admins, and a counterparty with an accepted deal.
- Admin: `profiles.role` is protected by a trigger; admin reads/writes are gated by `is_admin()` in RLS and functions. The UI gate is cosmetic.
- Rate limits: DB-enforced caps (10 requests/hour, 10 reports/hour, 20 listings/day per user). Add CAPTCHA/edge limits before scaling.
- Pricing: rental price is per 7 days, prorated for 7/14/21/30-day periods. A platform commission (default **15% on rentals, 10% on sales**, admin-only, server-stored) is snapshotted on each request and deducted from the owner's earnings, never added to the customer's total.
- Payments: provider-neutral boundary with an append-only, idempotent ledger, settlements, signed-webhook handling, refunds and reconciliation (migration `0004`, Edge Functions in `supabase/functions/`). Only the server can mark a transaction `paid`; the browser, demo mode and owner notes never can. Full design, provider evaluation and go-live checklist: **[docs/PAYMENTS.md](docs/PAYMENTS.md)**.

## Complete vs. mocked/manual

- **Editorial integration:** the home, browse, and saved routes use the Paper Haven inspired views and real BorrowLend listing APIs. Rental and purchase buttons open the existing listing details, where authenticated requests use the existing server-validated lifecycle. Covers, prices, conditions, owners, pickup areas, filters, pagination, and saved IDs map to real listing data.
- **Prototype components not connected:** the pulled `CartCheckoutView`, `OrderConfirmationModal`, `MyShelfView`, `HowItWorksView`, and `CommunityView` contain simulated checkout, generated locker PINs, fictional deposits/escrow, seeded personal dashboards, or local-only community posts. They are intentionally not routed as operational flows. Use the real dashboard and `/how-it-works` page for those functions.
- **Complete:** auth, listings CRUD + image upload, browse/search/filters/pagination, rental and order lifecycles, in-app notifications, reports/disputes, reviews, admin tools, configurable commission, tests.
- **Manual / not built:**
  - Payments: **built but switched off.** Razorpay Route integration (create order with owner transfer, hosted checkout, signed webhooks, refunds, settlement sync) is implemented and unit/SQL-tested, but has **not been run against a live provider** and needs provider marketplace approval, business/KYC verification and credentials (see docs/PAYMENTS.md). Cashfree Easy Split is evaluated, not implemented. Until then: owners can record an *unverified* off-platform payment (never revenue), and demo mode offers a labelled simulated checkout that never marks anything paid. No escrow, deposits, or automatic late/damage fees exist.
  - Email notifications: in-app only.
  - Delivery and distance/"nearby" search: not built. The location filter is a text match on pickup area.
  - Relevance sort in Supabase mode is newest-first among matches (demo mode scores matches).
  - Legal pages are draft placeholders; the contact email is a placeholder.
  - SEO: titles/meta are set client-side in a SPA, so link-preview crawlers won't see per-book meta. Add prerendering if social sharing matters.

## Launch checklist

- [ ] Run the migrations on a real Supabase project and walk through the full flow with 2–3 accounts. `npm run test:sql` runs the SQL in an in-process Postgres, but it has **not** been run on a real Supabase project.
- [ ] Real SMTP, auth redirect URLs, email confirmation policy
- [ ] Promote the first admin; review commission rates (15% rentals / 10% sales are starting assumptions), currency and launch city in `/admin/settings`
- [ ] Lawyer-reviewed Terms, Privacy and Rental policy; real contact email
- [ ] Before taking money: complete the checklist in [docs/PAYMENTS.md](docs/PAYMENTS.md) (provider approval, KYC/KYB, tax advice, legal review, test-mode run)
- [ ] Backups, monitoring, CAPTCHA on sign-up
