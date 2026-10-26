-- BorrowLend schema. Run in order: 0001 (tables) -> 0002 (functions/triggers) -> 0003 (RLS + storage).
-- All marketplace state transitions happen in SECURITY DEFINER functions (0002); clients never write
-- rentals/orders/payments directly.

create extension if not exists pg_trgm with schema extensions;

-- ───────────────────────── profiles ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url text,
  city text check (char_length(city) <= 80),
  role text not null default 'user' check (role in ('user', 'admin')),
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);

-- Private contact details: visible only to the user, admins, and a counterparty with an accepted deal.
create table public.profile_private (
  id uuid primary key references public.profiles on delete cascade,
  phone text check (char_length(phone) <= 20)
);

-- ───────────────────────── settings ─────────────────────────
create table public.admin_settings (
  id int primary key default 1 check (id = 1),
  commission_pct numeric(5,2) not null default 10 check (commission_pct between 0 and 50), -- DEV ASSUMPTION
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  launch_city text not null default 'Your launch city' check (char_length(launch_city) <= 80),
  updated_at timestamptz not null default now()
);
insert into public.admin_settings (id) values (1);

-- ───────────────────────── listings ─────────────────────────
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  author text not null check (char_length(author) between 1 and 120),
  isbn text check (isbn ~ '^[0-9Xx-]{10,17}$'),
  category text not null check (char_length(category) between 1 and 60),
  description text check (char_length(description) <= 2000),
  condition text not null check (condition in ('new', 'like_new', 'good', 'acceptable')),
  image_urls text[] not null default '{}' check (cardinality(image_urls) <= 5),
  listing_type text not null check (listing_type in ('rent', 'sale', 'both')),
  rental_price numeric(10,2) check (rental_price > 0),            -- price per 7 days
  rental_period_options int[] not null default '{}' check (rental_period_options <@ array[7, 14, 21, 30]),
  sale_price numeric(10,2) check (sale_price > 0),
  pickup_area text not null check (char_length(pickup_area) between 2 and 100), -- public, coarse area only
  status text not null default 'active' check (status in ('active', 'paused', 'unavailable', 'removed')),
  hidden boolean not null default false,   -- admin moderation
  flagged boolean not null default false,  -- admin moderation
  display_price numeric generated always as (least(rental_price, sale_price)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rent_fields check (listing_type = 'sale' or (rental_price is not null and cardinality(rental_period_options) > 0)),
  constraint sale_fields check (listing_type = 'rent' or sale_price is not null),
  constraint rent_only_clean check (listing_type <> 'rent' or sale_price is null),
  constraint sale_only_clean check (listing_type <> 'sale' or (rental_price is null and cardinality(rental_period_options) = 0))
);
create index listings_browse_idx on public.listings (status, created_at desc);
create index listings_owner_idx on public.listings (owner_id);
create index listings_category_idx on public.listings (category);
create index listings_price_idx on public.listings (display_price);
create index listings_title_trgm on public.listings using gin (title extensions.gin_trgm_ops);
create index listings_author_trgm on public.listings using gin (author extensions.gin_trgm_ops);

-- Exact address / handover notes: never public.
create table public.listing_private (
  listing_id uuid primary key references public.listings on delete cascade,
  exact_address text check (char_length(exact_address) <= 300),
  handover_notes text check (char_length(handover_notes) <= 500)
);

-- ───────────────────────── rentals ─────────────────────────
create table public.rentals (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings on delete restrict,
  owner_id uuid not null references public.profiles,
  borrower_id uuid not null references public.profiles,
  period_days int not null check (period_days in (7, 14, 21, 30)),
  start_date date,
  due_date date,
  rental_amount numeric(10,2) not null check (rental_amount > 0),
  platform_fee numeric(10,2) not null default 0,       -- snapshot of commission; deducted from owner earnings
  deposit_amount numeric(10,2) not null default 0,     -- NOT collected in MVP (no compliant process)
  status text not null default 'requested' check (status in
    ('requested', 'accepted', 'declined', 'cancelled', 'active', 'return_requested', 'completed', 'overdue', 'disputed')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'received')),
  decline_reason text check (char_length(decline_reason) <= 300),
  owner_handover_confirmed_at timestamptz,
  borrower_handover_confirmed_at timestamptz,
  return_requested_at timestamptz,
  return_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (owner_id <> borrower_id)
);
-- DB-level guarantee: one physical copy can have only one in-progress rental.
create unique index rentals_one_blocking_per_listing on public.rentals (listing_id)
  where status in ('accepted', 'active', 'return_requested', 'overdue', 'disputed');
create unique index rentals_one_pending_per_borrower on public.rentals (listing_id, borrower_id)
  where status = 'requested';
create index rentals_owner_idx on public.rentals (owner_id, created_at desc);
create index rentals_borrower_idx on public.rentals (borrower_id, created_at desc);

-- ───────────────────────── orders ─────────────────────────
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings on delete restrict,
  seller_id uuid not null references public.profiles,
  buyer_id uuid not null references public.profiles,
  item_price numeric(10,2) not null check (item_price > 0),
  platform_fee numeric(10,2) not null default 0,       -- deducted from seller earnings
  delivery_fee numeric(10,2) not null default 0,       -- delivery not built in MVP
  total_amount numeric(10,2) not null,                 -- what the buyer pays
  status text not null default 'requested' check (status in
    ('requested', 'accepted', 'declined', 'cancelled', 'completed', 'disputed')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'received')),
  handover_method text not null default 'local_pickup' check (handover_method in ('local_pickup')),
  decline_reason text check (char_length(decline_reason) <= 300),
  seller_confirmed_at timestamptz,
  buyer_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (seller_id <> buyer_id)
);
-- One copy: only one accepted/completed/disputed order per listing.
create unique index orders_one_blocking_per_listing on public.orders (listing_id)
  where status in ('accepted', 'completed', 'disputed');
create unique index orders_one_pending_per_buyer on public.orders (listing_id, buyer_id)
  where status = 'requested';
create index orders_seller_idx on public.orders (seller_id, created_at desc);
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);

-- ───────────────────────── payments (provider references only) ─────────────────────────
-- Unused until a real provider is onboarded. Never store card data here.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid references public.rentals,
  order_id uuid references public.orders,
  payer_id uuid not null references public.profiles,
  provider text not null,
  provider_ref text,
  amount numeric(10,2) not null,
  currency text not null,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  check ((rental_id is null) <> (order_id is null))
);

-- ───────────────────────── reviews ─────────────────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid references public.rentals,
  order_id uuid references public.orders,
  reviewer_id uuid not null references public.profiles,
  reviewee_id uuid not null references public.profiles,
  rating int not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  check ((rental_id is null) <> (order_id is null)),
  unique (rental_id, reviewer_id),
  unique (order_id, reviewer_id)
);
create index reviews_reviewee_idx on public.reviews (reviewee_id);

-- ───────────────────────── reports / disputes ─────────────────────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles,
  target_type text not null check (target_type in ('listing', 'user', 'rental', 'order')),
  target_id uuid not null,
  kind text not null default 'report' check (kind in ('report', 'dispute')),
  reason text not null check (char_length(reason) between 1 and 100),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution_note text check (char_length(resolution_note) <= 500),
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at desc);

-- ───────────────────────── notifications ─────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
