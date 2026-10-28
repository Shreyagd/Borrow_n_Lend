-- 0004: marketplace payments, commission revenue ledger and settlements.
--
-- Principles
--   * The browser can never mark anything paid. `paid` is written only by the apply_* functions below, which
--     are executable by the service role only (called from Edge Functions after provider verification).
--   * Every provider event is logged once (payment_events) and every money movement is an append-only,
--     idempotent ledger entry. Re-delivering a webhook cannot create a second capture, commission or payout.
--   * Commission rates live in admin_settings (admin-only write). Each rental/order snapshots the rate it was
--     created with, so changing the rate never alters past transactions.
--   * No manual escrow, arbitrary deductions or automatic late/damage fees exist here.

-- ───────────────────────── settings ─────────────────────────
alter table public.admin_settings
  add column rental_commission_pct numeric(5,2) not null default 15 check (rental_commission_pct between 0 and 50),
  add column sale_commission_pct   numeric(5,2) not null default 10 check (sale_commission_pct between 0 and 50),
  add column payment_provider text not null default 'manual' check (payment_provider in ('manual', 'razorpay', 'cashfree')),
  add column payments_live boolean not null default false,
  -- Only the provider's default settlement schedule is implemented. "Hold until return" would need a provider
  -- feature, approval and a disclosed process, so it is deliberately not selectable.
  add column settlement_policy text not null default 'provider_default' check (settlement_policy in ('provider_default'));
update public.admin_settings set rental_commission_pct = 15, sale_commission_pct = 10;
alter table public.admin_settings drop column commission_pct;
alter table public.admin_settings add constraint live_needs_provider check (not payments_live or payment_provider <> 'manual');

-- ───────────────────────── rentals / orders ─────────────────────────
alter table public.rentals drop constraint rentals_payment_status_check;
alter table public.orders drop constraint orders_payment_status_check;
update public.rentals set payment_status = case payment_status when 'received' then 'manual_received' else 'unpaid' end;
update public.orders set payment_status = case payment_status when 'received' then 'manual_received' else 'unpaid' end;
alter table public.rentals alter column payment_status set default 'unpaid';
alter table public.orders alter column payment_status set default 'unpaid';

alter table public.rentals
  add constraint rentals_payment_status_check check (payment_status in
    ('unpaid', 'awaiting_payment', 'paid', 'failed', 'refund_pending', 'partially_refunded', 'refunded', 'manual_received', 'demo_simulated')),
  add column commission_pct numeric(5,2) not null default 0,
  add column settlement_status text not null default 'not_due'
    check (settlement_status in ('not_due', 'pending', 'processing', 'settled', 'failed', 'reversed'));
alter table public.orders
  add constraint orders_payment_status_check check (payment_status in
    ('unpaid', 'awaiting_payment', 'paid', 'failed', 'refund_pending', 'partially_refunded', 'refunded', 'manual_received', 'demo_simulated')),
  add column commission_pct numeric(5,2) not null default 0,
  add column settlement_status text not null default 'not_due'
    check (settlement_status in ('not_due', 'pending', 'processing', 'settled', 'failed', 'reversed'));
update public.rentals set commission_pct = round(platform_fee * 100 / rental_amount, 2) where rental_amount > 0;
update public.orders set commission_pct = round(platform_fee * 100 / total_amount, 2) where total_amount > 0;

-- ───────────────────────── payments ─────────────────────────
alter table public.payments drop constraint payments_status_check;
alter table public.payments alter column status set default 'created';
alter table public.payments drop column provider_ref;
alter table public.payments
  add column tx_kind text generated always as (case when rental_id is not null then 'rental' else 'order' end) stored,
  add column provider_order_id text,
  add column provider_payment_id text,
  add column method text,
  add column owner_id uuid references public.profiles,
  add column commission_amount numeric(12,2) not null default 0,
  add column owner_net_amount numeric(12,2) not null default 0,
  add column refunded_amount numeric(12,2) not null default 0,
  add column idempotency_key text,
  add column is_demo boolean not null default false,
  add column failure_reason text,
  add column captured_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add constraint payments_status_check check (status in ('created', 'captured', 'failed', 'refund_pending', 'partially_refunded', 'refunded')),
  add constraint payments_provider_check check (provider in ('razorpay', 'cashfree', 'manual', 'demo')),
  add constraint payments_refund_bounds check (refunded_amount >= 0 and refunded_amount <= amount);
create unique index payments_provider_order_uq on public.payments (provider, provider_order_id) where provider_order_id is not null;
create unique index payments_provider_payment_uq on public.payments (provider, provider_payment_id) where provider_payment_id is not null;
create unique index payments_idem_uq on public.payments (idempotency_key) where idempotency_key is not null;
-- One live payment per transaction: prevents duplicate orders/charges for the same rental or sale.
create unique index payments_one_live_per_rental on public.payments (rental_id)
  where rental_id is not null and status in ('created', 'captured', 'refund_pending', 'partially_refunded');
create unique index payments_one_live_per_order on public.payments (order_id)
  where order_id is not null and status in ('created', 'captured', 'refund_pending', 'partially_refunded');
create index payments_payer_idx on public.payments (payer_id, created_at desc);
create index payments_owner_idx on public.payments (owner_id, created_at desc);

-- ───────────────────────── provider events (webhook log / dedupe) ─────────────────────────
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,            -- the provider's unique event id (e.g. Razorpay x-razorpay-event-id header)
  event_type text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'error')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);

-- ───────────────────────── ledger (append-only) ─────────────────────────
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  tx_kind text not null check (tx_kind in ('rental', 'order')),
  tx_id uuid not null,
  payment_id uuid references public.payments,
  entry_type text not null check (entry_type in
    ('gross_captured', 'platform_commission', 'owner_earning', 'refund_gross', 'commission_reversal', 'owner_earning_reversal', 'owner_payout')),
  user_id uuid references public.profiles,   -- payer or owner; null for the platform's own entries
  amount numeric(12,2) not null,
  currency text not null,
  is_demo boolean not null default false,
  memo text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index ledger_tx_idx on public.ledger_entries (tx_kind, tx_id);
create index ledger_payment_idx on public.ledger_entries (payment_id);
create index ledger_user_idx on public.ledger_entries (user_id, created_at desc);

create function public.ledger_immutable() returns trigger language plpgsql as $$
begin raise exception 'The ledger is append-only.'; end $$;
create trigger ledger_no_update before update or delete on public.ledger_entries
  for each row execute function public.ledger_immutable();

-- ───────────────────────── settlements & payout accounts ─────────────────────────
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  tx_kind text not null check (tx_kind in ('rental', 'order')),
  tx_id uuid not null,
  payment_id uuid not null references public.payments,
  owner_id uuid not null references public.profiles,
  amount numeric(12,2) not null,                  -- owner's net, reduced by refunds that happen before settlement
  currency text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'settled', 'failed', 'reversed')),
  provider_transfer_id text,
  is_demo boolean not null default false,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tx_kind, tx_id)
);
create index settlements_owner_idx on public.settlements (owner_id, created_at desc);

-- The owner's provider-side (linked / vendor) account. Created and KYC'd with the provider; recorded here by an admin.
create table public.payout_accounts (
  owner_id uuid primary key references public.profiles on delete cascade,
  provider text not null check (provider in ('razorpay', 'cashfree')),
  provider_account_id text,
  status text not null default 'not_started' check (status in ('not_started', 'pending', 'active', 'rejected')),
  updated_at timestamptz not null default now()
);

-- ───────────────────────── RLS ─────────────────────────
alter table public.payment_events enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.settlements enable row level security;
alter table public.payout_accounts enable row level security;

drop policy payments_read on public.payments;
create policy payments_read on public.payments for select to authenticated
  using (payer_id = auth.uid() or owner_id = auth.uid() or public.is_admin());
create policy ledger_read on public.ledger_entries for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy settlements_read on public.settlements for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());
create policy payout_accounts_read on public.payout_accounts for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());
create policy payment_events_admin on public.payment_events for select to authenticated using (public.is_admin());

revoke insert, update, delete on public.payments, public.ledger_entries, public.settlements, public.payout_accounts,
  public.payment_events from anon, authenticated;
revoke select on public.payment_events, public.ledger_entries, public.settlements, public.payout_accounts, public.payments from anon;

-- ───────────────────────── helpers ─────────────────────────
create function public.is_service_role() returns boolean language sql stable as $$
  select coalesce(auth.role(), '') = 'service_role' or session_user in ('postgres', 'supabase_admin')
$$;

create function public.ledger_add(
  p_kind text, p_tx uuid, p_payment uuid, p_type text, p_user uuid, p_amount numeric, p_currency text,
  p_demo boolean, p_key text, p_memo text default null
) returns void language sql security definer set search_path = public as $$
  insert into public.ledger_entries (tx_kind, tx_id, payment_id, entry_type, user_id, amount, currency, is_demo, idempotency_key, memo)
  values (p_kind, p_tx, p_payment, p_type, p_user, p_amount, p_currency, p_demo, p_key, p_memo)
  on conflict (idempotency_key) do nothing
$$;

create function public.set_tx_payment(p_kind text, p_tx uuid, p_payment_status text default null, p_settlement_status text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_kind = 'rental' then
    update public.rentals set payment_status = coalesce(p_payment_status, payment_status),
           settlement_status = coalesce(p_settlement_status, settlement_status) where id = p_tx;
  else
    update public.orders set payment_status = coalesce(p_payment_status, payment_status),
           settlement_status = coalesce(p_settlement_status, settlement_status) where id = p_tx;
  end if;
end $$;

-- ───────────────────────── commission-aware request functions ─────────────────────────
create or replace function public.request_rental(p_listing uuid, p_days int) returns public.rentals
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.assert_active_user();
  l public.listings; s public.admin_settings; amt numeric; r public.rentals;
begin
  if (select count(*) from public.rentals where borrower_id = uid and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many requests. Please try again later.' using errcode = '54000';
  end if;
  select * into l from public.listings where id = p_listing for update;
  if not found or l.hidden or l.status <> 'active'
     or not exists (select 1 from public.profiles where id = l.owner_id and not suspended) then
    raise exception 'This book is not available right now.';
  end if;
  if l.owner_id = uid then raise exception 'You cannot borrow your own book.'; end if;
  if l.listing_type = 'sale' or not (p_days = any (l.rental_period_options)) then
    raise exception 'That rental period is not offered for this book.';
  end if;
  if public.listing_is_busy(l.id) then raise exception 'This book is currently reserved or on loan.'; end if;

  select * into s from public.admin_settings where id = 1;
  amt := round(l.rental_price * p_days / 7.0, 2);
  begin
    insert into public.rentals (listing_id, owner_id, borrower_id, period_days, rental_amount, platform_fee, commission_pct)
    values (l.id, l.owner_id, uid, p_days, amt, round(amt * s.rental_commission_pct / 100, 2), s.rental_commission_pct)
    returning * into r;
  exception when unique_violation then
    raise exception 'You already have a pending request for this book.';
  end;
  perform public.push_notification(l.owner_id, 'rental_requested', 'New rental request',
    'Someone wants to borrow "' || l.title || '" for ' || p_days || ' days.', '/dashboard/requests');
  return r;
end $$;

create or replace function public.create_order(p_listing uuid) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.assert_active_user();
  l public.listings; s public.admin_settings; o public.orders;
begin
  if (select count(*) from public.orders where buyer_id = uid and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many requests. Please try again later.' using errcode = '54000';
  end if;
  select * into l from public.listings where id = p_listing for update;
  if not found or l.hidden or l.status <> 'active'
     or not exists (select 1 from public.profiles where id = l.owner_id and not suspended) then
    raise exception 'This book is not available right now.';
  end if;
  if l.owner_id = uid then raise exception 'You cannot buy your own book.'; end if;
  if l.listing_type = 'rent' then raise exception 'This book is not for sale.'; end if;
  if public.listing_is_busy(l.id) then raise exception 'This book is currently reserved or on loan.'; end if;
  select * into s from public.admin_settings where id = 1;
  begin
    insert into public.orders (listing_id, seller_id, buyer_id, item_price, platform_fee, commission_pct, total_amount)
    values (l.id, l.owner_id, uid, l.sale_price, round(l.sale_price * s.sale_commission_pct / 100, 2), s.sale_commission_pct, l.sale_price)
    returning * into o;
  exception when unique_violation then
    raise exception 'You already have a pending order for this book.';
  end;
  perform public.push_notification(l.owner_id, 'order_requested', 'New purchase request',
    'Someone wants to buy "' || l.title || '".', '/dashboard/requests');
  return o;
end $$;

-- ───────────────────────── manual (unverified) payment note ─────────────────────────
-- Only allowed while online payments are not live. It records an owner's claim; it is NOT revenue and is never `paid`.
create or replace function public.mark_payment_received(p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.assert_active_user(); s public.admin_settings;
begin
  select * into s from public.admin_settings where id = 1;
  if s.payments_live and s.payment_provider <> 'manual' then
    raise exception 'Online payments are enabled. Payment is confirmed automatically once the provider verifies it.';
  end if;
  if p_kind = 'rental' then
    update public.rentals set payment_status = 'manual_received'
     where id = p_id and owner_id = uid and payment_status in ('unpaid', 'failed', 'awaiting_payment')
       and status in ('accepted', 'active', 'return_requested', 'overdue', 'completed');
  elsif p_kind = 'order' then
    update public.orders set payment_status = 'manual_received'
     where id = p_id and seller_id = uid and payment_status in ('unpaid', 'failed', 'awaiting_payment')
       and status in ('accepted', 'completed');
  else
    raise exception 'Unknown transaction type.';
  end if;
  if not found then raise exception 'Transaction not found or not ready for payment confirmation.'; end if;
end $$;

-- ───────────────────────── customer: prepare a payment ─────────────────────────
-- Called by the create-payment-order Edge Function with the customer's JWT. All amounts come from the database.
create function public.payments_prepare(p_kind text, p_tx uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.assert_active_user();
  s public.admin_settings;
  pa public.payout_accounts;
  v_payer uuid; v_owner uuid; v_gross numeric; v_fee numeric; v_pay_status text; v_status text;
  pay public.payments; attempt int;
begin
  select * into s from public.admin_settings where id = 1;
  if not s.payments_live or s.payment_provider = 'manual' then
    raise exception 'Online payments are not enabled yet. Arrange payment directly with the owner.';
  end if;

  if p_kind = 'rental' then
    select borrower_id, owner_id, rental_amount, platform_fee, payment_status, status
      into v_payer, v_owner, v_gross, v_fee, v_pay_status, v_status from public.rentals where id = p_tx for update;
    if v_status is distinct from 'accepted' and v_status not in ('active', 'return_requested', 'overdue') then
      raise exception 'This rental is not ready for payment.'; end if;
  elsif p_kind = 'order' then
    select buyer_id, seller_id, total_amount, platform_fee, payment_status, status
      into v_payer, v_owner, v_gross, v_fee, v_pay_status, v_status from public.orders where id = p_tx for update;
    if v_status is distinct from 'accepted' then raise exception 'This order is not ready for payment.'; end if;
  else
    raise exception 'Unknown transaction type.';
  end if;
  if v_payer is null or v_payer <> uid then raise exception 'Transaction not found.'; end if;
  if v_pay_status not in ('unpaid', 'failed', 'awaiting_payment') then
    raise exception 'This transaction has already been paid or is being refunded.'; end if;

  select * into pa from public.payout_accounts where owner_id = v_owner and provider = s.payment_provider and status = 'active';
  if not found or pa.provider_account_id is null then
    raise exception 'The owner has not finished payout setup yet, so online payment is unavailable for this book.';
  end if;

  -- reuse the open attempt (idempotent); otherwise create a new one
  select * into pay from public.payments
   where (case when p_kind = 'rental' then rental_id else order_id end) = p_tx and status = 'created' for update;
  if not found then
    select count(*) into attempt from public.payments where (case when p_kind = 'rental' then rental_id else order_id end) = p_tx;
    insert into public.payments (rental_id, order_id, payer_id, owner_id, provider, amount, currency, commission_amount, owner_net_amount, idempotency_key)
    values (case when p_kind = 'rental' then p_tx end, case when p_kind = 'order' then p_tx end, uid, v_owner, s.payment_provider,
            v_gross, s.currency, v_fee, v_gross - v_fee, 'pay:' || p_kind || ':' || p_tx || ':' || attempt)
    returning * into pay;
  end if;

  return jsonb_build_object(
    'payment_id', pay.id, 'provider', pay.provider, 'amount', pay.amount, 'currency', pay.currency,
    'commission', pay.commission_amount, 'owner_net', pay.owner_net_amount,
    'owner_account_id', pa.provider_account_id, 'provider_order_id', pay.provider_order_id,
    'tx_kind', p_kind, 'tx_id', p_tx);
end $$;

-- ───────────────────────── service-role only: apply verified provider facts ─────────────────────────
create function public.payments_attach_provider_order(p_payment uuid, p_provider_order_id text) returns void
language plpgsql security definer set search_path = public as $$
declare pay public.payments;
begin
  if not public.is_service_role() then raise exception 'Service role only.' using errcode = '42501'; end if;
  select * into pay from public.payments where id = p_payment for update;
  if not found then raise exception 'Payment not found.'; end if;
  if pay.provider_order_id is null then
    update public.payments set provider_order_id = p_provider_order_id, updated_at = now() where id = p_payment;
  elsif pay.provider_order_id <> p_provider_order_id then
    raise exception 'Payment already linked to a different provider order.';
  end if;
  perform public.set_tx_payment(pay.tx_kind, coalesce(pay.rental_id, pay.order_id), 'awaiting_payment');
end $$;

-- Returns 'new' (process it), 'retry' (earlier attempt errored: process again) or 'duplicate' (already handled).
create function public.payments_log_event(p_provider text, p_event_id text, p_type text, p_payload jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare ev public.payment_events;
begin
  if not public.is_service_role() then raise exception 'Service role only.' using errcode = '42501'; end if;
  insert into public.payment_events (provider, event_id, event_type, payload) values (p_provider, p_event_id, p_type, p_payload)
  on conflict (provider, event_id) do nothing;
  select * into ev from public.payment_events where provider = p_provider and event_id = p_event_id for update;
  if ev.status in ('processed', 'ignored') then return 'duplicate'; end if;
  if ev.status = 'error' then return 'retry'; end if;
  return 'new';
end $$;

create function public.payments_finish_event(p_provider text, p_event_id text, p_status text, p_error text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_service_role() then raise exception 'Service role only.' using errcode = '42501'; end if;
  update public.payment_events set status = p_status, error = left(p_error, 500), processed_at = now()
   where provider = p_provider and event_id = p_event_id;
end $$;

-- A payment was captured by the provider. Idempotent: a second call changes nothing.
create function public.payments_apply_capture(
  p_provider text, p_provider_order_id text, p_provider_payment_id text, p_amount numeric, p_currency text, p_method text
) returns text language plpgsql security definer set search_path = public as $$
declare pay public.payments; v_tx uuid; t text;
begin
  if not public.is_service_role() then raise exception 'Service role only.' using errcode = '42501'; end if;
  select * into pay from public.payments where provider = p_provider and provider_order_id = p_provider_order_id for update;
  if not found then raise exception 'Unknown provider order %.', p_provider_order_id; end if;
  if pay.status in ('captured', 'refund_pending', 'partially_refunded', 'refunded') then return 'duplicate'; end if;
  if p_amount <> pay.amount or upper(p_currency) <> upper(pay.currency) then
    update public.payments set failure_reason = 'amount_mismatch', updated_at = now() where id = pay.id;
    raise exception 'Amount mismatch for payment %: provider % %, expected % %.', pay.id, p_amount, p_currency, pay.amount, pay.currency;
  end if;

  v_tx := coalesce(pay.rental_id, pay.order_id); t := pay.tx_kind;
  update public.payments set status = 'captured', provider_payment_id = p_provider_payment_id, method = p_method,
         captured_at = now(), updated_at = now() where id = pay.id;
  perform public.set_tx_payment(t, v_tx, 'paid', 'pending');

  perform public.ledger_add(t, v_tx, pay.id, 'gross_captured', pay.payer_id, pay.amount, pay.currency, pay.is_demo, 'cap:' || pay.id || ':gross');
  perform public.ledger_add(t, v_tx, pay.id, 'platform_commission', null, pay.commission_amount, pay.currency, pay.is_demo, 'cap:' || pay.id || ':commission');
  perform public.ledger_add(t, v_tx, pay.id, 'owner_earning', pay.owner_id, pay.owner_net_amount, pay.currency, pay.is_demo, 'cap:' || pay.id || ':owner');

  insert into public.settlements (tx_kind, tx_id, payment_id, owner_id, amount, currency, is_demo)
  values (t, v_tx, pay.id, pay.owner_id, pay.owner_net_amount, pay.currency, pay.is_demo)
  on conflict (tx_kind, tx_id) do nothing;

  perform public.push_notification(pay.payer_id, 'payment_received', 'Payment confirmed', 'Your payment was verified. A receipt is in your dashboard.', '/dashboard/payments');
  perform public.push_notification(pay.owner_id, 'payment_received', 'Payment received', 'The payer paid online. Your earnings are pending settlement.', '/dashboard/earnings');
  return 'captured';
end $$;

create function public.payments_apply_failure(p_provider text, p_provider_order_id text, p_reason text) returns text
language plpgsql security definer set search_path = public as $$
declare pay public.payments;
begin
  if not public.is_service_role() then raise exception 'Service role only.' using errcode = '42501'; end if;
  select * into pay from public.payments where provider = p_provider and provider_order_id = p_provider_order_id for update;
  if not found then return 'unknown'; end if;
  -- A failed attempt never overrides a captured payment, and it does not close the provider order: the customer
  -- may retry on the same order, so the payment row stays 'created' and only the reason and tx status are recorded.
  if pay.status <> 'created' then return 'ignored'; end if;
  update public.payments set failure_reason = left(p_reason, 300), updated_at = now() where id = pay.id;
  perform public.set_tx_payment(pay.tx_kind, coalesce(pay.rental_id, pay.order_id), 'failed');
  return 'failed';
end $$;

-- Admin starts a refund (via the refund-payment Edge Function). The ledger changes only when the provider confirms.
create function public.payments_mark_refund_pending(p_payment uuid, p_amount numeric) returns void
language plpgsql security definer set search_path = public as $$
declare pay public.payments;
begin
  if not public.is_service_role() then raise exception 'Service role only.' using errcode = '42501'; end if;
  select * into pay from public.payments where id = p_payment for update;
  if not found or pay.status not in ('captured', 'partially_refunded') then raise exception 'Payment cannot be refunded.'; end if;
  if p_amount <= 0 or p_amount > pay.amount - pay.refunded_amount then raise exception 'Refund amount exceeds what is refundable.'; end if;
  update public.payments set status = 'refund_pending', updated_at = now() where id = p_payment;
  perform public.set_tx_payment(pay.tx_kind, coalesce(pay.rental_id, pay.order_id), 'refund_pending');
end $$;

-- If the provider rejects the refund request, put the payment back (nothing was moved in the ledger).
create function public.payments_clear_refund_pending(p_payment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare pay public.payments;
begin
  if not public.is_service_role() then raise exception 'Service role only.' using errcode = '42501'; end if;
  select * into pay from public.payments where id = p_payment for update;
  if not found or pay.status <> 'refund_pending' then return; end if;
  update public.payments set status = case when refunded_amount > 0 then 'partially_refunded' else 'captured' end, updated_at = now() where id = p_payment;
  perform public.set_tx_payment(pay.tx_kind, coalesce(pay.rental_id, pay.order_id), case when pay.refunded_amount > 0 then 'partially_refunded' else 'paid' end);
end $$;

-- The provider confirmed a refund. Idempotent per provider refund id. Commission is reversed pro rata.
create function public.payments_apply_refund(p_provider text, p_provider_payment_id text, p_provider_refund_id text, p_amount numeric)
returns text language plpgsql security definer set search_path = public as $$
declare
  pay public.payments; v_tx uuid; t text; prev numeric; target numeric; prev_c numeric; part_c numeric; part_o numeric;
  new_refunded numeric; s public.settlements; owner_after numeric;
begin
  if not public.is_service_role() then raise exception 'Service role only.' using errcode = '42501'; end if;
  select * into pay from public.payments where provider = p_provider and provider_payment_id = p_provider_payment_id for update;
  if not found then raise exception 'Unknown provider payment %.', p_provider_payment_id; end if;
  if exists (select 1 from public.ledger_entries where idempotency_key = 'ref:' || p_provider_refund_id || ':gross') then return 'duplicate'; end if;
  if p_amount <= 0 or pay.refunded_amount + p_amount > pay.amount then raise exception 'Refund exceeds captured amount.'; end if;

  v_tx := coalesce(pay.rental_id, pay.order_id); t := pay.tx_kind;
  prev := pay.refunded_amount; new_refunded := prev + p_amount;
  target := round(new_refunded * pay.commission_amount / pay.amount, 2);
  prev_c := round(prev * pay.commission_amount / pay.amount, 2);
  part_c := target - prev_c; part_o := p_amount - part_c;

  perform public.ledger_add(t, v_tx, pay.id, 'refund_gross', pay.payer_id, -p_amount, pay.currency, pay.is_demo, 'ref:' || p_provider_refund_id || ':gross');
  perform public.ledger_add(t, v_tx, pay.id, 'commission_reversal', null, -part_c, pay.currency, pay.is_demo, 'ref:' || p_provider_refund_id || ':commission');
  perform public.ledger_add(t, v_tx, pay.id, 'owner_earning_reversal', pay.owner_id, -part_o, pay.currency, pay.is_demo, 'ref:' || p_provider_refund_id || ':owner');

  update public.payments set refunded_amount = new_refunded, updated_at = now(),
         status = case when new_refunded >= amount then 'refunded' else 'partially_refunded' end where id = pay.id;
  perform public.set_tx_payment(t, v_tx, case when new_refunded >= pay.amount then 'refunded' else 'partially_refunded' end);

  -- not yet settled: shrink (or cancel) the owner's settlement. Already settled: reconciliation flags the clawback.
  select * into s from public.settlements where tx_kind = t and tx_id = v_tx for update;
  if found and s.status in ('pending', 'processing') then
    owner_after := pay.owner_net_amount - (new_refunded - target);
    update public.settlements set amount = greatest(owner_after, 0), updated_at = now(),
           status = case when new_refunded >= pay.amount then 'reversed' else status end where id = s.id;
    if new_refunded >= pay.amount then perform public.set_tx_payment(t, v_tx, 'refunded', 'reversed'); end if;
  end if;
  perform public.push_notification(pay.payer_id, 'refund_processed', 'Refund processed', 'A refund of ' || p_amount || ' ' || pay.currency || ' was issued.', '/dashboard/payments');
  return 'refunded';
end $$;

-- Provider reports the owner transfer/settlement state for a payment. Idempotent.
create function public.payments_apply_settlement(p_provider text, p_provider_payment_id text, p_transfer_id text, p_status text) returns text
language plpgsql security definer set search_path = public as $$
declare pay public.payments; s public.settlements; v_tx uuid;
begin
  if not public.is_service_role() then raise exception 'Service role only.' using errcode = '42501'; end if;
  if p_status not in ('processing', 'settled', 'failed') then raise exception 'Invalid settlement status.'; end if;
  select * into pay from public.payments where provider = p_provider and provider_payment_id = p_provider_payment_id;
  if not found then return 'unknown'; end if;
  v_tx := coalesce(pay.rental_id, pay.order_id);
  select * into s from public.settlements where tx_kind = pay.tx_kind and tx_id = v_tx for update;
  if not found then return 'unknown'; end if;
  if s.status in ('settled', 'reversed') then return 'duplicate'; end if;

  update public.settlements set status = p_status, provider_transfer_id = coalesce(p_transfer_id, provider_transfer_id), updated_at = now(),
         settled_at = case when p_status = 'settled' then now() else settled_at end where id = s.id;
  perform public.set_tx_payment(pay.tx_kind, v_tx, null, p_status);
  if p_status = 'settled' then
    perform public.ledger_add(pay.tx_kind, v_tx, pay.id, 'owner_payout', s.owner_id, -s.amount, s.currency, s.is_demo, 'payout:' || s.id);
    perform public.push_notification(s.owner_id, 'payout_settled', 'Payout settled', 'Your earnings for a completed payment were settled.', '/dashboard/earnings');
  end if;
  return p_status;
end $$;

-- ───────────────────────── admin: payout accounts ─────────────────────────
create function public.admin_set_payout_account(p_owner uuid, p_provider text, p_account text, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  if p_status not in ('not_started', 'pending', 'active', 'rejected') then raise exception 'Invalid status.'; end if;
  if p_status = 'active' and nullif(trim(p_account), '') is null then raise exception 'An active payout account needs the provider account id.'; end if;
  insert into public.payout_accounts (owner_id, provider, provider_account_id, status)
  values (p_owner, p_provider, nullif(trim(p_account), ''), p_status)
  on conflict (owner_id) do update set provider = excluded.provider, provider_account_id = excluded.provider_account_id,
    status = excluded.status, updated_at = now();
end $$;

-- ───────────────────────── admin: reconciliation ─────────────────────────
create function public.admin_reconciliation() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  issues jsonb := '[]'::jsonb; r record;
  v_gross numeric; v_refund numeric; v_comm numeric; v_owner numeric; v_payout numeric; v_pending numeric; v_demo numeric; v_manual numeric;
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;

  -- 1. each captured payment must have a balanced ledger
  for r in
    select p.id, p.amount,
      coalesce(sum(l.amount) filter (where l.entry_type in ('gross_captured', 'refund_gross')), 0)
      - coalesce(sum(l.amount) filter (where l.entry_type in ('platform_commission', 'commission_reversal', 'owner_earning', 'owner_earning_reversal')), 0) as diff,
      count(l.id) as n
    from public.payments p left join public.ledger_entries l on l.payment_id = p.id
    where p.status in ('captured', 'refund_pending', 'partially_refunded', 'refunded')
    group by p.id, p.amount
  loop
    if r.n = 0 then issues := issues || jsonb_build_object('severity', 'error', 'code', 'missing_ledger', 'message', 'Captured payment has no ledger entries.', 'ref', r.id);
    elsif abs(r.diff) >= 0.005 then issues := issues || jsonb_build_object('severity', 'error', 'code', 'ledger_imbalance', 'message', 'Ledger is out of balance by ' || r.diff, 'ref', r.id);
    end if;
  end loop;

  -- 2. ledger gross must equal captured minus refunded on the payment row
  for r in
    select p.id, p.amount - p.refunded_amount as expected,
      coalesce(sum(l.amount) filter (where l.entry_type in ('gross_captured', 'refund_gross')), 0) as ledger
    from public.payments p left join public.ledger_entries l on l.payment_id = p.id
    where p.status in ('captured', 'refund_pending', 'partially_refunded', 'refunded') group by p.id, p.amount, p.refunded_amount
  loop
    if abs(r.expected - r.ledger) >= 0.005 then
      issues := issues || jsonb_build_object('severity', 'error', 'code', 'payment_ledger_mismatch', 'message', 'Payment net of refunds ' || r.expected || ' differs from ledger ' || r.ledger, 'ref', r.id);
    end if;
  end loop;

  -- 3. transaction payment status must agree with its payment
  for r in
    select p.id, p.status as pstatus, coalesce(rt.payment_status, ot.payment_status) as txstatus
    from public.payments p left join public.rentals rt on rt.id = p.rental_id left join public.orders ot on ot.id = p.order_id
    where p.status = 'captured' and coalesce(rt.payment_status, ot.payment_status) not in ('paid', 'refund_pending')
  loop
    issues := issues || jsonb_build_object('severity', 'error', 'code', 'tx_status_mismatch', 'message', 'Payment is captured but its transaction shows ' || r.txstatus, 'ref', r.id);
  end loop;

  -- 4. the owner was paid out more than they earned after refunds (e.g. a refund after settlement): the transfer must be reversed
  for r in
    select s.id,
      round(-coalesce(sum(l.amount) filter (where l.entry_type = 'owner_payout'), 0)
            - coalesce(sum(l.amount) filter (where l.entry_type in ('owner_earning', 'owner_earning_reversal')), 0), 2) as overpaid
    from public.settlements s join public.ledger_entries l on l.payment_id = s.payment_id
    where s.status = 'settled' and not s.is_demo
    group by s.id
  loop
    if r.overpaid >= 0.005 then
      issues := issues || jsonb_build_object('severity', 'warning', 'code', 'overpaid_owner',
        'message', 'Owner was paid ' || r.overpaid || ' more than their earnings after refunds; reverse the transfer with the provider.', 'ref', r.id);
    end if;
  end loop;

  -- 5. settlements stuck for more than 7 days
  for r in select s.id from public.settlements s where s.status in ('pending', 'processing', 'failed') and s.created_at < now() - interval '7 days' and not s.is_demo loop
    issues := issues || jsonb_build_object('severity', 'warning', 'code', 'settlement_overdue', 'message', 'Settlement has not completed after 7 days.', 'ref', r.id);
  end loop;

  -- 6. provider events that failed processing
  for r in select e.id, e.event_type, e.error from public.payment_events e where e.status = 'error' loop
    issues := issues || jsonb_build_object('severity', 'error', 'code', 'event_error', 'message', 'Provider event ' || r.event_type || ' failed: ' || coalesce(r.error, ''), 'ref', r.id);
  end loop;

  select coalesce(sum(amount) filter (where entry_type = 'gross_captured'), 0), coalesce(-sum(amount) filter (where entry_type = 'refund_gross'), 0),
         coalesce(sum(amount) filter (where entry_type in ('platform_commission', 'commission_reversal')), 0),
         coalesce(sum(amount) filter (where entry_type in ('owner_earning', 'owner_earning_reversal')), 0),
         coalesce(-sum(amount) filter (where entry_type = 'owner_payout'), 0)
    into v_gross, v_refund, v_comm, v_owner, v_payout from public.ledger_entries where not is_demo;
  select coalesce(sum(amount), 0) into v_pending from public.settlements where status in ('pending', 'processing') and not is_demo;
  select coalesce(sum(amount) filter (where entry_type = 'gross_captured'), 0) into v_demo from public.ledger_entries where is_demo;
  select coalesce(sum(platform_fee), 0) into v_manual from (
    select platform_fee from public.rentals where payment_status = 'manual_received' union all
    select platform_fee from public.orders where payment_status = 'manual_received') x;

  return jsonb_build_object(
    'generated_at', now(),
    'totals', jsonb_build_object('gross_captured', v_gross, 'refunded', v_refund, 'commission_revenue', v_comm, 'owner_earned', v_owner,
      'owner_paid_out', v_payout, 'pending_settlement', v_pending, 'demo_gross', v_demo, 'manual_commission_accrued', v_manual),
    'issues', issues);
end $$;

-- ───────────────────────── admin stats: revenue from the ledger, not from raw amounts ─────────────────────────
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'suspended_users', (select count(*) from public.profiles where suspended),
    'listings', (select count(*) from public.listings where status <> 'removed'),
    'hidden_listings', (select count(*) from public.listings where hidden),
    'rentals', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from public.rentals group by 1) x),
    'orders', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from public.orders group by 1) x),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    -- gross value of provider-verified payments net of refunds (demo entries excluded)
    'gross_volume', (select coalesce(sum(amount), 0) from public.ledger_entries where entry_type in ('gross_captured', 'refund_gross') and not is_demo),
    -- platform commission REVENUE: only money the provider actually captured, net of reversals
    'platform_fees', (select coalesce(sum(amount), 0) from public.ledger_entries where entry_type in ('platform_commission', 'commission_reversal') and not is_demo),
    'refunded_total', (select coalesce(-sum(amount), 0) from public.ledger_entries where entry_type = 'refund_gross' and not is_demo),
    'pending_settlement', (select coalesce(sum(amount), 0) from public.settlements where status in ('pending', 'processing') and not is_demo),
    'manual_commission_accrued', (select coalesce(sum(platform_fee), 0) from (
        select platform_fee from public.rentals where payment_status = 'manual_received' union all
        select platform_fee from public.orders where payment_status = 'manual_received') x)
  );
end $$;

-- ───────────────────────── grants ─────────────────────────
revoke execute on function public.payments_attach_provider_order(uuid, text), public.payments_log_event(text, text, text, jsonb),
  public.payments_finish_event(text, text, text, text), public.payments_apply_capture(text, text, text, numeric, text, text),
  public.payments_apply_failure(text, text, text), public.payments_mark_refund_pending(uuid, numeric), public.payments_clear_refund_pending(uuid),
  public.payments_apply_refund(text, text, text, numeric), public.payments_apply_settlement(text, text, text, text),
  public.ledger_add(text, uuid, uuid, text, uuid, numeric, text, boolean, text, text),
  public.set_tx_payment(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.payments_attach_provider_order(uuid, text), public.payments_log_event(text, text, text, jsonb),
  public.payments_finish_event(text, text, text, text), public.payments_apply_capture(text, text, text, numeric, text, text),
  public.payments_apply_failure(text, text, text), public.payments_mark_refund_pending(uuid, numeric), public.payments_clear_refund_pending(uuid),
  public.payments_apply_refund(text, text, text, numeric), public.payments_apply_settlement(text, text, text, text) to service_role;
revoke execute on function public.payments_prepare(text, uuid), public.admin_reconciliation(), public.admin_set_payout_account(uuid, text, text, text),
  public.mark_payment_received(text, uuid), public.admin_stats(), public.request_rental(uuid, int), public.create_order(uuid) from public, anon;
grant execute on function public.payments_prepare(text, uuid), public.admin_reconciliation(), public.admin_set_payout_account(uuid, text, text, text),
  public.mark_payment_received(text, uuid), public.admin_stats(), public.request_rental(uuid, int), public.create_order(uuid) to authenticated;
