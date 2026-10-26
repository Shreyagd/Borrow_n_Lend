# BorrowLend

Peer-to-peer book rental and resale marketplace (pilot MVP). React + TypeScript + Vite + Tailwind; Supabase (Postgres, Auth, Storage, RLS, SQL functions) as the backend.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # business-rule + lifecycle tests
npm run lint && npm run build
```

**Demo mode:** with no `.env`, the app runs against a browser-only demo backend (localStorage). Sample books/people are labelled "Sample"; a banner shows on every page. Demo logins (password `demo1234`): `asha@`, `ravi@`, `meera@borrowlend.demo`, admin `admin@borrowlend.demo`. Demo data is not secure and not shared between browsers.

## Connect Supabase (real mode)

1. Create a Supabase project.
2. SQL editor: run `supabase/migrations/0001_schema.sql`, `0002_functions.sql`, `0003_policies_storage.sql` in order (or `supabase db push`).
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

`/` · `/browse` · `/books/:id` · `/how-it-works` · `/about` `/contact` `/faq` `/terms` `/privacy` `/policies` · `/auth`
Signed in: `/list`, `/list/:id`, `/account`, `/dashboard` (+ `/listings` `/requests` `/borrowings` `/purchases` `/earnings`)
Admin: `/admin` (+ `/reports` `/users` `/listings` `/rentals` `/orders` `/settings`)

## Architecture & security

- `src/lib/api/types.ts` is the single UI↔backend boundary; `supabaseApi.ts` and `demoApi.ts` implement it.
- All rental/order/report/review state changes are `SECURITY DEFINER` SQL functions that authorise against `auth.uid()`, lock the listing row, and enforce the rules. Clients have no insert/update rights on those tables (RLS + revoked grants).
- Overlap prevention: partial unique indexes allow only one in-progress rental (and one accepted/completed order) per listing, plus row locking.
- Private data: exact address, handover notes and phone live in `listing_private` / `profile_private`, readable only by the owner, admins, and a counterparty with an accepted deal.
- Admin: `profiles.role` is protected by a trigger; admin reads/writes are gated by `is_admin()` in RLS and functions. The UI gate is cosmetic.
- Rate limits: DB-enforced caps (10 requests/hour, 10 reports/hour, 20 listings/day per user). Add CAPTCHA/edge limits before scaling.
- Pricing: rental price is per 7 days, prorated for 7/14/21/30-day periods. The platform fee is snapshotted on each request and deducted from the owner's earnings (not added to the customer's total).

## Complete vs. mocked/manual

- **Complete:** auth, listings CRUD + image upload, browse/search/filters/pagination, rental and order lifecycles, in-app notifications, reports/disputes, reviews, admin tools, configurable commission, tests.
- **Manual / not built:**
  - Payments: none. Users arrange payment directly; the owner can mark "received". The `payments` table is a placeholder for a future provider. No escrow, payouts, deposits, or late/damage fees.
  - Email notifications: in-app only.
  - Delivery and distance/"nearby" search: not built. The location filter is a text match on pickup area.
  - Relevance sort in Supabase mode is newest-first among matches (demo mode scores matches).
  - Legal pages are draft placeholders; the contact email is a placeholder.
  - SEO: titles/meta are set client-side in a SPA, so link-preview crawlers won't see per-book meta. Add prerendering if social sharing matters.

## Launch checklist

- [ ] Run the migrations on a real Supabase project and walk through the full flow with 2–3 accounts. The SQL has **not** been executed against a live database yet; only the demo backend that mirrors it was tested.
- [ ] Real SMTP, auth redirect URLs, email confirmation policy
- [ ] Promote the first admin; set commission, currency and launch city in `/admin/settings` (10% is a dev assumption)
- [ ] Lawyer-reviewed Terms, Privacy and Rental policy; real contact email
- [ ] Choose a payment provider and settle KYC/refund model before taking money
- [ ] Backups, monitoring, CAPTCHA on sign-up
