// Run with:  npm run test:sql
// Executes the real migrations in an in-process Postgres (PGlite) with Supabase-like roles, then exercises the
// payment state machine, RLS and privileges. Not a substitute for a staging project, but it proves the SQL runs.
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'

const MIG = new URL('../supabase/migrations/', import.meta.url)
const db = new PGlite({ extensions: { pg_trgm } })
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ✓', name) } else { fail++; console.log('  ✗', name, extra) } }
const expectErr = async (name, fn, re) => {
  try { await fn(); fail++; console.log('  ✗', name, '(no error)') }
  catch (e) { const m = String(e.message); if (!re || re.test(m)) { pass++; console.log('  ✓', name) } else { fail++; console.log('  ✗', name, '->', m) } }
}

// ── Supabase-like environment ──
await db.exec(`
  create schema auth; create schema extensions; create schema storage;
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create role authenticator noinherit login; grant anon, authenticated, service_role to authenticator;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
  create extension pg_trgm with schema extensions;
  grant usage on schema public, auth, extensions, storage to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`)
for (const f of ['0001_schema.sql', '0002_functions.sql', '0003_policies_storage.sql', '0004_payments.sql']) {
  try { await db.exec(readFileSync(new URL(f, MIG), 'utf8')); console.log('applied', f) }
  catch (e) { console.log('FAILED', f, '->', e.message); process.exit(1) }
}

// helpers to act as a role like PostgREST does (session_user = authenticator, role switched per request)
const as = async (uid, role = 'authenticated') => {
  await db.exec(`reset role; reset session authorization;`)
  await db.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', $2, false)`, [uid ?? '', role])
  await db.exec(`set session authorization authenticator; set role ${role};`)
}
const root = async () => { await db.exec(`reset role; reset session authorization;`); await db.query(`select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', '', false)`) }
const one = async (sql, params) => (await db.query(sql, params)).rows[0]
const all = async (sql, params) => (await db.query(sql, params)).rows

process.on('uncaughtException', (e) => { console.log(String.fromCharCode(10) + 'UNCAUGHT: ' + String(e.message).slice(0, 400) + (e.where ? String.fromCharCode(10) + '  at ' + String(e.where).slice(0, 300) : '')); process.exit(1) })
// ── people ──
await root()
const mk = async (email, name) => (await one(`insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('display_name', $2::text)) returning id`, [email, name])).id
const admin = await mk('admin@x.test', 'Admin'), owner = await mk('owner@x.test', 'Owner'), buyer = await mk('buyer@x.test', 'Buyer'), other = await mk('other@x.test', 'Other')
await db.query(`update public.profiles set role = 'admin' where id = $1`, [admin])
ok('profiles auto-created', (await all(`select 1 from public.profiles`)).length === 4)

console.log('\nlisting + rental + commission')
await as(owner)
const listing = (await one(`insert into public.listings (owner_id, title, author, category, condition, listing_type, rental_price, rental_period_options, sale_price, pickup_area)
  values ($1, 'Atomic Habits', 'James Clear', 'Self-Help', 'good', 'both', 40, '{7,14}', 200, 'Central') returning id`, [owner])).id
await as(buyer)
const rental = await one(`select * from public.request_rental($1, 14)`, [listing])
ok('rental commission is 15% of 80 = 12', Number(rental.rental_amount) === 80 && Number(rental.platform_fee) === 12 && Number(rental.commission_pct) === 15, JSON.stringify(rental))
ok('new rental is unpaid / not_due', rental.payment_status === 'unpaid' && rental.settlement_status === 'not_due')
await as(owner)
await db.query(`select * from public.respond_rental($1, true)`, [rental.id])

console.log('\nonline payments are refused until live')
await as(buyer)
await expectErr('payments_prepare refuses while payments are off', () => db.query(`select public.payments_prepare('rental', $1)`, [rental.id]), /not enabled/i)
await as(owner)
await expectErr('owner cannot flip the commission or provider settings', () => db.query(`update public.admin_settings set rental_commission_pct = 0 returning id`).then((r) => { if (!r.rows.length) throw new Error('0 rows updated (RLS blocked)') }), /RLS|0 rows|permission/i)

console.log('\nadmin configures provider + payout account')
await as(admin)
await db.query(`update public.admin_settings set payment_provider = 'razorpay', payments_live = true where id = 1`)
await expectErr('cannot go live with the manual provider', () => db.query(`update public.admin_settings set payment_provider = 'manual' where id = 1`), /live_needs_provider/)
await expectErr('active payout account needs an id', () => db.query(`select public.admin_set_payout_account($1, 'razorpay', '', 'active')`, [owner]), /needs the provider account id/)
await db.query(`select public.admin_set_payout_account($1, 'razorpay', 'acc_OWNER1', 'active')`, [owner])

console.log('\nprepare')
await as(other)
await expectErr('a stranger cannot prepare someone else\'s payment', () => db.query(`select public.payments_prepare('rental', $1)`, [rental.id]), /not found/i)
await as(buyer)
const prep = (await one(`select public.payments_prepare('rental', $1) as p`, [rental.id])).p
ok('prepare returns server-computed amounts (80 / 12 / 68)', Number(prep.amount) === 80 && Number(prep.commission) === 12 && Number(prep.owner_net) === 68 && prep.owner_account_id === 'acc_OWNER1', JSON.stringify(prep))
const prep2 = (await one(`select public.payments_prepare('rental', $1) as p`, [rental.id])).p
ok('prepare is idempotent (same payment row)', prep2.payment_id === prep.payment_id)

console.log('\nprivileges: only the service role can apply provider facts')
for (const fn of [
  `public.payments_apply_capture('razorpay','order_1','pay_1',80,'INR','upi')`,
  `public.payments_apply_refund('razorpay','pay_1','rfnd_1',10)`,
  `public.payments_log_event('razorpay','evt_1','payment.captured','{}'::jsonb)`,
  `public.payments_attach_provider_order('${prep.payment_id}','order_1')`,
]) await expectErr(`authenticated cannot call ${fn.split('(')[0]}`, () => db.query(`select ${fn}`), /permission denied|Service role only/i)
await expectErr('buyer cannot write the ledger directly', () => db.query(`insert into public.ledger_entries (tx_kind, tx_id, entry_type, amount, currency, idempotency_key) values ('rental', $1, 'gross_captured', 1, 'INR', 'x')`, [rental.id]), /permission denied/i)
await expectErr('buyer cannot mark the rental paid directly', () => db.query(`update public.rentals set payment_status = 'paid' where id = $1`, [rental.id]), /permission denied/i)
await expectErr('buyer cannot use the manual-note function while live', () => db.query(`select public.mark_payment_received('rental', $1)`, [rental.id]), /not found|Online payments are enabled|ready/i)

console.log('\nservice role: webhook processing')
await as(null, 'service_role')
const ev1 = (await one(`select public.payments_log_event('razorpay','evt_1','payment.captured','{}'::jsonb) as s`)).s
ok('first delivery of an event is "new"', ev1 === 'new')
await db.query(`select public.payments_attach_provider_order($1, 'order_RZP1')`, [prep.payment_id])
ok('tx is awaiting_payment after attach', (await one(`select payment_status from public.rentals where id = $1`, [rental.id])).payment_status === 'awaiting_payment')
await expectErr('amount mismatch is rejected and nothing is marked paid', () => db.query(`select public.payments_apply_capture('razorpay','order_RZP1','pay_RZP1',79,'INR','upi')`), /Amount mismatch/)
ok('still not paid after mismatch', (await one(`select payment_status from public.rentals where id = $1`, [rental.id])).payment_status !== 'paid')
const cap1 = (await one(`select public.payments_apply_capture('razorpay','order_RZP1','pay_RZP1',80,'INR','upi') as r`)).r
const cap2 = (await one(`select public.payments_apply_capture('razorpay','order_RZP1','pay_RZP1',80,'INR','upi') as r`)).r
ok('capture applies once, replays are "duplicate"', cap1 === 'captured' && cap2 === 'duplicate', `${cap1}/${cap2}`)
await db.query(`select public.payments_finish_event('razorpay','evt_1','processed')`)
ok('a processed event is a "duplicate" on redelivery', (await one(`select public.payments_log_event('razorpay','evt_1','payment.captured','{}'::jsonb) as s`)).s === 'duplicate')
await db.query(`select public.payments_log_event('razorpay','evt_err','x','{}'::jsonb)`)
await db.query(`select public.payments_finish_event('razorpay','evt_err','error','boom')`)
ok('an errored event is retried', (await one(`select public.payments_log_event('razorpay','evt_err','x','{}'::jsonb) as s`)).s === 'retry')

const led = await all(`select entry_type, amount from public.ledger_entries order by seq`)
ok('exactly 3 ledger entries: 80 / 12 / 68', led.length === 3 && led.find((e) => e.entry_type === 'gross_captured')?.amount === '80.00' && led.find((e) => e.entry_type === 'platform_commission')?.amount === '12.00' && led.find((e) => e.entry_type === 'owner_earning')?.amount === '68.00', JSON.stringify(led))
const tx = await one(`select payment_status, settlement_status from public.rentals where id = $1`, [rental.id])
ok('rental is paid + settlement pending', tx.payment_status === 'paid' && tx.settlement_status === 'pending', JSON.stringify(tx))
ok('one settlement of 68 for the owner', (await all(`select amount from public.settlements`)).length === 1 && (await one(`select amount from public.settlements`)).amount === '68.00')

console.log('\nrefund (partial, replayed) and settlement')
await db.query(`select public.payments_mark_refund_pending($1, 40)`, [prep.payment_id])
ok('refund_pending status set', (await one(`select payment_status from public.rentals where id = $1`, [rental.id])).payment_status === 'refund_pending')
const rf1 = (await one(`select public.payments_apply_refund('razorpay','pay_RZP1','rfnd_A',40) as r`)).r
const rf1b = (await one(`select public.payments_apply_refund('razorpay','pay_RZP1','rfnd_A',40) as r`)).r
ok('refund applies once, replay is "duplicate"', rf1 === 'refunded' && rf1b === 'duplicate', `${rf1}/${rf1b}`)
const pay = await one(`select status, refunded_amount from public.payments where id = $1`, [prep.payment_id])
ok('payment partially_refunded with 40 refunded', pay.status === 'partially_refunded' && pay.refunded_amount === '40.00', JSON.stringify(pay))
ok('commission reversed pro rata (-6.00) and owner share -34.00', (await one(`select amount from public.ledger_entries where entry_type = 'commission_reversal'`)).amount === '-6.00' && (await one(`select amount from public.ledger_entries where entry_type = 'owner_earning_reversal'`)).amount === '-34.00')
ok('unsettled owner payout shrinks to 34', (await one(`select amount from public.settlements`)).amount === '34.00')
await expectErr('cannot refund more than was paid', () => db.query(`select public.payments_apply_refund('razorpay','pay_RZP1','rfnd_B',50)`), /exceeds/)

const st1 = (await one(`select public.payments_apply_settlement('razorpay','pay_RZP1','trf_1','settled') as r`)).r
const st2 = (await one(`select public.payments_apply_settlement('razorpay','pay_RZP1','trf_1','settled') as r`)).r
ok('settlement applies once, replay is "duplicate"', st1 === 'settled' && st2 === 'duplicate', `${st1}/${st2}`)
ok('exactly one payout entry of -34', (await all(`select amount from public.ledger_entries where entry_type = 'owner_payout'`)).length === 1)

console.log('\nledger is append-only')
await as(null, 'service_role')
await expectErr('UPDATE on ledger is blocked even for the service role', () => db.query(`update public.ledger_entries set amount = 1`), /append-only/)
await expectErr('DELETE on ledger is blocked', () => db.query(`delete from public.ledger_entries`), /append-only/)

console.log('\nvisibility (RLS) and reconciliation')
await as(other)
ok('a stranger sees no payments', (await all(`select 1 from public.payments`)).length === 0)
ok('a stranger sees no ledger rows', (await all(`select 1 from public.ledger_entries`)).length === 0)
ok('a stranger sees no settlements', (await all(`select 1 from public.settlements`)).length === 0)
await as(buyer)
ok('the payer sees their payment', (await all(`select 1 from public.payments`)).length === 1)
ok('the payer cannot see provider events', (await all(`select 1 from public.payment_events`)).length === 0)
await as(owner)
ok('the owner sees the payment and own settlement', (await all(`select 1 from public.payments`)).length === 1 && (await all(`select 1 from public.settlements`)).length === 1)
await expectErr('non-admin cannot run reconciliation', () => db.query(`select public.admin_reconciliation()`), /Admins only/)
await as(admin)
const rec = (await one(`select public.admin_reconciliation() as r`)).r
ok('reconciliation totals: gross 40 net of refunds, commission 6, paid out 34', Number(rec.totals.gross_captured) === 80 && Number(rec.totals.refunded) === 40 && Number(rec.totals.commission_revenue) === 6 && Number(rec.totals.owner_paid_out) === 34, JSON.stringify(rec.totals))
ok('reconciliation reports the errored provider event but nothing wrong with the money', rec.issues.length === 1 && rec.issues[0].code === 'event_error', JSON.stringify(rec.issues))
const stats = (await one(`select public.admin_stats() as s`)).s
ok('admin stats: revenue 6 (net of the refund reversal), refunded 40', Number(stats.platform_fees) === 6 && Number(stats.refunded_total) === 40 && Number(stats.gross_volume) === 40, JSON.stringify(stats))

console.log('\nsale uses the 10% rate')
await as(buyer)
// the rental is still in progress for this copy, so use a second listing
await as(owner)
const l2 = (await one(`insert into public.listings (owner_id, title, author, category, condition, listing_type, sale_price, pickup_area) values ($1,'Sapiens','Harari','Non-fiction','good','sale',250,'North') returning id`, [owner])).id
await as(buyer)
const order = await one(`select * from public.create_order($1)`, [l2])
ok('sale commission is 10% of 250 = 25', Number(order.platform_fee) === 25 && Number(order.commission_pct) === 10, JSON.stringify(order))

console.log('\nrefund AFTER the owner was settled is flagged for reversal')
await as(owner)
await db.query(`select * from public.respond_order($1, true)`, [order.id])
await as(buyer)
const prep3 = (await one(`select public.payments_prepare('order', $1) as p`, [order.id])).p
await as(null, 'service_role')
await db.query(`select public.payments_attach_provider_order($1, 'order_RZP2')`, [prep3.payment_id])
await db.query(`select public.payments_apply_capture('razorpay','order_RZP2','pay_RZP2',250,'INR','card')`)
await db.query(`select public.payments_apply_settlement('razorpay','pay_RZP2','trf_2','settled')`)
await db.query(`select public.payments_apply_refund('razorpay','pay_RZP2','rfnd_C',250)`)
await as(admin)
const rec2 = (await one(`select public.admin_reconciliation() as r`)).r
ok('owner was paid 225 but earns 0 after the full refund -> overpaid_owner warning', rec2.issues.some((i) => i.code === 'overpaid_owner' && /225/.test(i.message)), JSON.stringify(rec2.issues.map((i) => i.code + ':' + i.message)))
ok('the books still balance (no ledger_imbalance / mismatch / missing ledger)', !rec2.issues.some((i) => ['ledger_imbalance', 'payment_ledger_mismatch', 'missing_ledger'].includes(i.code)))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
