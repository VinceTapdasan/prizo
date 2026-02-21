-- ============================================================
-- Prizo — Initial Schema
-- Run this in Supabase SQL editor or via supabase db push
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- Enums
-- ============================================================

create type reward_tier as enum ('miss', 'common', 'uncommon', 'rare', 'epic');
create type reward_status as enum ('unclaimed', 'redeemed', 'expired');
create type user_role as enum ('business_owner', 'customer');

-- ============================================================
-- Tables
-- ============================================================

-- Profiles: extends auth.users with role info
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       user_role not null,
  created_at timestamptz not null default now()
);

-- Businesses
create table businesses (
  id              uuid primary key default uuid_generate_v4(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  slug            text not null unique,
  type            text,
  location        text,
  reset_time      time not null default '05:00:00',
  qr_active       boolean not null default true,
  points_per_scan integer not null default 10,
  pity_threshold  integer not null default 7,
  pity_min_tier   reward_tier not null default 'uncommon',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Customers: identified by phone number
create table customers (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) on delete set null,
  phone_number text not null unique,
  created_at   timestamptz not null default now()
);

-- Customer-Business state (loyalty per venue)
create table customer_business (
  id             uuid primary key default uuid_generate_v4(),
  customer_id    uuid not null references customers(id) on delete cascade,
  business_id    uuid not null references businesses(id) on delete cascade,
  loyalty_points integer not null default 0,
  pity_counter   integer not null default 0,
  last_spin_at   timestamptz,
  created_at     timestamptz not null default now(),
  unique(customer_id, business_id)
);

-- Rewards pool per business
create table rewards (
  id              uuid primary key default uuid_generate_v4(),
  business_id     uuid not null references businesses(id) on delete cascade,
  name            text not null,
  description     text,
  tier            reward_tier not null,
  probability     numeric(5, 2) not null check (probability >= 0 and probability <= 100),
  stock           integer check (stock is null or stock >= 0),
  redeemed_count  integer not null default 0,
  is_active       boolean not null default true,
  expires_in_days integer,
  created_at      timestamptz not null default now()
);

-- Spin audit log (immutable)
create table spins (
  id          uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  reward_id   uuid references rewards(id) on delete set null,
  spun_at     timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- Won rewards in customer inventory
create table customer_rewards (
  id          uuid primary key default uuid_generate_v4(),
  customer_id uuid not null references customers(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  reward_id   uuid not null references rewards(id) on delete cascade,
  spin_id     uuid not null references spins(id) on delete cascade,
  status      reward_status not null default 'unclaimed',
  redeemed_at timestamptz,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

-- Milestone rewards (auto-granted at points thresholds)
create table milestone_rewards (
  id                 uuid primary key default uuid_generate_v4(),
  business_id        uuid not null references businesses(id) on delete cascade,
  points_required    integer not null check (points_required > 0),
  reward_name        text not null,
  reward_description text,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index idx_profiles_role on profiles(role);
create index idx_businesses_owner on businesses(owner_id);
create index idx_businesses_slug on businesses(slug);
create index idx_customers_phone on customers(phone_number);
create index idx_customers_user on customers(user_id);
create index idx_cb_customer on customer_business(customer_id);
create index idx_cb_business on customer_business(business_id);
create index idx_cb_last_spin on customer_business(business_id, last_spin_at);
create index idx_rewards_business on rewards(business_id);
create index idx_rewards_active on rewards(business_id, is_active);
create index idx_spins_customer_business on spins(customer_id, business_id);
create index idx_spins_spun_at on spins(business_id, spun_at desc);
create index idx_cr_customer on customer_rewards(customer_id);
create index idx_cr_business on customer_rewards(business_id);
create index idx_cr_status on customer_rewards(customer_id, status);
create index idx_cr_expires on customer_rewards(expires_at) where status = 'unclaimed';
create index idx_milestone_business on milestone_rewards(business_id);

-- ============================================================
-- Triggers
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger businesses_updated_at
  before update on businesses
  for each row execute function update_updated_at();

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, role)
  values (
    new.id,
    coalesce((new.raw_app_meta_data->>'role')::user_role, 'customer')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table profiles enable row level security;
alter table businesses enable row level security;
alter table customers enable row level security;
alter table customer_business enable row level security;
alter table rewards enable row level security;
alter table spins enable row level security;
alter table customer_rewards enable row level security;
alter table milestone_rewards enable row level security;

-- profiles
create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);

-- businesses
create policy "Owners can manage their business"
  on businesses for all using (auth.uid() = owner_id);

create policy "Anyone can read active business by slug"
  on businesses for select using (qr_active = true);

-- customers
create policy "Customers can read own record"
  on customers for select using (auth.uid() = user_id);

create policy "Customers can insert own record"
  on customers for insert with check (auth.uid() = user_id);

-- customer_business
create policy "Customers can read own loyalty state"
  on customer_business for select
  using (
    customer_id in (select id from customers where user_id = auth.uid())
  );

-- rewards
create policy "Business owners can manage their rewards"
  on rewards for all
  using (business_id in (select id from businesses where owner_id = auth.uid()));

create policy "Anyone can read active rewards"
  on rewards for select using (is_active = true);

-- spins
create policy "Customers can read own spins"
  on spins for select
  using (
    customer_id in (select id from customers where user_id = auth.uid())
  );

-- customer_rewards
create policy "Customers can read own customer_rewards"
  on customer_rewards for select
  using (
    customer_id in (select id from customers where user_id = auth.uid())
  );

create policy "Business owners can read their customer_rewards"
  on customer_rewards for select
  using (business_id in (select id from businesses where owner_id = auth.uid()));

-- milestone_rewards
create policy "Business owners can manage milestones"
  on milestone_rewards for all
  using (business_id in (select id from businesses where owner_id = auth.uid()));

create policy "Anyone can read active milestones"
  on milestone_rewards for select using (is_active = true);
