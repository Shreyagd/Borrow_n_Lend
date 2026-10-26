-- Helpers, triggers and the server-side state machine for rentals/orders/reports.
-- Every state change is authorised against auth.uid() inside the function (never trust the client).

-- ───────────────────────── helpers ─────────────────────────
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' and not suspended from public.profiles where id = auth.uid()), false)
$$;

-- True for admins and for trusted server contexts (SQL editor / service role), never for API users.
create function public.is_privileged() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or session_user in ('postgres', 'supabase_admin')
      or coalesce(auth.role(), '') = 'service_role'
$$;

create function public.assert_active_user() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Please sign in first.' using errcode = '28000'; end if;
  if exists (select 1 from public.profiles where id = uid and suspended) then
    raise exception 'Your account is suspended. Please contact support.' using errcode = '42501';
  end if;
  return uid;
end $$;

create function public.push_notification(p_user uuid, p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body, link) values (p_user, p_type, p_title, p_body, p_link)
$$;

-- A listing is "busy" if a rental is in progress or an order is reserved/sold.
create function public.listing_is_busy(p_listing uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.rentals where listing_id = p_listing
                   and status in ('accepted', 'active', 'return_requested', 'overdue', 'disputed'))
      or exists (select 1 from public.orders where listing_id = p_listing
                   and status in ('accepted', 'completed', 'disputed'))
$$;

create function public.sync_listing_availability(p_listing uuid) returns void
language plpgsql security definer set search_path = public as $$
declare busy boolean := public.listing_is_busy(p_listing);
begin
  if busy then
    update public.listings set status = 'unavailable' where id = p_listing and status = 'active';
  else
    update public.listings set status = 'active' where id = p_listing and status = 'unavailable';
  end if;
end $$;

create function public.has_active_dealing(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.rentals r
                  where r.status in ('accepted', 'active', 'return_requested', 'overdue', 'disputed')
                    and ((r.owner_id = a and r.borrower_id = b) or (r.owner_id = b and r.borrower_id = a)))
      or exists (select 1 from public.orders o
                  where o.status in ('accepted', 'disputed')
                    and ((o.seller_id = a and o.buyer_id = b) or (o.seller_id = b and o.buyer_id = a)))
$$;

-- ───────────────────────── triggers ─────────────────────────
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
                                nullif(split_part(new.email, '@', 1), ''), 'Reader'), 60));
  insert into public.profile_private (id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.guard_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_privileged() then
    new.role := old.role;
    new.suspended := old.suspended;
  end if;
  if new.id = auth.uid() and new.suspended and not old.suspended then
    raise exception 'Admins cannot suspend themselves.';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile();

create function public.guard_listing() returns trigger
language plpgsql security definer set search_path = public as $$
declare in_progress boolean;
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    if not public.is_privileged() then
      new.hidden := false;
      new.flagged := false;
      if new.status not in ('active', 'paused') then new.status := 'active'; end if;
      if (select count(*) from public.listings
           where owner_id = new.owner_id and created_at > now() - interval '24 hours') >= 20 then
        raise exception 'Daily listing limit reached. Please try again tomorrow.' using errcode = '54000';
      end if;
    end if;
    return new;
  end if;

  if not public.is_privileged() then
    new.hidden := old.hidden;
    new.flagged := old.flagged;
    new.owner_id := old.owner_id;
    new.created_at := old.created_at;
  end if;

  if new.status = 'removed' and old.status <> 'removed' then
    select exists (select 1 from public.rentals where listing_id = new.id
                     and status in ('accepted', 'active', 'return_requested', 'overdue', 'disputed'))
        or exists (select 1 from public.orders where listing_id = new.id and status in ('accepted', 'disputed'))
      into in_progress;
    if in_progress then
      raise exception 'Finish or cancel the current rental/order before removing this listing.';
    end if;
    update public.rentals set status = 'declined', decline_reason = 'Listing was removed'
      where listing_id = new.id and status = 'requested';
    update public.orders set status = 'declined', decline_reason = 'Listing was removed'
      where listing_id = new.id and status = 'requested';
  elsif new.status = 'active' and public.listing_is_busy(new.id) then
    new.status := 'unavailable';
  elsif new.status = 'unavailable' and not public.listing_is_busy(new.id) and not public.is_privileged() then
    new.status := 'paused';
  end if;
  return new;
end $$;
create trigger listings_guard before insert or update on public.listings
  for each row execute function public.guard_listing();

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger rentals_touch before update on public.rentals for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

-- ───────────────────────── rentals ─────────────────────────
create function public.request_rental(p_listing uuid, p_days int) returns public.rentals
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
    insert into public.rentals (listing_id, owner_id, borrower_id, period_days, rental_amount, platform_fee)
    values (l.id, l.owner_id, uid, p_days, amt, round(amt * s.commission_pct / 100, 2))
    returning * into r;
  exception when unique_violation then
    raise exception 'You already have a pending request for this book.';
  end;
  perform public.push_notification(l.owner_id, 'rental_requested', 'New rental request',
    'Someone wants to borrow "' || l.title || '" for ' || p_days || ' days.', '/dashboard/requests');
  return r;
end $$;

-- Lock order everywhere: listing first, then the rental/order row.
create function public.respond_rental(p_id uuid, p_accept boolean, p_reason text default null)
returns public.rentals language plpgsql security definer set search_path = public as $$
declare uid uuid := public.assert_active_user(); lid uuid; l public.listings; r public.rentals; other record;
begin
  select listing_id into lid from public.rentals where id = p_id;
  select * into l from public.listings where id = lid for update;
  select * into r from public.rentals where id = p_id for update;
  if not found or r.owner_id <> uid then raise exception 'Request not found.'; end if;
  if r.status <> 'requested' then raise exception 'This request was already answered or cancelled.'; end if;

  if p_accept then
    if l.status <> 'active' or l.hidden or public.listing_is_busy(l.id) then
      raise exception 'This book is no longer available to lend.';
    end if;
    update public.rentals set status = 'accepted' where id = r.id returning * into r;
    for other in select id, borrower_id from public.rentals
                  where listing_id = l.id and status = 'requested' and id <> r.id loop
      update public.rentals set status = 'declined', decline_reason = 'The owner accepted another request'
        where id = other.id;
      perform public.push_notification(other.borrower_id, 'rental_declined', 'Request declined',
        '"' || l.title || '" was lent to someone else.', '/dashboard/borrowings');
    end loop;
    perform public.sync_listing_availability(l.id);
    perform public.push_notification(r.borrower_id, 'rental_accepted', 'Request accepted',
      'Your request for "' || l.title || '" was accepted. See handover details.', '/dashboard/borrowings');
  else
    update public.rentals set status = 'declined', decline_reason = left(nullif(trim(p_reason), ''), 300)
      where id = r.id returning * into r;
    perform public.push_notification(r.borrower_id, 'rental_declined', 'Request declined',
      'Your request for "' || l.title || '" was declined.', '/dashboard/borrowings');
  end if;
  return r;
end $$;

create function public.cancel_rental(p_id uuid) returns public.rentals
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.assert_active_user(); lid uuid; r public.rentals; other uuid;
begin
  select listing_id into lid from public.rentals where id = p_id;
  perform 1 from public.listings where id = lid for update;
  select * into r from public.rentals where id = p_id for update;
  if not found or uid not in (r.owner_id, r.borrower_id) then raise exception 'Rental not found.'; end if;
  if not (r.status = 'requested' and uid = r.borrower_id)
     and not (r.status = 'accepted') then
    raise exception 'This rental can no longer be cancelled. Open a dispute if there is a problem.';
  end if;
  update public.rentals set status = 'cancelled' where id = r.id returning * into r;
  perform public.sync_listing_availability(r.listing_id);
  other := case when uid = r.owner_id then r.borrower_id else r.owner_id end;
  perform public.push_notification(other, 'rental_cancelled', 'Rental cancelled', 'A rental was cancelled.', '/dashboard');
  return r;
end $$;

create function public.confirm_handover_rental(p_id uuid) returns public.rentals
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.assert_active_user(); lid uuid; r public.rentals; other uuid;
begin
  select listing_id into lid from public.rentals where id = p_id;
  perform 1 from public.listings where id = lid for update;
  select * into r from public.rentals where id = p_id for update;
  if not found or uid not in (r.owner_id, r.borrower_id) then raise exception 'Rental not found.'; end if;
  if r.status <> 'accepted' then raise exception 'Handover can only be confirmed on an accepted rental.'; end if;
  if uid = r.owner_id then
    update public.rentals set owner_handover_confirmed_at = coalesce(owner_handover_confirmed_at, now())
      where id = r.id returning * into r;
  else
    update public.rentals set borrower_handover_confirmed_at = coalesce(borrower_handover_confirmed_at, now())
      where id = r.id returning * into r;
  end if;
  if r.owner_handover_confirmed_at is not null and r.borrower_handover_confirmed_at is not null then
    update public.rentals set status = 'active', start_date = current_date, due_date = current_date + r.period_days
      where id = r.id returning * into r;
  end if;
  other := case when uid = r.owner_id then r.borrower_id else r.owner_id end;
  perform public.push_notification(other, 'handover_confirmed', 'Handover confirmed',
    case when r.status = 'active' then 'Rental started. Due ' || r.due_date else 'The other party confirmed the handover. Please confirm yours.' end,
    '/dashboard');
  return r;
end $$;

create function public.request_return(p_id uuid) returns public.rentals
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.assert_active_user(); r public.rentals;
begin
  select * into r from public.rentals where id = p_id for update;
  if not found or r.borrower_id <> uid then raise exception 'Rental not found.'; end if;
  if r.status not in ('active', 'overdue') then raise exception 'Only an active rental can be returned.'; end if;
  update public.rentals set status = 'return_requested', return_requested_at = now() where id = r.id returning * into r;
  perform public.push_notification(r.owner_id, 'return_requested', 'Return requested',
    'The borrower says the book is on its way back. Confirm when you have it.', '/dashboard/requests');
  return r;
end $$;

create function public.confirm_return(p_id uuid) returns public.rentals
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.assert_active_user(); lid uuid; r public.rentals;
begin
  select listing_id into lid from public.rentals where id = p_id;
  perform 1 from public.listings where id = lid for update;
  select * into r from public.rentals where id = p_id for update;
  if not found or r.owner_id <> uid then raise exception 'Rental not found.'; end if;
  if r.status not in ('active', 'overdue', 'return_requested') then
    raise exception 'This rental is not currently out on loan.';
  end if;
  update public.rentals set status = 'completed', return_confirmed_at = now() where id = r.id returning * into r;
  perform public.sync_listing_availability(r.listing_id);
  perform public.push_notification(r.borrower_id, 'rental_completed', 'Rental completed',
    'The owner confirmed the return. Thanks for borrowing!', '/dashboard/borrowings');
  return r;
end $$;

-- Idempotent; call from the app on dashboard load, or schedule with pg_cron (see README).
create function public.mark_overdue() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null and not public.is_privileged() then raise exception 'Please sign in first.'; end if;
  with u as (
    update public.rentals set status = 'overdue'
     where status = 'active' and due_date < current_date returning id, borrower_id, owner_id)
  select count(*) into n from u;
  return n;
end $$;

-- ───────────────────────── orders ─────────────────────────
create function public.create_order(p_listing uuid) returns public.orders
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
    insert into public.orders (listing_id, seller_id, buyer_id, item_price, platform_fee, total_amount)
    values (l.id, l.owner_id, uid, l.sale_price, round(l.sale_price * s.commission_pct / 100, 2), l.sale_price)
    returning * into o;
  exception when unique_violation then
    raise exception 'You already have a pending order for this book.';
  end;
  perform public.push_notification(l.owner_id, 'order_requested', 'New purchase request',
    'Someone wants to buy "' || l.title || '".', '/dashboard/requests');
  return o;
end $$;

create function public.respond_order(p_id uuid, p_accept boolean, p_reason text default null)
returns public.orders language plpgsql security definer set search_path = public as $$
declare uid uuid := public.assert_active_user(); lid uuid; l public.listings; o public.orders; other record;
begin
  select listing_id into lid from public.orders where id = p_id;
  select * into l from public.listings where id = lid for update;
  select * into o from public.orders where id = p_id for update;
  if not found or o.seller_id <> uid then raise exception 'Order not found.'; end if;
  if o.status <> 'requested' then raise exception 'This order was already answered or cancelled.'; end if;
  if p_accept then
    if l.status <> 'active' or l.hidden or public.listing_is_busy(l.id) then
      raise exception 'This book is no longer available to sell.';
    end if;
    update public.orders set status = 'accepted' where id = o.id returning * into o;
    for other in select id, buyer_id from public.orders
                  where listing_id = l.id and status = 'requested' and id <> o.id loop
      update public.orders set status = 'declined', decline_reason = 'The seller accepted another order' where id = other.id;
      perform public.push_notification(other.buyer_id, 'order_declined', 'Order declined',
        '"' || l.title || '" was sold to someone else.', '/dashboard/purchases');
    end loop;
    perform public.sync_listing_availability(l.id);
    perform public.push_notification(o.buyer_id, 'order_accepted', 'Order accepted',
      'Your order for "' || l.title || '" was accepted. See handover details.', '/dashboard/purchases');
  else
    update public.orders set status = 'declined', decline_reason = left(nullif(trim(p_reason), ''), 300)
      where id = o.id returning * into o;
    perform public.push_notification(o.buyer_id, 'order_declined', 'Order declined',
      'Your order for "' || l.title || '" was declined.', '/dashboard/purchases');
  end if;
  return o;
end $$;

create function public.cancel_order(p_id uuid) returns public.orders
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.assert_active_user(); lid uuid; o public.orders; other uuid;
begin
  select listing_id into lid from public.orders where id = p_id;
  perform 1 from public.listings where id = lid for update;
  select * into o from public.orders where id = p_id for update;
  if not found or uid not in (o.seller_id, o.buyer_id) then raise exception 'Order not found.'; end if;
  if not (o.status = 'requested' and uid = o.buyer_id) and o.status <> 'accepted' then
    raise exception 'This order can no longer be cancelled. Open a dispute if there is a problem.';
  end if;
  update public.orders set status = 'cancelled' where id = o.id returning * into o;
  perform public.sync_listing_availability(o.listing_id);
  other := case when uid = o.seller_id then o.buyer_id else o.seller_id end;
  perform public.push_notification(other, 'order_cancelled', 'Order cancelled', 'An order was cancelled.', '/dashboard');
  return o;
end $$;

create function public.confirm_handover_order(p_id uuid) returns public.orders
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.assert_active_user(); lid uuid; o public.orders; other uuid;
begin
  select listing_id into lid from public.orders where id = p_id;
  perform 1 from public.listings where id = lid for update;
  select * into o from public.orders where id = p_id for update;
  if not found or uid not in (o.seller_id, o.buyer_id) then raise exception 'Order not found.'; end if;
  if o.status <> 'accepted' then raise exception 'Handover can only be confirmed on an accepted order.'; end if;
  if uid = o.seller_id then
    update public.orders set seller_confirmed_at = coalesce(seller_confirmed_at, now()) where id = o.id returning * into o;
  else
    update public.orders set buyer_confirmed_at = coalesce(buyer_confirmed_at, now()) where id = o.id returning * into o;
  end if;
  if o.seller_confirmed_at is not null and o.buyer_confirmed_at is not null then
    update public.orders set status = 'completed' where id = o.id returning * into o;
    perform public.sync_listing_availability(o.listing_id);
  end if;
  other := case when uid = o.seller_id then o.buyer_id else o.seller_id end;
  perform public.push_notification(other, 'order_handover', 'Handover confirmed',
    case when o.status = 'completed' then 'The purchase is complete.' else 'The other party confirmed the handover. Please confirm yours.' end,
    '/dashboard');
  return o;
end $$;

-- ───────────────────────── payments (manual) ─────────────────────────
-- MVP has no payment processor. The owner/seller can record that they received payment arranged off-platform.
create function public.mark_payment_received(p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.assert_active_user();
begin
  if p_kind = 'rental' then
    update public.rentals set payment_status = 'received'
     where id = p_id and owner_id = uid and status in ('accepted', 'active', 'return_requested', 'overdue', 'completed');
  elsif p_kind = 'order' then
    update public.orders set payment_status = 'received'
     where id = p_id and seller_id = uid and status in ('accepted', 'completed');
  else
    raise exception 'Unknown transaction type.';
  end if;
  if not found then raise exception 'Transaction not found or not ready for payment confirmation.'; end if;
end $$;

-- ───────────────────────── reviews ─────────────────────────
create function public.submit_review(p_kind text, p_id uuid, p_rating int, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := public.assert_active_user(); a uuid; b uuid; st text;
begin
  if p_rating not between 1 and 5 then raise exception 'Rating must be 1 to 5.'; end if;
  if p_kind = 'rental' then
    select owner_id, borrower_id, status into a, b, st from public.rentals where id = p_id;
  elsif p_kind = 'order' then
    select seller_id, buyer_id, status into a, b, st from public.orders where id = p_id;
  else raise exception 'Unknown transaction type.'; end if;
  if st is distinct from 'completed' or uid not in (a, b) then
    raise exception 'You can only review completed transactions you took part in.';
  end if;
  begin
    insert into public.reviews (rental_id, order_id, reviewer_id, reviewee_id, rating, comment)
    values (case when p_kind = 'rental' then p_id end, case when p_kind = 'order' then p_id end,
            uid, case when uid = a then b else a end, p_rating, left(nullif(trim(p_comment), ''), 500));
  exception when unique_violation then
    raise exception 'You already reviewed this transaction.';
  end;
end $$;

-- ───────────────────────── reports & disputes ─────────────────────────
create function public.create_report(p_target_type text, p_target_id uuid, p_kind text, p_reason text, p_details text default null)
returns public.reports language plpgsql security definer set search_path = public as $$
declare uid uuid := public.assert_active_user(); rep public.reports; r public.rentals; o public.orders; adm uuid; lid uuid;
begin
  if nullif(trim(p_reason), '') is null then raise exception 'Please choose a reason.'; end if;
  if (select count(*) from public.reports where reporter_id = uid and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many reports. Please try again later.' using errcode = '54000';
  end if;

  if p_target_type = 'listing' then
    if not exists (select 1 from public.listings where id = p_target_id) then raise exception 'Listing not found.'; end if;
    if exists (select 1 from public.listings where id = p_target_id and owner_id = uid) then
      raise exception 'You cannot report your own listing.'; end if;
  elsif p_target_type = 'user' then
    if not exists (select 1 from public.profiles where id = p_target_id) then raise exception 'User not found.'; end if;
    if p_target_id = uid then raise exception 'You cannot report yourself.'; end if;
  elsif p_target_type = 'rental' then
    select listing_id into lid from public.rentals where id = p_target_id;
    perform 1 from public.listings where id = lid for update;
    select * into r from public.rentals where id = p_target_id for update;
    if not found or uid not in (r.owner_id, r.borrower_id) then raise exception 'Rental not found.'; end if;
    if p_kind = 'dispute' then
      if r.status not in ('active', 'return_requested', 'overdue') then
        raise exception 'A dispute can only be opened on a rental that is in progress.'; end if;
      update public.rentals set status = 'disputed' where id = r.id;
    end if;
  elsif p_target_type = 'order' then
    select listing_id into lid from public.orders where id = p_target_id;
    perform 1 from public.listings where id = lid for update;
    select * into o from public.orders where id = p_target_id for update;
    if not found or uid not in (o.seller_id, o.buyer_id) then raise exception 'Order not found.'; end if;
    if p_kind = 'dispute' then
      if o.status <> 'accepted' then raise exception 'A dispute can only be opened on an accepted order.'; end if;
      update public.orders set status = 'disputed' where id = o.id;
    end if;
  else
    raise exception 'Unknown report target.';
  end if;
  if p_kind = 'dispute' and p_target_type not in ('rental', 'order') then
    raise exception 'Disputes apply to rentals and orders.';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, kind, reason, details)
  values (uid, p_target_type, p_target_id, p_kind, left(trim(p_reason), 100), left(nullif(trim(p_details), ''), 1000))
  returning * into rep;
  for adm in select id from public.profiles where role = 'admin' and not suspended loop
    perform public.push_notification(adm, 'report', case when p_kind = 'dispute' then 'New dispute' else 'New report' end,
      left(trim(p_reason), 100), '/admin/reports');
  end loop;
  return rep;
end $$;

create function public.resolve_report(p_id uuid, p_status text, p_note text default null, p_outcome text default null)
returns public.reports language plpgsql security definer set search_path = public as $$
declare rep public.reports; r public.rentals; o public.orders; lid uuid;
begin
  if not public.is_admin() then raise exception 'Admins only.' using errcode = '42501'; end if;
  if p_status not in ('resolved', 'dismissed') then raise exception 'Invalid status.'; end if;
  select * into rep from public.reports where id = p_id for update;
  if not found or rep.status <> 'open' then raise exception 'Report not found or already closed.'; end if;

  if rep.kind = 'dispute' then
    if rep.target_type = 'rental' then
      select listing_id into lid from public.rentals where id = rep.target_id;
      perform 1 from public.listings where id = lid for update;
      select * into r from public.rentals where id = rep.target_id for update;
      if r.status = 'disputed' then
        if p_outcome not in ('active', 'completed', 'cancelled') then
          raise exception 'Choose an outcome for the disputed rental (active, completed or cancelled).'; end if;
        update public.rentals set status = p_outcome,
               return_confirmed_at = case when p_outcome = 'completed' then now() else return_confirmed_at end
         where id = r.id;
        perform public.sync_listing_availability(r.listing_id);
        perform public.push_notification(r.owner_id, 'dispute_resolved', 'Dispute resolved', 'Outcome: ' || p_outcome, '/dashboard');
        perform public.push_notification(r.borrower_id, 'dispute_resolved', 'Dispute resolved', 'Outcome: ' || p_outcome, '/dashboard');
      end if;
    elsif rep.target_type = 'order' then
      select listing_id into lid from public.orders where id = rep.target_id;
      perform 1 from public.listings where id = lid for update;
      select * into o from public.orders where id = rep.target_id for update;
      if o.status = 'disputed' then
        if p_outcome not in ('accepted', 'completed', 'cancelled') then
          raise exception 'Choose an outcome for the disputed order (accepted, completed or cancelled).'; end if;
        update public.orders set status = p_outcome where id = o.id;
        perform public.sync_listing_availability(o.listing_id);
        perform public.push_notification(o.seller_id, 'dispute_resolved', 'Dispute resolved', 'Outcome: ' || p_outcome, '/dashboard');
        perform public.push_notification(o.buyer_id, 'dispute_resolved', 'Dispute resolved', 'Outcome: ' || p_outcome, '/dashboard');
      end if;
    end if;
  end if;

  update public.reports set status = p_status, resolution_note = left(nullif(trim(p_note), ''), 500)
   where id = p_id returning * into rep;
  return rep;
end $$;

-- ───────────────────────── admin metrics ─────────────────────────
create function public.admin_stats() returns jsonb
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
    'gross_volume', (select coalesce(sum(rental_amount), 0) from public.rentals where status = 'completed')
                  + (select coalesce(sum(total_amount), 0) from public.orders where status = 'completed'),
    'platform_fees', (select coalesce(sum(platform_fee), 0) from public.rentals where status = 'completed')
                   + (select coalesce(sum(platform_fee), 0) from public.orders where status = 'completed')
  );
end $$;

-- ───────────────────────── execute grants ─────────────────────────
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
-- RLS policies call these for anonymous visitors too:
grant execute on function public.is_admin(), public.is_privileged() to anon;
-- Internal helpers must not be callable by API users directly:
revoke execute on function public.push_notification(uuid, text, text, text, text) from authenticated;
revoke execute on function public.sync_listing_availability(uuid) from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.guard_profile() from authenticated;
revoke execute on function public.guard_listing() from authenticated;
