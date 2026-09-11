create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  is_banned boolean not null default false,
  trust_score integer not null default 0 check (trust_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.road_events (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null check (
    event_type in ('road_check', 'accident', 'road_hazard', 'road_closure')
  ),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  status text not null default 'active' check (
    status in ('active', 'stale', 'removed', 'expired')
  ),
  confidence integer not null default 0,
  confirmation_count integer not null default 0 check (confirmation_count >= 0),
  gone_count integer not null default 0 check (gone_count >= 0),
  created_at timestamptz not null default now(),
  last_confirmed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '4 hours')
);

create table if not exists public.event_votes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.road_events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  vote_type text not null check (vote_type in ('confirm', 'gone')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists road_events_status_expires_at_idx
  on public.road_events (status, expires_at);

create index if not exists road_events_reporter_id_idx
  on public.road_events (reporter_id);

create index if not exists event_votes_event_id_idx
  on public.event_votes (event_id);

create index if not exists event_votes_user_id_event_id_idx
  on public.event_votes (user_id, event_id);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.road_events enable row level security;
alter table public.event_votes enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Authenticated users can read active events" on public.road_events;
create policy "Authenticated users can read active events"
  on public.road_events for select
  to authenticated
  using (status = 'active');

drop policy if exists "Non-banned users can create their own events" on public.road_events;
create policy "Non-banned users can create their own events"
  on public.road_events for insert
  to authenticated
  with check (
    auth.uid() = reporter_id
    and not exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_banned
    )
  );

drop policy if exists "Users can read their own votes" on public.event_votes;
create policy "Users can read their own votes"
  on public.event_votes for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Non-banned users can create their own votes" on public.event_votes;
create policy "Non-banned users can create their own votes"
  on public.event_votes for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_banned
    )
  );

drop policy if exists "Non-banned users can update their own votes" on public.event_votes;
create policy "Non-banned users can update their own votes"
  on public.event_votes for update
  to authenticated
  using (
    auth.uid() = user_id
    and not exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_banned
    )
  )
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_banned
    )
  );

drop policy if exists "Non-banned users can delete their own votes" on public.event_votes;
create policy "Non-banned users can delete their own votes"
  on public.event_votes for delete
  to authenticated
  using (
    auth.uid() = user_id
    and not exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.is_banned
    )
  );

revoke all on public.profiles, public.road_events, public.event_votes from anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.road_events to authenticated;
grant insert (reporter_id, event_type, latitude, longitude) on public.road_events to authenticated;
grant select on public.event_votes to authenticated;
grant insert (event_id, user_id, vote_type) on public.event_votes to authenticated;
grant update (vote_type) on public.event_votes to authenticated;
grant delete on public.event_votes to authenticated;

revoke update (confidence, confirmation_count, gone_count, status, last_confirmed_at, expires_at)
  on public.road_events from authenticated;
