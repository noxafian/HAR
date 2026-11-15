-- One-time owner bootstrap. The bootstrap secret is supplied out-of-band at setup;
-- it is bcrypt-hashed in private.bootstrap_config and never stored in source control.

begin;

create or replace function public.seed_owner_bootstrap_secret(p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_secret is null or char_length(p_secret) < 32 then
    raise exception 'Bootstrap secret must contain at least 32 characters' using errcode = '22023';
  end if;
  update private.bootstrap_config
     set secret_hash = extensions.crypt(p_secret, extensions.gen_salt('bf', 12)),
         seeded_at = clock_timestamp()
   where singleton = true and seeded_at is null and used = false;
  if not found then
    -- Safe retry: the same configured secret may be seeded again before use.
    if exists (select 1 from private.bootstrap_config where singleton=true and used=false
      and seeded_at is not null and extensions.crypt(p_secret,secret_hash)=secret_hash) then
      return;
    end if;
    raise exception 'Bootstrap secret already seeded with a different secret or bootstrap already used' using errcode = '55000';
  end if;
end;
$$;

create or replace function private.bootstrap_owner_impl(p_user_id uuid, p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config private.bootstrap_config%rowtype;
begin
  select * into v_config from private.bootstrap_config where singleton = true for update;
  if not found or v_config.seeded_at is null or v_config.secret_hash is null then
    raise exception 'Bootstrap is not configured' using errcode = 'P0041';
  end if;
  if v_config.used then
    raise exception 'Bootstrap has already been consumed' using errcode = 'P0040';
  end if;
  if extensions.crypt(p_secret, v_config.secret_hash) is distinct from v_config.secret_hash then
    raise exception 'Invalid bootstrap secret' using errcode = 'P0042';
  end if;
  if not exists (select 1 from auth.users u join public.user_profiles p on p.id = u.id where u.id = p_user_id) then
    raise exception 'Target auth user/profile does not exist' using errcode = 'P0043';
  end if;
  if exists (select 1 from public.memberships where role = 'owner') then
    raise exception 'An owner already exists' using errcode = 'P0044';
  end if;

  update public.memberships
     set role = 'owner', status = 'approved', joined_at = coalesce(joined_at, now()),
         approved_at = now(), approved_by = p_user_id,
         rejected_at = null, rejected_by = null, rejection_reason = null,
         suspended_at = null, suspended_by = null, suspension_reason = null
   where user_id = p_user_id;
  if not found then raise exception 'Target membership does not exist' using errcode = 'P0045'; end if;

  -- This update and the membership promotion are in one transaction. If either fails,
  -- both roll back; retrying after a true failure is safe.
  update private.bootstrap_config set used = true, used_at = clock_timestamp() where singleton = true;
  insert into public.audit_log(action, user_id, resource_type, resource_id, status, metadata)
  values ('admin.owner_bootstrapped', p_user_id, 'membership', p_user_id::text, 'success', jsonb_build_object('role','owner'));
end;
$$;

create or replace function public.bootstrap_owner_pub(p_user_id uuid, p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  perform private.bootstrap_owner_impl(p_user_id, p_secret);
end;
$$;

revoke all on function public.seed_owner_bootstrap_secret(text) from public, anon, authenticated;
revoke all on function public.bootstrap_owner_pub(uuid,text) from public, anon, authenticated;
revoke all on function private.bootstrap_owner_impl(uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.seed_owner_bootstrap_secret(text) to service_role;
grant execute on function public.bootstrap_owner_pub(uuid,text) to service_role;

commit;
