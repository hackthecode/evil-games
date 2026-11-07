-- Removes the retired Evil Empires game from the database.
-- Run once in Supabase → SQL Editor, then run admin.sql again (the dashboard no longer reads these tables).
-- Also delete the "empires" Edge Function and the VAPID_PUBLIC, VAPID_PRIVATE and CRON_SECRET secrets in the dashboard.

-- the background tick (pg_cron), if it was set up
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'evil-empires-tick';
  end if;
end $$;

drop function if exists public.admin_reset_world(text);
drop function if exists public.ee_commit(jsonb, int, jsonb);
drop table if exists public.ee_push;
drop table if exists public.ee_saves;
drop table if exists public.ee_world;
