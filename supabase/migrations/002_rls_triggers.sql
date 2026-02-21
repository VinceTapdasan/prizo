-- ============================================================
-- Indexes (idempotent)
-- ============================================================

create index if not exists idx_profiles_role on profiles(role);
create index if not exists idx_businesses_owner on businesses(owner_id);
create index if not exists idx_businesses_slug on businesses(slug);
create index if not exists idx_customers_phone on customers(phone_number);
create index if not exists idx_customers_user on customers(user_id);
create index if not exists idx_cb_customer on customer_business(customer_id);
create index if not exists idx_cb_business on customer_business(business_id);
create index if not exists idx_cb_last_spin on customer_business(business_id, last_spin_at);
create index if not exists idx_rewards_business on rewards(business_id);
create index if not exists idx_rewards_active on rewards(business_id, is_active);
create index if not exists idx_spins_customer_business on spins(customer_id, business_id);
create index if not exists idx_spins_spun_at on spins(business_id, spun_at desc);
create index if not exists idx_cr_customer on customer_rewards(customer_id);
create index if not exists idx_cr_business on customer_rewards(business_id);
create index if not exists idx_cr_status on customer_rewards(customer_id, status);
create index if not exists idx_cr_expires on customer_rewards(expires_at) where status = 'unclaimed';
create index if not exists idx_milestone_business on milestone_rewards(business_id);

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

drop trigger if exists businesses_updated_at on businesses;
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
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
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
drop policy if exists "Users can read own profile" on profiles;
create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);

-- businesses
drop policy if exists "Owners can manage their business" on businesses;
create policy "Owners can manage their business"
  on businesses for all using (auth.uid() = owner_id);

drop policy if exists "Anyone can read active business by slug" on businesses;
create policy "Anyone can read active business by slug"
  on businesses for select using (qr_active = true);

-- customers
drop policy if exists "Customers can read own record" on customers;
create policy "Customers can read own record"
  on customers for select using (auth.uid() = user_id);

drop policy if exists "Customers can insert own record" on customers;
create policy "Customers can insert own record"
  on customers for insert with check (auth.uid() = user_id);

-- customer_business
drop policy if exists "Customers can read own loyalty state" on customer_business;
create policy "Customers can read own loyalty state"
  on customer_business for select
  using (
    customer_id in (select id from customers where user_id = auth.uid())
  );

-- rewards
drop policy if exists "Business owners can manage their rewards" on rewards;
create policy "Business owners can manage their rewards"
  on rewards for all
  using (business_id in (select id from businesses where owner_id = auth.uid()));

drop policy if exists "Anyone can read active rewards" on rewards;
create policy "Anyone can read active rewards"
  on rewards for select using (is_active = true);

-- spins
drop policy if exists "Customers can read own spins" on spins;
create policy "Customers can read own spins"
  on spins for select
  using (
    customer_id in (select id from customers where user_id = auth.uid())
  );

-- customer_rewards
drop policy if exists "Customers can read own customer_rewards" on customer_rewards;
create policy "Customers can read own customer_rewards"
  on customer_rewards for select
  using (
    customer_id in (select id from customers where user_id = auth.uid())
  );

drop policy if exists "Business owners can read their customer_rewards" on customer_rewards;
create policy "Business owners can read their customer_rewards"
  on customer_rewards for select
  using (business_id in (select id from businesses where owner_id = auth.uid()));

-- milestone_rewards
drop policy if exists "Business owners can manage milestones" on milestone_rewards;
create policy "Business owners can manage milestones"
  on milestone_rewards for all
  using (business_id in (select id from businesses where owner_id = auth.uid()));

drop policy if exists "Anyone can read active milestones" on milestone_rewards;
create policy "Anyone can read active milestones"
  on milestone_rewards for select using (is_active = true);
