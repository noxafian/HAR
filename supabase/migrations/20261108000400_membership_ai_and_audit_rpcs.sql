-- Keryvion StudyHub — owner moderation, persistent AI credentials and audit RPCs.
-- User-bound operations use auth.uid(); service-only operations verify auth.role().
begin;

create or replace function public.list_pending_join_requests(p_limit integer default 20, p_offset integer default 0)
returns table(request_id uuid, user_id uuid, email text, display_name text, message text, requested_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_owner() then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  return query
    select jr.id, jr.user_id, jr.email, jr.display_name, jr.message, jr.requested_at
    from public.join_requests jr
    where jr.status = 'pending'
    order by jr.requested_at asc, jr.id
    limit greatest(1, least(coalesce(p_limit,20),100))
    offset greatest(coalesce(p_offset,0),0);
end;
$$;
revoke all on function public.list_pending_join_requests(integer,integer) from public, anon;
grant execute on function public.list_pending_join_requests(integer,integer) to authenticated;

create or replace function public.count_pending_join_requests()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_owner() then raise exception 'Owner access required' using errcode = '42501'; end if;
  return (select count(*) from public.join_requests where status='pending');
end;
$$;
revoke all on function public.count_pending_join_requests() from public, anon;
grant execute on function public.count_pending_join_requests() to authenticated;

create or replace function public.list_members(p_status public.membership_status default null, p_limit integer default 50, p_offset integer default 0)
returns table(user_id uuid, email text, display_name text, exam_papers public.exam_paper[], role public.user_role, status public.membership_status, joined_at timestamptz, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_owner() then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  return query
    select m.user_id, p.email, p.display_name, p.exam_papers, m.role, m.status, m.joined_at, m.created_at
    from public.memberships m join public.user_profiles p on p.id = m.user_id
    where p_status is null or m.status = p_status
    order by m.created_at desc, m.user_id
    limit greatest(1, least(coalesce(p_limit,50),200))
    offset greatest(coalesce(p_offset,0),0);
end;
$$;
revoke all on function public.list_members(public.membership_status,integer,integer) from public, anon;
grant execute on function public.list_members(public.membership_status,integer,integer) to authenticated;

create or replace function public.count_members(p_status public.membership_status default null)
returns bigint language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_owner() then raise exception 'Owner access required' using errcode = '42501'; end if;
  return (select count(*) from public.memberships m where p_status is null or m.status = p_status);
end; $$;
revoke all on function public.count_members(public.membership_status) from public, anon;
grant execute on function public.count_members(public.membership_status) to authenticated;

create or replace function public.approve_join_request(p_request_id uuid, p_role public.user_role default 'member')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.join_requests%rowtype;
  v_member public.memberships%rowtype;
begin
  if v_uid is null or not public.is_platform_owner() then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if p_role not in ('member','moderator') then
    raise exception 'The owner role can only be assigned through the bootstrap process' using errcode = '22023';
  end if;
  select * into v_request from public.join_requests where id = p_request_id for update;
  if not found then raise exception 'Join request not found' using errcode = 'P0002'; end if;
  select * into v_member from public.memberships where user_id = v_request.user_id for update;
  if not found then raise exception 'Membership record missing' using errcode = 'P0002'; end if;
  if v_request.status = 'approved' and v_member.status = 'approved' then
    return jsonb_build_object('requestId',v_request.id,'userId',v_request.user_id,'status','approved','role',v_member.role,'alreadyProcessed',true);
  end if;
  if v_request.status <> 'pending' then
    raise exception 'Join request is no longer pending' using errcode = '55000';
  end if;
  update public.memberships set status = 'approved', role = p_role, joined_at = coalesce(joined_at,clock_timestamp()),
    approved_at = clock_timestamp(), approved_by = v_uid,
    rejected_at = null, rejected_by = null, rejection_reason = null,
    suspended_at = null, suspended_by = null, suspension_reason = null
  where user_id = v_request.user_id;
  update public.join_requests set status = 'approved', responded_at = clock_timestamp(), responded_by = v_uid
  where id = p_request_id;
  insert into public.audit_log(action,user_id,resource_type,resource_id,status,metadata)
  values ('member.approved',v_uid,'membership',v_request.user_id::text,'success',jsonb_build_object('role',p_role,'requestId',p_request_id));
  return jsonb_build_object('requestId',p_request_id,'userId',v_request.user_id,'status','approved','role',p_role,'alreadyProcessed',false);
end;
$$;
revoke all on function public.approve_join_request(uuid,public.user_role) from public, anon;
grant execute on function public.approve_join_request(uuid,public.user_role) to authenticated;

create or replace function public.reject_join_request(p_request_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.join_requests%rowtype;
begin
  if v_uid is null or not public.is_platform_owner() then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if p_reason is not null and char_length(p_reason) > 500 then raise exception 'Reason too long' using errcode = '22023'; end if;
  select * into v_request from public.join_requests where id = p_request_id for update;
  if not found then raise exception 'Join request not found' using errcode = 'P0002'; end if;
  if v_request.status = 'rejected' then
    return jsonb_build_object('requestId',p_request_id,'userId',v_request.user_id,'status','rejected','alreadyProcessed',true);
  end if;
  if exists (select 1 from public.memberships where user_id=v_request.user_id and role='owner') then
    raise exception 'Owner membership cannot be rejected' using errcode = '42501';
  end if;
  if v_request.status <> 'pending' then raise exception 'Join request is no longer pending' using errcode = '55000'; end if;
  update public.memberships set status = 'rejected', rejected_at = clock_timestamp(), rejected_by = v_uid,
    rejection_reason = p_reason where user_id = v_request.user_id and role <> 'owner';
  update public.join_requests set status = 'rejected', responded_at = clock_timestamp(), responded_by = v_uid
  where id = p_request_id;
  insert into public.audit_log(action,user_id,resource_type,resource_id,status,metadata)
  values ('member.rejected',v_uid,'membership',v_request.user_id::text,'success',jsonb_build_object('requestId',p_request_id));
  return jsonb_build_object('requestId',p_request_id,'userId',v_request.user_id,'status','rejected','alreadyProcessed',false);
end;
$$;
revoke all on function public.reject_join_request(uuid,text) from public, anon;
grant execute on function public.reject_join_request(uuid,text) to authenticated;

create or replace function public.set_member_access(p_user_id uuid, p_status public.membership_status, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.memberships%rowtype;
begin
  if v_uid is null or not public.is_platform_owner() then raise exception 'Owner access required' using errcode = '42501'; end if;
  if p_user_id = v_uid then raise exception 'Owner cannot change own membership status' using errcode = '22023'; end if;
  if p_status not in ('approved','suspended','removed') then raise exception 'Unsupported membership status transition' using errcode = '22023'; end if;
  if p_reason is not null and char_length(p_reason) > 500 then raise exception 'Reason too long' using errcode = '22023'; end if;
  select * into v_member from public.memberships where user_id = p_user_id for update;
  if not found then raise exception 'Membership not found' using errcode = 'P0002'; end if;
  if v_member.role = 'owner' then raise exception 'Owner membership is protected' using errcode = '42501'; end if;
  update public.memberships set status = p_status,
    approved_at = case when p_status = 'approved' then clock_timestamp() else approved_at end,
    approved_by = case when p_status = 'approved' then v_uid else approved_by end,
    suspended_at = case when p_status = 'suspended' then clock_timestamp() else null end,
    suspended_by = case when p_status = 'suspended' then v_uid else null end,
    suspension_reason = case when p_status = 'suspended' then p_reason else null end
  where user_id = p_user_id;
  insert into public.audit_log(action,user_id,resource_type,resource_id,status,metadata)
  values (case p_status when 'suspended' then 'member.suspended' when 'removed' then 'member.removed' else 'member.reactivated' end,
    v_uid,'membership',p_user_id::text,'success',jsonb_build_object('status',p_status,'reason',p_reason));
  return jsonb_build_object('userId',p_user_id,'status',p_status,'role',v_member.role);
end;
$$;
revoke all on function public.set_member_access(uuid,public.membership_status,text) from public, anon;
grant execute on function public.set_member_access(uuid,public.membership_status,text) to authenticated;

create or replace function public.set_member_role(p_user_id uuid, p_role public.user_role)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.memberships%rowtype;
begin
  if v_uid is null or not public.is_platform_owner() then raise exception 'Owner access required' using errcode = '42501'; end if;
  if p_user_id = v_uid or p_role = 'owner' then raise exception 'Owner role is reserved for bootstrap and cannot be changed here' using errcode = '22023'; end if;
  select * into v_member from public.memberships where user_id = p_user_id for update;
  if not found then raise exception 'Membership not found' using errcode = 'P0002'; end if;
  if v_member.role = 'owner' then raise exception 'Owner membership is protected' using errcode = '42501'; end if;
  if v_member.status <> 'approved' then raise exception 'Only approved members can receive a role change' using errcode = '55000'; end if;
  update public.memberships set role = p_role where user_id = p_user_id;
  insert into public.audit_log(action,user_id,resource_type,resource_id,status,metadata)
  values ('member.role_changed',v_uid,'membership',p_user_id::text,'success',jsonb_build_object('role',p_role));
  return jsonb_build_object('userId',p_user_id,'role',p_role,'status',v_member.status);
end;
$$;
revoke all on function public.set_member_role(uuid,public.user_role) from public, anon;
grant execute on function public.set_member_role(uuid,public.user_role) to authenticated;

-- Private AI credential operations are exposed only as service_role RPCs. No
-- credential ciphertext is returned by listing/metadata functions. A unique active-key
-- hash index closes concurrent duplicate-key races.
create unique index if not exists uq_ai_credential_hash_active
  on private.ai_provider_credentials(credential_hash) where status <> 'disabled';
create or replace function public.ai_credential_store(
  p_user_id uuid, p_provider text, p_model_id text, p_encrypted text,
  p_nonce text, p_tag text, p_key_version text, p_credential_hash text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_row private.ai_provider_credentials%rowtype;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  if p_provider not in ('openai','gemini','groq','openrouter','anthropic') then raise exception 'Unsupported provider' using errcode = '22023'; end if;
  if p_credential_hash !~ '^[0-9a-f]{64}$' or p_key_version is null or p_key_version = '' then raise exception 'Invalid credential metadata' using errcode = '22023'; end if;
  insert into private.ai_provider_credentials(user_id,provider,model_id,encrypted,nonce,tag,key_version,credential_hash,status,usage_count,last_used_at)
  values (p_user_id,p_provider,p_model_id,p_encrypted,p_nonce,p_tag,p_key_version,p_credential_hash,'active',0,null)
  on conflict (user_id,provider) do update set model_id=excluded.model_id, encrypted=excluded.encrypted,
    nonce=excluded.nonce, tag=excluded.tag, key_version=excluded.key_version,
    credential_hash=excluded.credential_hash, status='active', updated_at=clock_timestamp()
  returning * into v_row;
  return jsonb_build_object('id',v_row.id,'userId',v_row.user_id,'provider',v_row.provider,'modelId',v_row.model_id,
    'credentialHash',v_row.credential_hash,'version',v_row.key_version,'createdAt',v_row.created_at,
    'updatedAt',v_row.updated_at,'lastUsedAt',v_row.last_used_at,'usageCount',v_row.usage_count,'status',v_row.status);
end;
$$;

create or replace function public.ai_credential_get(p_user_id uuid, p_id uuid default null, p_provider text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_row private.ai_provider_credentials%rowtype;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  select * into v_row from private.ai_provider_credentials
  where user_id=p_user_id and (p_id is null or id=p_id) and (p_provider is null or provider=p_provider)
    and status <> 'disabled'
  order by updated_at desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object('id',v_row.id,'userId',v_row.user_id,'provider',v_row.provider,'modelId',v_row.model_id,
    'encrypted',v_row.encrypted,'nonce',v_row.nonce,'tag',v_row.tag,'version',v_row.key_version,
    'credentialHash',v_row.credential_hash,'createdAt',v_row.created_at,'updatedAt',v_row.updated_at,
    'lastUsedAt',v_row.last_used_at,'usageCount',v_row.usage_count,'status',v_row.status);
end;
$$;

create or replace function public.ai_credential_list(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_items jsonb;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'userId',c.user_id,'provider',c.provider,'modelId',c.model_id,
    'version',c.key_version,'createdAt',c.created_at,'updatedAt',c.updated_at,'lastUsedAt',c.last_used_at,
    'usageCount',c.usage_count,'status',c.status) order by c.created_at desc),'[]'::jsonb)
  into v_items from private.ai_provider_credentials c where c.user_id=p_user_id;
  return v_items;
end;
$$;

create or replace function public.ai_credential_update(
  p_user_id uuid, p_id uuid, p_encrypted text, p_nonce text, p_tag text,
  p_key_version text, p_credential_hash text, p_model_id text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_row private.ai_provider_credentials%rowtype;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  if p_credential_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid credential hash' using errcode = '22023'; end if;
  update private.ai_provider_credentials set encrypted=p_encrypted,nonce=p_nonce,tag=p_tag,key_version=p_key_version,
    credential_hash=p_credential_hash,model_id=coalesce(p_model_id,model_id),status='rotated',updated_at=clock_timestamp()
  where id=p_id and user_id=p_user_id returning * into v_row;
  if not found then return null; end if;
  return jsonb_build_object('id',v_row.id,'userId',v_row.user_id,'provider',v_row.provider,'modelId',v_row.model_id,
    'version',v_row.key_version,'createdAt',v_row.created_at,'updatedAt',v_row.updated_at,
    'lastUsedAt',v_row.last_used_at,'usageCount',v_row.usage_count,'status',v_row.status);
end;
$$;

create or replace function public.ai_credential_disable(p_user_id uuid,p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  update private.ai_provider_credentials set status='disabled',updated_at=clock_timestamp() where id=p_id and user_id=p_user_id;
  return found;
end; $$;

create or replace function public.ai_credential_delete(p_user_id uuid,p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_deleted integer;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  delete from private.ai_provider_credentials where id=p_id and user_id=p_user_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end; $$;

create or replace function public.ai_credential_record_usage(p_user_id uuid,p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  update private.ai_provider_credentials set usage_count=usage_count+1,last_used_at=clock_timestamp(),updated_at=clock_timestamp()
  where id=p_id and user_id=p_user_id and status <> 'disabled';
  return found;
end; $$;

create or replace function public.ai_credential_hash_exists(p_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  return exists(select 1 from private.ai_provider_credentials where credential_hash=p_hash and status <> 'disabled');
end; $$;

create or replace function public.write_audit_event(
  p_action text,p_user_id uuid,p_resource_type text,p_resource_id text,
  p_status public.audit_status default 'success',p_error_message text default null,p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  insert into public.audit_log(action,user_id,resource_type,resource_id,status,error_message,metadata)
  values (left(p_action,100),p_user_id,left(p_resource_type,100),left(p_resource_id,200),p_status,left(p_error_message,500),coalesce(p_metadata,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.ai_credential_get_any(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row private.ai_provider_credentials%rowtype;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  select * into v_row from private.ai_provider_credentials where id=p_id;
  if not found then return null; end if;
  return jsonb_build_object('id',v_row.id,'userId',v_row.user_id,'provider',v_row.provider,'modelId',v_row.model_id,
    'encrypted',v_row.encrypted,'nonce',v_row.nonce,'tag',v_row.tag,'version',v_row.key_version,
    'credentialHash',v_row.credential_hash,'createdAt',v_row.created_at,'updatedAt',v_row.updated_at,
    'lastUsedAt',v_row.last_used_at,'usageCount',v_row.usage_count,'status',v_row.status);
end; $$;

create or replace function public.ai_credential_admin_list(
  p_user_id uuid default null,p_provider text default null,p_status text default null,
  p_limit integer default 100,p_offset integer default 0
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_items jsonb;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Service role required' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'userId',c.user_id,'provider',c.provider,'modelId',c.model_id,
    'createdAt',c.created_at,'updatedAt',c.updated_at,'lastUsedAt',c.last_used_at,'usageCount',c.usage_count,'status',c.status)
    order by c.created_at desc),'[]'::jsonb) into v_items
  from (select * from private.ai_provider_credentials
    where (p_user_id is null or user_id=p_user_id)
      and (p_provider is null or provider=p_provider)
      and (p_status is null or status=p_status)
    order by created_at desc limit greatest(1,least(coalesce(p_limit,100),200)) offset greatest(coalesce(p_offset,0),0)) c;
  return v_items;
end; $$;

-- Functions returning encrypted material or mutating private credentials are
-- executable only by the server's service-role JWT, never authenticated users.
revoke all on function public.ai_credential_store(uuid,text,text,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.ai_credential_get(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.ai_credential_get_any(uuid) from public,anon,authenticated;
revoke all on function public.ai_credential_admin_list(uuid,text,text,integer,integer) from public,anon,authenticated;
revoke all on function public.ai_credential_list(uuid) from public,anon,authenticated;
revoke all on function public.ai_credential_update(uuid,uuid,text,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.ai_credential_disable(uuid,uuid) from public,anon,authenticated;
revoke all on function public.ai_credential_delete(uuid,uuid) from public,anon,authenticated;
revoke all on function public.ai_credential_record_usage(uuid,uuid) from public,anon,authenticated;
revoke all on function public.ai_credential_hash_exists(text) from public,anon,authenticated;
revoke all on function public.write_audit_event(text,uuid,text,text,public.audit_status,text,jsonb) from public,anon,authenticated;
grant execute on function public.ai_credential_store(uuid,text,text,text,text,text,text,text) to service_role;
grant execute on function public.ai_credential_get(uuid,uuid,text) to service_role;
grant execute on function public.ai_credential_get_any(uuid) to service_role;
grant execute on function public.ai_credential_admin_list(uuid,text,text,integer,integer) to service_role;
grant execute on function public.ai_credential_list(uuid) to service_role;
grant execute on function public.ai_credential_update(uuid,uuid,text,text,text,text,text,text) to service_role;
grant execute on function public.ai_credential_disable(uuid,uuid) to service_role;
grant execute on function public.ai_credential_delete(uuid,uuid) to service_role;
grant execute on function public.ai_credential_record_usage(uuid,uuid) to service_role;
grant execute on function public.ai_credential_hash_exists(text) to service_role;
grant execute on function public.write_audit_event(text,uuid,text,text,public.audit_status,text,jsonb) to service_role;

commit;
