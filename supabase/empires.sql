-- Evil Empires – таблици за онлайн света. Изпълнете веднъж в Supabase → SQL Editor.
-- Достъп има само сървърът (Edge Function с service role) – затова няма политики за потребителите.

create table if not exists public.ee_world (
  id int primary key,
  doc jsonb not null,
  version int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.ee_saves (
  uid uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  version int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.ee_push (
  endpoint text primary key,
  uid uuid not null references auth.users(id) on delete cascade,
  sub jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.ee_world enable row level security;
alter table public.ee_saves enable row level security;
alter table public.ee_push enable row level security;

-- Записва света и империите наведнъж – само ако никой не ги е променил междувременно.
create or replace function public.ee_commit(p_world jsonb, p_world_version int, p_saves jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  s jsonb;
  n int;
begin
  if p_world is not null then
    if p_world_version < 0 then
      insert into ee_world(id, doc, version) values (1, p_world, 1) on conflict (id) do nothing;
    else
      update ee_world set doc = p_world, version = version + 1, updated_at = now()
        where id = 1 and version = p_world_version;
    end if;
    get diagnostics n = row_count;
    if n = 0 then raise exception 'conflict'; end if;
  end if;
  for s in select * from jsonb_array_elements(coalesce(p_saves, '[]'::jsonb)) loop
    if (s->>'version')::int < 0 then
      insert into ee_saves(uid, state, version) values ((s->>'uid')::uuid, s->'state', 1) on conflict (uid) do nothing;
    elsif s->'state' is null or jsonb_typeof(s->'state') = 'null' then
      delete from ee_saves where uid = (s->>'uid')::uuid and version = (s->>'version')::int;
    else
      update ee_saves set state = s->'state', version = version + 1, updated_at = now()
        where uid = (s->>'uid')::uuid and version = (s->>'version')::int;
    end if;
    get diagnostics n = row_count;
    if n = 0 then raise exception 'conflict'; end if;
  end loop;
  return true;
exception when raise_exception then
  return false;
end;
$$;

revoke all on function public.ee_commit(jsonb, int, jsonb) from public, anon, authenticated;
