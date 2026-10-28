-- Lobby: shared chat for all logged-in players. Run once in Supabase → SQL Editor.

create table if not exists public.lobby_messages (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default '',
  color text,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);

alter table public.lobby_messages enable row level security;

drop policy if exists "lobby read" on public.lobby_messages;
create policy "lobby read" on public.lobby_messages for select to authenticated using (true);
drop policy if exists "lobby write" on public.lobby_messages;
create policy "lobby write" on public.lobby_messages for insert to authenticated with check (user_id = auth.uid());

-- The name and colour come from the profile (they can't be faked); no more than 1 message per 2 seconds.
create or replace function public.lobby_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  new.created_at := now();
  select display_name, color into new.name, new.color from profiles where id = auth.uid();
  if exists (select 1 from lobby_messages where user_id = auth.uid() and created_at > now() - interval '2 seconds') then
    raise exception 'Too fast – wait a moment.';
  end if;
  return new;
end;
$$;

drop trigger if exists lobby_before_insert on public.lobby_messages;
create trigger lobby_before_insert before insert on public.lobby_messages
  for each row execute function public.lobby_before_insert();

-- Messages arrive instantly (Realtime).
do $$ begin
  alter publication supabase_realtime add table public.lobby_messages;
exception when duplicate_object then null;
end $$;

-- Cleanup: we keep the chat for 7 days.
select cron.unschedule('lobby-cleanup') where exists (select 1 from cron.job where jobname = 'lobby-cleanup');
select cron.schedule('lobby-cleanup', '0 4 * * *', $$ delete from public.lobby_messages where created_at < now() - interval '7 days' $$);
