-- Preserve the exam paper/section selected for uploaded resources.
begin;

alter table private.resource_upload_intents
  add column paper public.question_section not null default 'CS';

drop function public.create_resource_upload_intent(uuid,text,text,text,text,text,bigint,uuid,uuid,text);

create function public.create_resource_upload_intent(
  p_user_id uuid,
  p_title text,
  p_description text,
  p_file_name text,
  p_file_type text,
  p_content_type text,
  p_file_size bigint,
  p_paper public.question_section,
  p_subject_id uuid,
  p_topic_id uuid,
  p_object_key text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_expires timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.memberships
    where user_id = p_user_id and status = 'approved'
  ) then
    raise exception 'Approved membership required' using errcode = '42501';
  end if;
  if p_title is null or char_length(trim(p_title)) not between 1 and 255
     or p_file_name is null or char_length(p_file_name) not between 1 and 255
     or p_file_type not in ('pdf','png','jpg','jpeg','docx','pptx','txt')
     or p_file_size not between 1 and 52428800
     or p_paper is null
     or p_object_key is null or p_object_key !~ '^resources/[0-9a-f-]{36}[.][a-z0-9]{2,5}$' then
    raise exception 'Invalid upload intent' using errcode = '22023';
  end if;
  if p_subject_id is not null and not exists (select 1 from public.subjects where id = p_subject_id) then
    raise exception 'Unknown subject' using errcode = '22023';
  end if;
  if p_topic_id is not null and not exists (select 1 from public.topics where id = p_topic_id) then
    raise exception 'Unknown topic' using errcode = '22023';
  end if;
  v_expires := clock_timestamp() + interval '15 minutes';
  insert into private.resource_upload_intents(
    user_id, title, description, file_name, file_type, content_type, file_size,
    paper, subject_id, topic_id, object_key, expires_at
  ) values (
    p_user_id, trim(p_title), p_description, p_file_name, p_file_type, p_content_type,
    p_file_size, p_paper, p_subject_id, p_topic_id, p_object_key, v_expires
  ) returning id into v_id;
  return jsonb_build_object('id', v_id, 'objectKey', p_object_key, 'expiresAt', v_expires);
end;
$$;

create or replace function public.get_resource_upload_intent(p_user_id uuid, p_intent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.resource_upload_intents%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  select * into v_row from private.resource_upload_intents
  where id = p_intent_id and user_id = p_user_id;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', v_row.id, 'userId', v_row.user_id, 'title', v_row.title,
    'description', v_row.description, 'fileName', v_row.file_name,
    'fileType', v_row.file_type, 'contentType', v_row.content_type,
    'fileSize', v_row.file_size, 'paper', v_row.paper,
    'subjectId', v_row.subject_id, 'topicId', v_row.topic_id,
    'objectKey', v_row.object_key, 'expiresAt', v_row.expires_at,
    'completedAt', v_row.completed_at, 'resourceId', v_row.resource_id,
    'duplicate', v_row.duplicate
  );
end;
$$;

create or replace function public.complete_resource_upload(p_user_id uuid, p_intent_id uuid, p_content_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.resource_upload_intents%rowtype;
  v_resource_id uuid;
  v_duplicate boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid content hash' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.memberships
    where user_id = p_user_id and status = 'approved'
  ) then
    raise exception 'Approved membership required' using errcode = '42501';
  end if;
  select * into v_row from private.resource_upload_intents
  where id = p_intent_id and user_id = p_user_id
  for update;
  if not found then raise exception 'Upload intent not found' using errcode = 'P0002'; end if;
  if v_row.completed_at is not null and v_row.resource_id is not null then
    return jsonb_build_object('resourceId', v_row.resource_id, 'alreadyCompleted', true, 'duplicate', v_row.duplicate);
  end if;
  if clock_timestamp() >= v_row.expires_at then
    raise exception 'Upload intent expired' using errcode = '55000';
  end if;

  insert into public.resources(
    title, description, paper, subject_id, topic_id, file_type, file_size,
    object_key, content_hash, status, uploaded_by
  ) values (
    v_row.title, v_row.description, v_row.paper, v_row.subject_id, v_row.topic_id,
    v_row.file_type, v_row.file_size, v_row.object_key, p_content_hash, 'pending', p_user_id
  ) on conflict (uploaded_by, content_hash) where not is_deleted do nothing
  returning id into v_resource_id;

  if v_resource_id is null then
    select id into v_resource_id from public.resources
    where uploaded_by = p_user_id and content_hash = p_content_hash and not is_deleted
    order by created_at desc limit 1;
    v_duplicate := true;
  end if;
  update private.resource_upload_intents
  set completed_at = clock_timestamp(), resource_id = v_resource_id, duplicate = v_duplicate
  where id = p_intent_id;
  return jsonb_build_object('resourceId', v_resource_id, 'alreadyCompleted', false, 'duplicate', v_duplicate);
end;
$$;

revoke all on function public.create_resource_upload_intent(uuid,text,text,text,text,text,bigint,public.question_section,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.get_resource_upload_intent(uuid,uuid) from public, anon, authenticated;
revoke all on function public.complete_resource_upload(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.create_resource_upload_intent(uuid,text,text,text,text,text,bigint,public.question_section,uuid,uuid,text) to service_role;
grant execute on function public.get_resource_upload_intent(uuid,uuid) to service_role;
grant execute on function public.complete_resource_upload(uuid,uuid,text) to service_role;

commit;
