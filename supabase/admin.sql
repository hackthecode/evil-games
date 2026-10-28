-- Administrator dashboard: administrators, banned accounts, reports and resetting the world.
-- Run once in Supabase → SQL Editor (after schema.sql, empires.sql and lobby.sql).
-- Everything goes through functions that first check whether the caller is an administrator –
-- no secret key is needed in the browser.

-- ---------- administrators ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;   -- no policies: only through the functions below

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from admins where user_id = auth.uid()) $$;

-- ---------- banned accounts ----------
create table if not exists public.bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null default '',
  until timestamptz not null,
  by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.bans enable row level security;
drop policy if exists "own ban" on public.bans;
create policy "own ban" on public.bans for select to authenticated using (user_id = auth.uid());

create or replace function public.is_banned(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from bans where user_id = p_user and until > now()) $$;

-- banned players cannot write in the lobby (replaces the function from lobby.sql)
create or replace function public.lobby_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  new.created_at := now();
  if is_banned(auth.uid()) then
    raise exception 'The account is banned.';
  end if;
  select display_name, color into new.name, new.color from profiles where id = auth.uid();
  if exists (select 1 from lobby_messages where user_id = auth.uid() and created_at > now() - interval '2 seconds') then
    raise exception 'Too fast – wait a moment.';
  end if;
  return new;
end;
$$;

-- ---------- reports ----------
create table if not exists public.reports (
  id bigserial primary key,
  reporter uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target uuid references auth.users(id) on delete cascade,
  message_id bigint,
  body text not null default '',          -- a copy of the message (in case it is deleted)
  reason text not null check (char_length(reason) between 1 and 300),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
drop policy if exists "report insert" on public.reports;
create policy "report insert" on public.reports for insert to authenticated with check (reporter = auth.uid());

create or replace function public.reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.reporter := auth.uid();
  new.resolved := false;
  new.created_at := now();
  if (select count(*) from reports where reporter = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many reports – try again later.';
  end if;
  if new.message_id is not null then
    select user_id, body into new.target, new.body from lobby_messages where id = new.message_id;
  end if;
  return new;
end;
$$;
drop trigger if exists reports_before_insert on public.reports;
create trigger reports_before_insert before insert on public.reports
  for each row execute function public.reports_before_insert();

-- ---------- the dashboard functions ----------
create or replace function public.admin_check()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$ begin if not is_admin() then raise exception 'You don''t have administrator rights.'; end if; end $$;

-- Overview: accounts, empires, active, reports, banned, messages.
create or replace function public.admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  w jsonb;
  cutoff bigint := (extract(epoch from now()) * 1000)::bigint - 15 * 60 * 1000;
begin
  perform admin_check();
  select doc into w from ee_world where id = 1;
  return jsonb_build_object(
    'users', (select count(*) from profiles),
    'users7', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'empires', (select count(*) from ee_saves),
    'active15', (select count(*) from jsonb_each(coalesce(w->'players', '{}'::jsonb)) p where (p.value->>'t')::bigint > cutoff),
    'alliances', (select count(*) from jsonb_object_keys(coalesce(w->'alliances', '{}'::jsonb))),
    'matches24', (select count(*) from matches where created_at > now() - interval '24 hours'),
    'lobby24', (select count(*) from lobby_messages where created_at > now() - interval '24 hours'),
    'reports', (select count(*) from reports where not resolved),
    'bans', (select count(*) from bans where until > now()),
    'worldCreated', w->'created'
  );
end;
$$;

-- Players (search by name): profile, empire, last activity, ban.
create or replace function public.admin_players(p_query text default '')
returns table (id uuid, username text, display_name text, created_at timestamptz, empire text, score int, last_active bigint, banned_until timestamptz, ban_reason text, is_admin boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  w jsonb;
begin
  perform admin_check();
  select doc into w from ee_world where id = 1;
  return query
    select p.id, p.username, p.display_name, p.created_at,
      w->'players'->(p.id::text)->>'name',
      (w->'players'->(p.id::text)->>'score')::int,
      (w->'players'->(p.id::text)->>'t')::bigint,
      b.until, b.reason,
      exists (select 1 from admins a where a.user_id = p.id)
    from profiles p
    left join bans b on b.user_id = p.id and b.until > now()
    where coalesce(p_query, '') = '' or p.display_name ilike '%' || p_query || '%' or p.username ilike '%' || p_query || '%'
    order by p.created_at desc
    limit 200;
end;
$$;

create or replace function public.admin_ban(p_user uuid, p_reason text, p_hours int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform admin_check();
  if p_user = auth.uid() then raise exception 'You cannot ban yourself.'; end if;
  if exists (select 1 from admins where user_id = p_user) then raise exception 'An administrator cannot be banned.'; end if;
  insert into bans(user_id, reason, until, by)
    values (p_user, left(coalesce(p_reason, ''), 300), now() + make_interval(hours => greatest(1, least(p_hours, 24 * 365 * 10))), auth.uid())
    on conflict (user_id) do update set reason = excluded.reason, until = excluded.until, by = excluded.by, created_at = now();
end;
$$;

create or replace function public.admin_unban(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$ begin perform admin_check(); delete from bans where user_id = p_user; end $$;

create or replace function public.admin_reports()
returns table (id bigint, created_at timestamptz, reporter_name text, target uuid, target_name text, message_id bigint, body text, reason text, message_exists boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform admin_check();
  return query
    select r.id, r.created_at, pr.display_name, r.target, pt.display_name, r.message_id, r.body, r.reason,
      exists (select 1 from lobby_messages m where m.id = r.message_id)
    from reports r
    left join profiles pr on pr.id = r.reporter
    left join profiles pt on pt.id = r.target
    where not r.resolved
    order by r.created_at desc
    limit 200;
end;
$$;

create or replace function public.admin_resolve(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$ begin perform admin_check(); update reports set resolved = true where id = p_id; end $$;

create or replace function public.admin_delete_message(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$ begin perform admin_check(); delete from lobby_messages where id = p_id; end $$;

-- Resetting the Evil Empires world: deletes all empires and the map (the server creates a new world).
create or replace function public.admin_reset_world(p_confirm text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform admin_check();
  if p_confirm is distinct from 'RESET' then raise exception 'Type RESET to confirm.'; end if;
  delete from ee_saves where true;
  delete from ee_world where true;
end;
$$;

revoke all on function public.admin_check() from public, anon;
revoke all on function public.admin_overview() from public, anon;
revoke all on function public.admin_players(text) from public, anon;
revoke all on function public.admin_ban(uuid, text, int) from public, anon;
revoke all on function public.admin_unban(uuid) from public, anon;
revoke all on function public.admin_reports() from public, anon;
revoke all on function public.admin_resolve(bigint) from public, anon;
revoke all on function public.admin_delete_message(bigint) from public, anon;
revoke all on function public.admin_reset_world(text) from public, anon;
grant execute on function public.is_admin(), public.admin_overview(), public.admin_players(text), public.admin_ban(uuid, text, int),
  public.admin_unban(uuid), public.admin_reports(), public.admin_resolve(bigint), public.admin_delete_message(bigint),
  public.admin_reset_world(text) to authenticated;

-- ---------- make yourself an administrator ----------
-- Replace YOUR_USERNAME with your portal username and run this line (after signing up on the portal):
-- insert into public.admins(user_id) select id from public.profiles where lower(username) = lower('YOUR_USERNAME') on conflict do nothing;
