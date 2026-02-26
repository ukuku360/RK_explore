-- Marketplace Phase 2: transactions, ratings, and report target expansion

do $$
begin
  if to_regclass('public.post_reports') is not null then
    execute 'alter table public.post_reports add column if not exists marketplace_post_id uuid null';

    if to_regclass('public.marketplace_posts') is not null then
      begin
        execute 'alter table public.post_reports add constraint post_reports_marketplace_post_id_fkey foreign key (marketplace_post_id) references public.marketplace_posts(id) on delete cascade';
      exception
        when duplicate_object then
          null;
      end;
    end if;

    begin
      execute 'alter table public.post_reports drop constraint if exists post_reports_target_type_check';
      execute
        'alter table public.post_reports add constraint post_reports_target_type_check check (target_type is null or target_type in (''feed'', ''community'', ''marketplace''))';
    exception
      when others then
        null;
    end;
  end if;
end
$$;

drop policy if exists "Users can update their own marketplace posts" on public.marketplace_posts;
drop policy if exists "Users or admins can update marketplace posts" on public.marketplace_posts;
create policy "Users or admins can update marketplace posts"
  on public.marketplace_posts for update
  using (auth.uid() = seller_user_id or public.is_admin())
  with check (auth.uid() = seller_user_id or public.is_admin());

drop policy if exists "Users can delete their own marketplace posts" on public.marketplace_posts;
drop policy if exists "Users or admins can delete marketplace posts" on public.marketplace_posts;
create policy "Users or admins can delete marketplace posts"
  on public.marketplace_posts for delete
  using (auth.uid() = seller_user_id or public.is_admin());

create table if not exists public.marketplace_transactions (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.marketplace_posts(id) on delete cascade not null,
  seller_user_id uuid references auth.users(id) on delete cascade not null,
  buyer_user_id uuid references auth.users(id) on delete cascade not null,
  accepted_bid_id uuid references public.marketplace_bids(id) on delete cascade not null,
  accepted_bid_amount numeric(12, 2) not null check (accepted_bid_amount > 0),
  accepted_bidder_nickname text not null,
  status text not null default 'pending_meetup' check (status in ('pending_meetup', 'completed', 'cancelled')),
  seller_rating_score int null check (seller_rating_score between 1 and 5),
  seller_rating_note text null,
  buyer_rating_score int null check (buyer_rating_score between 1 and 5),
  buyer_rating_note text null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  completed_at timestamp with time zone default null,
  cancelled_at timestamp with time zone default null,
  constraint marketplace_transactions_participants_different check (seller_user_id <> buyer_user_id)
);

create index if not exists marketplace_transactions_post_idx
  on public.marketplace_transactions (post_id, created_at desc);
create index if not exists marketplace_transactions_seller_idx
  on public.marketplace_transactions (seller_user_id, created_at desc);
create index if not exists marketplace_transactions_buyer_idx
  on public.marketplace_transactions (buyer_user_id, created_at desc);
create index if not exists marketplace_transactions_status_idx
  on public.marketplace_transactions (status, created_at desc);
create unique index if not exists marketplace_transactions_active_post_unique
  on public.marketplace_transactions (post_id)
  where status in ('pending_meetup', 'completed');

alter table public.marketplace_transactions enable row level security;

drop policy if exists "Marketplace transactions are visible to participants or admin" on public.marketplace_transactions;
create policy "Marketplace transactions are visible to participants or admin"
  on public.marketplace_transactions for select
  using (
    public.is_admin()
    or auth.uid() = seller_user_id
    or auth.uid() = buyer_user_id
  );

drop policy if exists "Seller can create marketplace transactions" on public.marketplace_transactions;
create policy "Seller can create marketplace transactions"
  on public.marketplace_transactions for insert
  with check (
    auth.uid() = seller_user_id
    and seller_user_id <> buyer_user_id
    and exists (
      select 1
      from public.marketplace_posts posts
      where posts.id = post_id
        and posts.seller_user_id = seller_user_id
    )
    and exists (
      select 1
      from public.marketplace_bids bids
      where bids.id = accepted_bid_id
        and bids.post_id = post_id
        and bids.bidder_user_id = buyer_user_id
    )
  );

drop policy if exists "Participants can update marketplace transactions" on public.marketplace_transactions;
create policy "Participants can update marketplace transactions"
  on public.marketplace_transactions for update
  using (
    public.is_admin()
    or auth.uid() = seller_user_id
    or auth.uid() = buyer_user_id
  )
  with check (
    public.is_admin()
    or auth.uid() = seller_user_id
    or auth.uid() = buyer_user_id
  );

drop policy if exists "Admins can delete marketplace transactions" on public.marketplace_transactions;
create policy "Admins can delete marketplace transactions"
  on public.marketplace_transactions for delete
  using (public.is_admin());

create or replace function public.marketplace_guard_transaction_updates()
returns trigger
language plpgsql
as $$
declare
  is_service_role boolean := auth.role() = 'service_role';
begin
  if old.status is distinct from new.status then
    if not (is_service_role or public.is_admin() or auth.uid() = old.seller_user_id) then
      raise exception 'Only seller or admin can change transaction status.';
    end if;

    if new.status = 'completed' and old.completed_at is null then
      new.completed_at = timezone('utc'::text, now());
    end if;

    if new.status = 'cancelled' and old.cancelled_at is null then
      new.cancelled_at = timezone('utc'::text, now());
    end if;
  end if;

  if (
    old.seller_rating_score is distinct from new.seller_rating_score
    or old.seller_rating_note is distinct from new.seller_rating_note
  ) then
    if not (is_service_role or public.is_admin() or auth.uid() = old.buyer_user_id) then
      raise exception 'Only buyer can rate seller.';
    end if;
  end if;

  if (
    old.buyer_rating_score is distinct from new.buyer_rating_score
    or old.buyer_rating_note is distinct from new.buyer_rating_note
  ) then
    if not (is_service_role or public.is_admin() or auth.uid() = old.seller_user_id) then
      raise exception 'Only seller can rate buyer.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_marketplace_transactions_guard on public.marketplace_transactions;
create trigger trg_marketplace_transactions_guard
before update on public.marketplace_transactions
for each row
execute function public.marketplace_guard_transaction_updates();

create or replace function public.marketplace_sync_post_status_from_transaction()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.marketplace_posts
    set
      status = 'reserved',
      updated_at = timezone('utc'::text, now())
    where id = new.post_id;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if new.status = 'completed' then
      update public.marketplace_posts
      set
        status = 'sold',
        updated_at = timezone('utc'::text, now())
      where id = new.post_id;
    elsif new.status = 'cancelled' then
      update public.marketplace_posts
      set
        status = 'active',
        updated_at = timezone('utc'::text, now())
      where id = new.post_id
        and status <> 'sold';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_marketplace_transactions_sync_post_status on public.marketplace_transactions;
create trigger trg_marketplace_transactions_sync_post_status
after insert or update on public.marketplace_transactions
for each row
execute function public.marketplace_sync_post_status_from_transaction();

create or replace function public.accept_marketplace_bid(
  p_post_id uuid,
  p_bid_id uuid,
  p_seller_user_id uuid
)
returns public.marketplace_transactions
language plpgsql
as $$
declare
  selected_post public.marketplace_posts%rowtype;
  selected_bid public.marketplace_bids%rowtype;
  created_transaction public.marketplace_transactions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if auth.uid() <> p_seller_user_id then
    raise exception 'Only the seller can accept a bid.';
  end if;

  select *
  into selected_post
  from public.marketplace_posts
  where id = p_post_id
  for update;

  if not found then
    raise exception 'Listing not found.';
  end if;

  if selected_post.seller_user_id <> p_seller_user_id then
    raise exception 'Only the listing owner can accept bids.';
  end if;

  if selected_post.status <> 'active' then
    raise exception 'Only active listings can accept bids.';
  end if;

  select *
  into selected_bid
  from public.marketplace_bids
  where id = p_bid_id
    and post_id = p_post_id
  for update;

  if not found then
    raise exception 'Bid not found for this listing.';
  end if;

  if selected_bid.bidder_user_id = p_seller_user_id then
    raise exception 'Seller cannot accept their own bid.';
  end if;

  if exists (
    select 1
    from public.marketplace_transactions transactions
    where transactions.post_id = p_post_id
      and transactions.status in ('pending_meetup', 'completed')
  ) then
    raise exception 'A transaction already exists for this listing.';
  end if;

  insert into public.marketplace_transactions (
    post_id,
    seller_user_id,
    buyer_user_id,
    accepted_bid_id,
    accepted_bid_amount,
    accepted_bidder_nickname,
    status
  ) values (
    p_post_id,
    p_seller_user_id,
    selected_bid.bidder_user_id,
    selected_bid.id,
    selected_bid.amount,
    selected_bid.bidder_nickname,
    'pending_meetup'
  )
  returning * into created_transaction;

  return created_transaction;
end;
$$;

do $$
begin
  if to_regclass('public.marketplace_transactions') is not null then
    execute 'drop trigger if exists trg_marketplace_transactions_updated_at on public.marketplace_transactions';
    execute
      'create trigger trg_marketplace_transactions_updated_at before update on public.marketplace_transactions for each row execute function public.set_activity_row_updated_at()';
  end if;
end
$$;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'marketplace_transactions'
    ) then
      alter publication supabase_realtime add table public.marketplace_transactions;
    end if;
  end if;
end
$$;
