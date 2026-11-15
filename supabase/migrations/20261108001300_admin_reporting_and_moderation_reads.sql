-- Owner/moderator reporting surfaces. Sensitive object keys and hashes are never returned.
begin;

create or replace function public.admin_dashboard_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_moderator_or_owner() then
    raise exception 'Moderator access required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'members', jsonb_build_object(
      'total', (select count(*) from public.memberships),
      'approved', (select count(*) from public.memberships where status = 'approved'),
      'pending', (select count(*) from public.memberships where status = 'pending'),
      'suspended', (select count(*) from public.memberships where status = 'suspended')
    ),
    'joinRequests', jsonb_build_object(
      'pending', (select count(*) from public.join_requests where status = 'pending'),
      'approved', (select count(*) from public.join_requests where status = 'approved'),
      'rejected', (select count(*) from public.join_requests where status = 'rejected')
    ),
    'resources', jsonb_build_object(
      'total', (select count(*) from public.resources where not is_deleted),
      'pending', (select count(*) from public.resources where not is_deleted and status = 'pending'),
      'verified', (select count(*) from public.resources where not is_deleted and status = 'verified'),
      'bytesTracked', (select coalesce(sum(file_size),0) from public.resources where not is_deleted)
    )
  );
end;
$$;

create or replace function public.admin_list_resources(
  p_status text default null,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(
  id uuid, title text, description text, paper public.question_section,
  subject_name text, topic_name text, file_type text, file_size bigint,
  status public.resource_status, uploader_name text, uploaded_by uuid,
  created_at timestamptz, download_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_moderator_or_owner() then
    raise exception 'Moderator access required' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('pending','verified','rejected','unverified') then
    raise exception 'Invalid resource status' using errcode = '22023';
  end if;
  return query
    select r.id, r.title, r.description, r.paper, s.name, t.name, r.file_type,
      r.file_size, r.status, p.display_name, r.uploaded_by, r.created_at, r.download_count
    from public.resources r
    left join public.subjects s on s.id = r.subject_id
    left join public.topics t on t.id = r.topic_id
    left join public.user_profiles p on p.id = r.uploaded_by
    where not r.is_deleted
      and (p_status is null or r.status::text = p_status)
      and (p_search is null or r.title ilike '%' || p_search || '%' or coalesce(r.description,'') ilike '%' || p_search || '%')
    order by case when r.status = 'pending' then 0 else 1 end, r.created_at desc
    limit greatest(1, least(coalesce(p_limit,50),100))
    offset greatest(coalesce(p_offset,0),0);
end;
$$;

create or replace function public.admin_count_resources(p_status text default null,p_search text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_moderator_or_owner() then
    raise exception 'Moderator access required' using errcode = '42501';
  end if;
  if p_status is not null and p_status not in ('pending','verified','rejected','unverified') then
    raise exception 'Invalid resource status' using errcode = '22023';
  end if;
  return (select count(*) from public.resources r
    where not r.is_deleted and (p_status is null or r.status::text=p_status)
      and (p_search is null or r.title ilike '%'||p_search||'%' or coalesce(r.description,'') ilike '%'||p_search||'%'));
end;
$$;

create or replace function public.admin_storage_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_breakdown jsonb; v_largest jsonb;
begin
  if auth.uid() is null or not public.is_moderator_or_owner() then
    raise exception 'Moderator access required' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('fileType',x.file_type,'count',x.file_count,'bytes',x.bytes) order by x.file_type),'[]'::jsonb)
    into v_breakdown
  from (select r.file_type,count(*)::bigint file_count,coalesce(sum(r.file_size),0)::bigint bytes
        from public.resources r where not r.is_deleted group by r.file_type) x;
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'title',x.title,'paper',x.paper,
      'fileType',x.file_type,'fileSize',x.file_size,'createdAt',x.created_at) order by x.file_size desc),'[]'::jsonb)
    into v_largest
  from (select id,title,paper,file_type,file_size,created_at from public.resources
        where not is_deleted order by file_size desc limit 10) x;
  return jsonb_build_object(
    'totalCount',(select count(*) from public.resources where not is_deleted),
    'totalBytes',(select coalesce(sum(file_size),0) from public.resources where not is_deleted),
    'pendingCount',(select count(*) from public.resources where not is_deleted and status='pending'),
    'breakdown',v_breakdown,'largestFiles',v_largest,
    'scope','Database-tracked resource records; not a live Cloudflare account quota or bucket inventory'
  );
end;
$$;

create or replace function public.admin_list_audit_events(p_search text default null,p_limit integer default 50,p_offset integer default 0)
returns table(
  id uuid, action text, actor_id uuid, actor_name text, resource_type text,
  resource_id text, status public.audit_status, error_message text,
  metadata jsonb, created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_platform_owner() then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  return query
    select a.id,a.action,a.user_id,p.display_name,a.resource_type,a.resource_id,a.status,
      a.error_message,a.metadata,a.created_at
    from public.audit_log a left join public.user_profiles p on p.id=a.user_id
    where p_search is null or a.action ilike '%'||p_search||'%'
      or a.resource_type ilike '%'||p_search||'%'
      or coalesce(p.display_name,'') ilike '%'||p_search||'%'
      or a.resource_id ilike '%'||p_search||'%'
    order by a.created_at desc,a.id desc
    limit greatest(1,least(coalesce(p_limit,50),100)) offset greatest(coalesce(p_offset,0),0);
end;
$$;

revoke all on function public.admin_dashboard_summary() from public,anon;
revoke all on function public.admin_list_resources(text,text,integer,integer) from public,anon;
revoke all on function public.admin_count_resources(text,text) from public,anon;
revoke all on function public.admin_storage_summary() from public,anon;
revoke all on function public.admin_list_audit_events(text,integer,integer) from public,anon;
grant execute on function public.admin_dashboard_summary() to authenticated;
grant execute on function public.admin_list_resources(text,text,integer,integer) to authenticated;
grant execute on function public.admin_count_resources(text,text) to authenticated;
grant execute on function public.admin_storage_summary() to authenticated;
grant execute on function public.admin_list_audit_events(text,integer,integer) to authenticated;

commit;
