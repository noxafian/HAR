-- Persistent per-user rate limiting suitable for stateless serverless runtimes.
begin;

create table private.rate_limit_buckets (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  action text not null check (char_length(action) between 1 and 80),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  primary key (user_id, action)
);
alter table private.rate_limit_buckets enable row level security;
revoke all on private.rate_limit_buckets from public, anon, authenticated;
grant all on private.rate_limit_buckets to service_role;

create or replace function public.consume_rate_limit(
  p_user_id uuid,
  p_action text,
  p_limit integer,
  p_window_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_started timestamptz;
  v_reset timestamptz;
  v_allowed boolean;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_user_id is null or p_action is null or char_length(p_action) not between 1 and 80
     or p_limit < 1 or p_limit > 100000 or p_window_seconds < 1 or p_window_seconds > 31536000 then
    raise exception 'Invalid rate limit parameters' using errcode = '22023';
  end if;

  insert into private.rate_limit_buckets(user_id,action,window_started_at,request_count)
  values (p_user_id,p_action,clock_timestamp(),1)
  on conflict (user_id,action) do update set
    window_started_at = case
      when private.rate_limit_buckets.window_started_at + make_interval(secs => p_window_seconds) <= clock_timestamp()
        then clock_timestamp()
      else private.rate_limit_buckets.window_started_at end,
    request_count = case
      when private.rate_limit_buckets.window_started_at + make_interval(secs => p_window_seconds) <= clock_timestamp()
        then 1
      else least(private.rate_limit_buckets.request_count + 1, p_limit + 1) end
  returning request_count, window_started_at into v_count, v_started;

  v_reset := v_started + make_interval(secs => p_window_seconds);
  v_allowed := v_count <= p_limit;
  return jsonb_build_object(
    'allowed',v_allowed,
    'limit',p_limit,
    'remaining',greatest(0,p_limit-v_count),
    'reset',v_reset,
    'retryAfter',case when v_allowed then null else greatest(1,ceil(extract(epoch from (v_reset-clock_timestamp())))::integer) end
  );
end;
$$;

create or replace function public.check_rate_limit(
  p_user_id uuid,
  p_action text,
  p_limit integer,
  p_window_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_started timestamptz := clock_timestamp();
  v_reset timestamptz;
  v_allowed boolean;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  select request_count,window_started_at into v_count,v_started
  from private.rate_limit_buckets where user_id=p_user_id and action=p_action;
  if not found or v_started + make_interval(secs => p_window_seconds) <= clock_timestamp() then
    v_count := 0;
    v_started := clock_timestamp();
  end if;
  v_reset := v_started + make_interval(secs => p_window_seconds);
  v_allowed := v_count < p_limit;
  return jsonb_build_object(
    'allowed',v_allowed,'limit',p_limit,'remaining',greatest(0,p_limit-v_count),
    'reset',v_reset,
    'retryAfter',case when v_allowed then null else greatest(1,ceil(extract(epoch from (v_reset-clock_timestamp())))::integer) end
  );
end;
$$;

create or replace function public.reset_rate_limit(p_user_id uuid,p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  delete from private.rate_limit_buckets where user_id=p_user_id and action=p_action;
end;
$$;

revoke all on function public.consume_rate_limit(uuid,text,integer,integer) from public,anon,authenticated;
revoke all on function public.check_rate_limit(uuid,text,integer,integer) from public,anon,authenticated;
revoke all on function public.reset_rate_limit(uuid,text) from public,anon,authenticated;
grant execute on function public.consume_rate_limit(uuid,text,integer,integer) to service_role;
grant execute on function public.check_rate_limit(uuid,text,integer,integer) to service_role;
grant execute on function public.reset_rate_limit(uuid,text) to service_role;

commit;
