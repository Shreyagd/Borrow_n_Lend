-- Row Level Security. Default deny: every table has RLS on; only the policies below grant access.
-- rentals / orders / payments / reviews / reports / notifications have NO client insert policies:
-- writes only happen through the SECURITY DEFINER functions in 0002.

alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.admin_settings enable row level security;
alter table public.listings enable row level security;
alter table public.listing_private enable row level security;
alter table public.rentals enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;

-- profiles: display info is public; role/suspended edits are blocked for non-admins by the guard_profile trigger.
create policy profiles_read on public.profiles for select using (true);
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create policy profile_private_read on public.profile_private for select to authenticated
  using (id = auth.uid() or public.is_admin() or public.has_active_dealing(auth.uid(), id));
create policy profile_private_write on public.profile_private for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- settings: public read (commission is shown transparently), admin write.
create policy settings_read on public.admin_settings for select using (true);
create policy settings_update on public.admin_settings for update using (public.is_admin()) with check (public.is_admin());

-- listings
create policy listings_read on public.listings for select using (
  (status <> 'removed' and not hidden
     and exists (select 1 from public.profiles p where p.id = owner_id and not p.suspended))
  or owner_id = auth.uid()
  or public.is_admin()
  or exists (select 1 from public.rentals r where r.listing_id = listings.id and r.borrower_id = auth.uid())
  or exists (select 1 from public.orders o where o.listing_id = listings.id and o.buyer_id = auth.uid())
);
create policy listings_insert on public.listings for insert to authenticated
  with check (owner_id = auth.uid() and not exists (select 1 from public.profiles where id = auth.uid() and suspended));
create policy listings_update on public.listings for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check ((owner_id = auth.uid() and not exists (select 1 from public.profiles where id = auth.uid() and suspended))
              or public.is_admin());
-- No delete policy: owners "remove" listings by setting status = 'removed' (keeps transaction history intact).

-- listing_private: exact address + handover notes.
create policy listing_private_read on public.listing_private for select to authenticated using (
  exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
  or public.is_admin()
  or exists (select 1 from public.rentals r where r.listing_id = listing_private.listing_id and r.borrower_id = auth.uid()
               and r.status in ('accepted', 'active', 'return_requested', 'overdue', 'disputed'))
  or exists (select 1 from public.orders o where o.listing_id = listing_private.listing_id and o.buyer_id = auth.uid()
               and o.status in ('accepted', 'disputed'))
);
create policy listing_private_insert on public.listing_private for insert to authenticated
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid()));
create policy listing_private_update on public.listing_private for update to authenticated
  using (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid()));

-- rentals / orders: read-only for participants and admins.
create policy rentals_read on public.rentals for select to authenticated
  using (owner_id = auth.uid() or borrower_id = auth.uid() or public.is_admin());
create policy orders_read on public.orders for select to authenticated
  using (seller_id = auth.uid() or buyer_id = auth.uid() or public.is_admin());
create policy payments_read on public.payments for select to authenticated
  using (payer_id = auth.uid() or public.is_admin());

create policy reviews_read on public.reviews for select using (true);

create policy reports_read on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

create policy notifications_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Defence in depth: strip table-level write privileges where clients must go through functions.
revoke insert, update, delete on public.rentals, public.orders, public.payments, public.reviews,
  public.reports from anon, authenticated;
revoke insert, delete on public.notifications from anon, authenticated;
revoke insert, delete on public.profiles from anon, authenticated;
revoke insert, update, delete on public.profiles, public.profile_private, public.listings, public.listing_private,
  public.admin_settings, public.notifications from anon;
revoke delete on public.listings, public.listing_private from authenticated;

-- ───────────────────────── storage: public book images ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-images', 'book-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy book_images_read on storage.objects for select using (bucket_id = 'book-images');
create policy book_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'book-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy book_images_update on storage.objects for update to authenticated
  using (bucket_id = 'book-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy book_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'book-images' and (storage.foldername(name))[1] = auth.uid()::text);
