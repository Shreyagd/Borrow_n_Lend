# BorrowLend payments & revenue

Status: **integration boundary, ledger and dashboards are built and tested. Live payments are OFF** until a payment
provider has approved your marketplace account. Until then the site runs in *manual* mode (owners may note an
off-platform payment) or, in demo mode, a clearly-labelled simulated checkout. Nothing in this repo has been run against a
live provider.

## 1. Revenue model

| Item | Default | Where it lives |
|---|---|---|
| Commission on completed **rentals** | **15%** | `admin_settings.rental_commission_pct` |
| Commission on completed **sales** | **10%** | `admin_settings.sale_commission_pct` |

- Rates are server-controlled: stored in Postgres, readable by everyone (they are shown before checkout), **writable only by
  admins** (RLS). They are never part of editable frontend state.
- Each rental/order **snapshots** the rate when it is requested (`commission_pct`, `platform_fee`). Changing a rate later never
  alters existing deals.
- The customer pays the listed price. The commission is **deducted from the owner’s earnings**, not added to the customer’s total.
  Gateway fees are paid by the platform out of its commission (no hidden customer surcharge). Both are shown at checkout.
- **Revenue is recorded separately from gross value** in an append-only ledger (§4). Commission counts as revenue only when the
  provider has *verified* the payment. Owner-recorded (manual) payments and demo payments are excluded; the commission on manual
  payments is shown as “accrued, not collected”.
- Not implemented: delivery charges (always 0), deposits (never collected), automatic late/damage fees (not allowed without an
  approved, disclosed, legally reviewed process), GST/tax invoices (see §7).

## 2. How a payment flows (Razorpay Route, as implemented)

```
Customer (browser)                Supabase Edge Functions               Razorpay                Postgres
──────────────────                ───────────────────────               ────────                ────────
Pay now ─────────────────────────► create-payment-order
                                    payments_prepare (user JWT) ───────────────────────────────► amounts, owner, payout acct
                                    POST /orders  (+ Route transfer) ──► order_xxx
                                    payments_attach_provider_order ─────────────────────────────► tx = awaiting_payment
◄──── order_id, key_id (no secrets)
Checkout (UPI / cards / netbanking / wallets, on Razorpay's hosted form)
callback ─► verify-payment ──────── re-fetch payment with SECRET key ───► status=captured?
                                    payments_apply_capture ─────────────────────────────────────► paid, ledger, settlement
                                              (same function, idempotent)
                                   ◄── payment.captured (signed webhook) ── payment-webhook ────► (duplicate → no-op)
                                    transfer.processed / failed ─────────────────────────────────► settlement state
                                    refund.processed ────────────────────────────────────────────► refund + commission reversal
```

The browser’s own “success” callback is **only a hint**. The order is shown as paid only after the server confirms with the
provider (via the API fetch in `verify-payment` or the signed webhook).

## 3. Statuses

`payment_status` (on rentals/orders): `unpaid → awaiting_payment → paid`, or `failed`, `refund_pending`, `partially_refunded`,
`refunded`. Two statuses are **never** real money: `manual_received` (an owner’s unverified note) and `demo_simulated`.
`settlement_status`: `not_due → pending → processing → settled` (or `failed`, `reversed`).

## 4. Ledger & reconciliation

`ledger_entries` is append-only (a trigger blocks UPDATE/DELETE for everyone) and idempotent (unique `idempotency_key`):

| entry | sign | meaning |
|---|---|---|
| `gross_captured` | + | customer paid |
| `platform_commission` | + | BorrowLend revenue |
| `owner_earning` | + | owed to the owner |
| `refund_gross` / `commission_reversal` / `owner_earning_reversal` | − | refund, split in the original proportion (cumulative, no rounding drift) |
| `owner_payout` | − | provider settled the owner |

Invariant for every payment: `gross + refunds = commission + commission_reversals + owner_earning + owner_reversals`.

`admin_reconciliation()` (Admin → Payments) reports: captured payments without ledger entries, unbalanced ledgers, ledger vs.
payment mismatches, transactions whose status disagrees with their payment, owners paid more than they earned after refunds
(**a refund after settlement needs a transfer reversal with the provider — do this manually**), settlements stuck > 7 days,
and provider events that failed processing. It also returns totals (gross, refunds, commission revenue, owner earnings, paid
out, pending settlement, demo volume, manual commission accrued).

## 5. Security properties and where they are enforced

| Requirement | Enforcement |
|---|---|
| Never trust the frontend’s “payment success” | `verify-payment` re-fetches from Razorpay with the secret key; checkout signature is checked; webhook is authoritative |
| Signed webhooks | HMAC-SHA256 of the **raw body** with `RAZORPAY_WEBHOOK_SECRET`, constant-time compare (`_shared/razorpay.ts`, unit-tested) |
| Idempotency | `payment_events (provider, event_id)` unique; `payments_apply_*` re-checkable; ledger keys unique; one live payment per rental/order (partial unique index) |
| Amounts come from the server | `payments_prepare` reads price/commission from the DB; a captured amount that differs is rejected and the order is **not** marked paid |
| Only the server can mark paid | `payments_apply_*` execute grants: `service_role` only (verified in the SQL test suite) |
| No raw card data | Card entry happens on the provider’s hosted form; the DB stores only provider references |
| No secrets in the browser | Only the publishable `key_id` is returned; secrets are Edge Function secrets |
| Demo is never “paid” | demo checkout writes `demo_simulated` and `is_demo` ledger rows, excluded from revenue |
| No manual escrow / arbitrary deductions | none exist; `settlement_policy` only allows `provider_default` |
| Admin-only actions | refunds (`refund-payment` checks `is_admin()`), payout accounts, settings, reconciliation |

## 6. Provider evaluation: Razorpay Route vs Cashfree Easy Split

Both are marketplace split-payment products. Details below come from each provider’s public docs; **fees, settlement cycles and
eligibility were not verified** – get them in writing from the provider’s sales/onboarding team.

| | **Razorpay Route** | **Cashfree Easy Split** |
|---|---|---|
| Model | Create an order with a `transfers` array to **linked accounts** (your owners); transfers happen after the payment is **captured**; the remainder stays with you as commission | Register **vendors**, then split an order **by amount or percentage**, either when creating the order or **after payment** (call it only after success; docs say wait ~2 minutes) |
| Owner onboarding | Linked accounts need KYC via Razorpay (dashboard or Accounts API) | Vendors need KYC via Cashfree (Easy Split vendor APIs) |
| Holding settlement | Transfers can be placed **on hold** / released (`on_hold`, `on_hold_until`) – a provider feature, but using it as “hold until return” is a business/legal decision (see below) | Vendor settlement timing and any hold options need to be confirmed with Cashfree |
| Webhooks | `payment.captured`, `payment.failed`, `refund.processed`, `transfer.processed`, `transfer.failed`; signature header `X-Razorpay-Signature`; unique id header `x-razorpay-event-id` | Equivalent payment/settlement webhooks (not implemented here) |
| Recon | Fetch transfers for a payment; settlement status `pending / on_hold / settled` | “Get split and settlement details by order id” (settled/unsettled per vendor) |
| Gating | **Route must be enabled on your account** and is subject to RBI payment-aggregator marketplace rules | **Easy Split must be activated** on your gateway account |
| In this repo | **Implemented** (order + Route transfer, signed webhook, verify, refund, settlement sync) – untested against live Razorpay | **Not implemented.** The DB, ledger and UI are provider-neutral; add `_shared/cashfree.ts` + a branch in the functions |

**Recommendation:** start with Razorpay Route (implemented, hosted checkout supports UPI, debit/credit cards, net banking and
wallets). Apply for the marketplace/Route product first – approval is the long pole and is outside this codebase. Keep Cashfree as
the fallback if Razorpay declines or the commercials are better.

**On “hold until return”.** The platform must not promise that payment is held until the book is returned unless (a) the provider
supports and has approved holding marketplace funds, (b) the arrangement is disclosed to users in the Terms, and (c) legal/finance have
reviewed it (escrow-like arrangements can trigger regulation). The code deliberately settles on the provider’s default schedule
(`settlement_policy = provider_default`). If you later get approval, implement it as a provider feature (`on_hold` on the transfer,
released by an admin/cron after completion) – not as a manual escrow in your own account.

## 7. Before you accept real money — checklist

Business / legal (cannot be done in code):
- [ ] Registered business entity, bank account, and the provider’s **business verification (KYC/KYB)**.
- [ ] Provider **marketplace/split-payments approval** (Razorpay Route enabled, or Cashfree Easy Split activated) and a signed agreement.
- [ ] Understand RBI payment-aggregator rules for marketplaces and who is the merchant of record; written confirmation from the provider.
- [ ] **Tax:** whether GST applies to your commission, tax invoices for the commission, and any TCS/TDS obligations as a marketplace operator – **consult a chartered accountant**. The app issues payment *receipts*, not tax invoices.
- [ ] Final Terms, Privacy, Rental & Refund policy reviewed by a lawyer (the pages in the app are drafts). Disclose commission, settlement timing and refund rules.
- [ ] Decide dispute/chargeback handling (card-network chargebacks arrive from the provider and must be reflected manually in the ledger – not automated).
- [ ] Decide whether late/damage fees or deposits will ever exist; they need a disclosed, legally reviewed process before any code charges them.

Technical:
- [ ] Apply `supabase/migrations/0001…0004` on a **staging** project first; run the flow with Razorpay **test keys**.
- [ ] Set Edge Function secrets (below), deploy the functions, add the webhook, link payout accounts.
- [ ] Complete a test purchase + refund + settlement and confirm Admin → Payments → Reconciliation shows no issues.
- [ ] Only then: Admin → Settings → provider = Razorpay and tick **Live online payments**.

## 8. Setup

```bash
# 1. database
supabase db push                                   # applies 0001..0004

# 2. secrets (never put these in a VITE_ variable or commit them)
supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxx RAZORPAY_KEY_SECRET=xxx RAZORPAY_WEBHOOK_SECRET=xxx \
                     ALLOWED_ORIGIN=https://your-domain.example CRON_SECRET=a-long-random-string
# SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided to Edge Functions automatically.

# 3. functions
supabase functions deploy create-payment-order
supabase functions deploy verify-payment
supabase functions deploy refund-payment
supabase functions deploy reconcile-settlements
supabase functions deploy payment-webhook --no-verify-jwt     # Razorpay does not send a Supabase JWT
```

| Secret | Used by | Notes |
|---|---|---|
| `RAZORPAY_KEY_ID` | create-payment-order (returned to the browser), verify, refund, reconcile | publishable id |
| `RAZORPAY_KEY_SECRET` | server only | **secret** |
| `RAZORPAY_WEBHOOK_SECRET` | payment-webhook | the webhook’s own secret (not the API key) |
| `ALLOWED_ORIGIN` | CORS | your site origin |
| `CRON_SECRET` | reconcile-settlements | lets a scheduler call it without an admin login |

**Razorpay dashboard:** enable Route; keep payments on **auto-capture**; create a webhook → `https://<project>.functions.supabase.co/payment-webhook`
with the events `payment.captured`, `payment.failed`, `refund.processed`, `transfer.processed`, `transfer.failed`; paste its secret into
`RAZORPAY_WEBHOOK_SECRET`. Create a **linked account** for each owner who will be paid, complete its KYC, then record the account id in
**Admin → Payments → Payout accounts** (status *Active*). Owners without an active account cannot receive online payments.

**Schedule settlement sync** (so a missed webhook never strands a payout), e.g. with pg_cron + pg_net every hour:
```sql
select cron.schedule('sync-settlements', '0 * * * *', $$
  select net.http_post(url := 'https://<project>.functions.supabase.co/reconcile-settlements',
                       headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')) $$);
```

## 9. Dashboards

- **Customer** – Dashboard → *Payments*: history, receipts (printable), refunds, order status.
- **Owner** – Dashboard → *Earnings*: gross (verified), commission, net, pending settlement, paid out, refunded; unverified manual/demo amounts are shown separately.
- **Admin** – Admin → *Payments*: revenue & settlement totals, reconciliation, transactions with **Refund**, payout accounts, ledger. Admin → *Settings*: commission rates, provider, live switch.

## 10. Testing

```bash
npm test          # business rules, demo payment flow, ledger maths, Razorpay signature/webhook mapping
npm run test:sql  # runs all migrations in an in-process Postgres (PGlite) with Supabase-style roles:
                  # privileges, RLS, idempotent capture/refund/settlement, append-only ledger, reconciliation
```
`test:sql` proves the SQL runs and behaves; it does not replace a staging run against a real Supabase project and the provider’s test mode.

## 11. Known limits / next steps

- Cashfree Easy Split adapter not written; Razorpay code is unverified against a live account (field names follow the public docs).
- Owner linked-account onboarding is manual (provider dashboard + admin entry); no in-app KYC.
- A refund **after** settlement is flagged by reconciliation but the transfer reversal is a manual provider action.
- Card-network chargebacks, partial captures, multi-currency and EMI/subscriptions are not handled.
- Receipts are not GST invoices.
