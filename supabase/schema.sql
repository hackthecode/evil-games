-- Schema for online accounts and statistics (Supabase → SQL Editor → Run).

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  display_name text not null,
  color text,
  created_at timestamptz not null default now()
);

create table if not exists public.game_stats (
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id text not null,
  played int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  draws int not null default 0,
  time_ms bigint not null default 0,
  last_played timestamptz,
  primary key (user_id, game_id)
);

create table if not exists public.matches (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id text not null,
  result text not null check (result in ('win', 'loss', 'draw')),
  duration_ms int not null default 0,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists matches_user_idx on public.matches (user_id, created_at desc);

-- A profile is created automatically on sign-up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name, color)
  values (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'color'
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Recording a game result (only for the current user).
create or replace function public.record_game(p_game text, p_result text, p_duration int, p_meta jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_game !~ '^[a-z0-9_]{2,20}$' then raise exception 'bad game'; end if;
  insert into game_stats (user_id, game_id, played, wins, losses, draws, last_played)
  values (auth.uid(), p_game, 1,
          (p_result = 'win')::int, (p_result = 'loss')::int, (p_result = 'draw')::int, now())
  on conflict (user_id, game_id) do update set
    played = game_stats.played + 1,
    wins = game_stats.wins + (p_result = 'win')::int,
    losses = game_stats.losses + (p_result = 'loss')::int,
    draws = game_stats.draws + (p_result = 'draw')::int,
    last_played = now();
  insert into matches (user_id, game_id, result, duration_ms, meta)
  values (auth.uid(), p_game, p_result, greatest(0, least(p_duration, 86400000)), p_meta);
end $$;

-- Adding played time (max. 6 hours per request).
create or replace function public.add_play_time(p_game text, p_ms int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_game !~ '^[a-z0-9_]{2,20}$' then raise exception 'bad game'; end if;
  insert into game_stats (user_id, game_id, time_ms)
  values (auth.uid(), p_game, greatest(0, least(p_ms, 21600000)))
  on conflict (user_id, game_id) do update set
    time_ms = game_stats.time_ms + greatest(0, least(p_ms, 21600000));
end $$;

-- The ranking (view leaderboard) is at the end of the file – after the ratings table.

-- Access rights (Row Level Security).
alter table public.profiles enable row level security;
alter table public.game_stats enable row level security;
alter table public.matches enable row level security;

drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select using (true);
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

drop policy if exists "stats readable" on public.game_stats;
create policy "stats readable" on public.game_stats for select using (true);

drop policy if exists "own matches" on public.matches;
create policy "own matches" on public.matches for select using (auth.uid() = user_id);


-- ===== Referee server (Edge Function "referee") =====
-- The secret state of the card games (deck, hands) and the log with the players' views.
-- No access policies: only the Edge Function (service role) reads and writes, no client.
create table if not exists public.referee_matches (
  key text primary key,
  game_id text not null,
  seats jsonb not null,              -- [{ uid, bot, name }]
  state jsonb not null,              -- the referee's secret state
  n int not null default 0,          -- number of steps (optimistic locking)
  joined int[] not null default '{}',
  started boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.referee_log (
  key text not null references public.referee_matches(key) on delete cascade,
  n int not null,
  seat int not null,
  type text not null,
  pub jsonb,                         -- the public part of the step
  views jsonb not null,              -- each human's view after the step
  created_at timestamptz not null default now(),
  primary key (key, n)
);
alter table public.referee_matches enable row level security;
alter table public.referee_log enable row level security;

-- Old matches (older than 3 days) can be cleaned up periodically:
-- delete from public.referee_matches where updated_at < now() - interval '3 days';

-- ===== Friends =====
create table if not exists public.friendships (
  user_id uuid not null references public.profiles(id) on delete cascade,   -- who sent the request
  friend_id uuid not null references public.profiles(id) on delete cascade, -- recipient
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
alter table public.friendships enable row level security;
drop policy if exists "friends read" on public.friendships;
create policy "friends read" on public.friendships for select using (auth.uid() in (user_id, friend_id));
drop policy if exists "friends request" on public.friendships;
create policy "friends request" on public.friendships for insert with check (auth.uid() = user_id and status = 'pending');
drop policy if exists "friends accept" on public.friendships;
create policy "friends accept" on public.friendships for update using (auth.uid() = friend_id) with check (status = 'accepted');
drop policy if exists "friends remove" on public.friendships;
create policy "friends remove" on public.friendships for delete using (auth.uid() in (user_id, friend_id));

-- ===== Rating (Elo) for online matches =====
-- Each player reports their result; the rating is computed once, when all
-- players of the match have reported the same line-up and consistent results.
create table if not exists public.ratings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id text not null,
  rating int not null default 1200,
  games int not null default 0,
  primary key (user_id, game_id)
);
create table if not exists public.rated_reports (
  match_key text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id text not null,
  team int not null,
  outcome text not null check (outcome in ('win', 'loss', 'draw')),
  players jsonb not null,
  created_at timestamptz not null default now(),
  primary key (match_key, user_id)
);
create table if not exists public.rated_matches (
  match_key text primary key,
  game_id text not null,
  processed_at timestamptz not null default now()
);
alter table public.ratings enable row level security;
alter table public.rated_reports enable row level security;
alter table public.rated_matches enable row level security;
drop policy if exists "ratings readable" on public.ratings;
create policy "ratings readable" on public.ratings for select using (true);

-- Computation (the same algorithm as js/store/elo.js).
create or replace function public.apply_elo(p_key text, p_game text) returns void
language plpgsql security definer set search_path = public as $$
declare
  teams int[]; outs text[]; avgs float[]; delta float[];
  n int; i int; j int; win_i int := 0; draws int := 0; losses int := 0;
  e float; d float; k constant float := 32;
begin
  insert into ratings (user_id, game_id)
    select user_id, p_game from rated_reports where match_key = p_key
    on conflict do nothing;
  -- everyone on a team must have reported the same result
  if exists (select 1 from rated_reports where match_key = p_key group by team having count(distinct outcome) > 1) then
    return;
  end if;
  select array_agg(team order by team), array_agg(outcome order by team), array_agg(avg_r order by team)
    into teams, outs, avgs
  from (
    select rr.team, min(rr.outcome) as outcome, avg(ra.rating)::float as avg_r
    from rated_reports rr join ratings ra on ra.user_id = rr.user_id and ra.game_id = p_game
    where rr.match_key = p_key group by rr.team
  ) s;
  n := coalesce(array_length(teams, 1), 0);
  if n < 2 then return; end if;
  delta := array_fill(0::float, array[n]);
  for i in 1..n loop
    if outs[i] = 'win' then win_i := i;
    elsif outs[i] = 'draw' then draws := draws + 1;
    else losses := losses + 1;
    end if;
  end loop;
  if n = 2 and draws = 2 then
    e := 1 / (1 + power(10, (avgs[2] - avgs[1]) / 400));
    d := k * (0.5 - e);
    delta[1] := d;
    delta[2] := -d;
  elsif win_i > 0 and losses = n - 1 then
    for j in 1..n loop
      if j <> win_i then
        e := 1 / (1 + power(10, (avgs[j] - avgs[win_i]) / 400));
        d := k * (1 - e) / (n - 1);
        delta[win_i] := delta[win_i] + d;
        delta[j] := delta[j] - d;
      end if;
    end loop;
  else
    return; -- inconsistent results – no change
  end if;
  for i in 1..n loop
    update ratings set rating = greatest(100, rating + round(delta[i])::int), games = games + 1
    where game_id = p_game and user_id in (select user_id from rated_reports where match_key = p_key and team = teams[i]);
  end loop;
end $$;

create or replace function public.report_rated(p_key text, p_game text, p_team int, p_outcome text, p_players jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare n_players int; n_reports int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_game !~ '^[a-z0-9_]{2,20}$' or p_outcome not in ('win', 'loss', 'draw') or length(p_key) > 100 then
    raise exception 'bad input';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(p_players) e
    where (e->>'uid')::uuid = auth.uid() and (e->>'team')::int = p_team
  ) then raise exception 'not a player'; end if;
  insert into rated_reports (match_key, user_id, game_id, team, outcome, players)
    values (p_key, auth.uid(), p_game, p_team, p_outcome, p_players)
    on conflict do nothing;
  n_players := jsonb_array_length(p_players);
  if n_players < 2 then return; end if;
  select count(*) into n_reports from rated_reports
    where match_key = p_key and game_id = p_game and players = p_players;
  if n_reports < n_players then return; end if;
  insert into rated_matches (match_key, game_id) values (p_key, p_game) on conflict do nothing;
  if not found then return; end if; -- already computed
  perform apply_elo(p_key, p_game);
end $$;
grant execute on function public.report_rated(text, text, int, text, jsonb) to authenticated;
revoke execute on function public.apply_elo(text, text) from public, anon, authenticated;

-- The ranking with the rating per game (the new columns are at the end so the view can be replaced).
create or replace view public.leaderboard as
  select p.id as user_id, p.username, p.display_name, p.color, p.created_at,
         s.game_id, s.played, s.wins, s.losses, s.draws, s.time_ms, s.last_played,
         r.rating, coalesce(r.games, 0) as rated_games
  from game_stats s join profiles p on p.id = s.user_id
  left join ratings r on r.user_id = s.user_id and r.game_id = s.game_id
  union all
  select p.id, p.username, p.display_name, p.color, p.created_at,
         'all', sum(s.played)::int, sum(s.wins)::int, sum(s.losses)::int, sum(s.draws)::int,
         sum(s.time_ms)::bigint, max(s.last_played), null::int, 0
  from game_stats s join profiles p on p.id = s.user_id
  group by p.id;
grant select on public.leaderboard to anon, authenticated;
