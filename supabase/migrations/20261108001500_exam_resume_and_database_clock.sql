-- Resume support uses a database-clock reference so browser countdowns are not
-- dependent on Next.js host clock skew.
begin;

create or replace function public.get_server_time()
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  return clock_timestamp();
end;
$$;

revoke all on function public.get_server_time() from public, anon;
grant execute on function public.get_server_time() to authenticated;

commit;
