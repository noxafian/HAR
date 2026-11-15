-- Persistent spaced revision scheduling and immutable review history.
begin;

alter table public.revision_items alter column topic_id drop not null;
alter table public.revision_items
  add column if not exists subject_id uuid references public.subjects(id) on delete set null,
  add column if not exists topic_label text,
  add column if not exists interval_days integer not null default 7 check (interval_days between 1 and 365);
alter table public.revision_items
  add constraint revision_items_topic_source_check
  check (topic_id is not null or (topic_label is not null and char_length(btrim(topic_label)) between 1 and 100));

create table public.revision_history (
  id uuid primary key default gen_random_uuid(),
  revision_item_id uuid references public.revision_items(id) on delete set null,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_label text not null,
  reviewed_at timestamptz not null default clock_timestamp(),
  interval_days integer not null check (interval_days between 1 and 365),
  revision_number integer not null check (revision_number > 0)
);
create index revision_history_user_reviewed_idx on public.revision_history(user_id, reviewed_at desc);
alter table public.revision_history enable row level security;
create policy revision_history_select_own on public.revision_history
  for select to authenticated using (user_id = auth.uid() and public.is_approved_member());
grant select on public.revision_history to authenticated;

create or replace function public.complete_revision_item(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_membership public.memberships%rowtype;
  v_item public.revision_items%rowtype;
  v_topic_label text;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_membership from public.memberships where user_id = v_uid for share;
  if not found or v_membership.status <> 'approved' then
    raise exception 'Approved membership required' using errcode = '42501';
  end if;
  select * into v_item from public.revision_items
    where id = p_item_id and user_id = v_uid for update;
  if not found then raise exception 'Revision item not found' using errcode = 'P0002'; end if;
  select coalesce(v_item.topic_label, t.name) into v_topic_label
    from (select 1) seed left join public.topics t on t.id = v_item.topic_id;
  if v_topic_label is null then raise exception 'Revision item has no topic label' using errcode = '23514'; end if;

  insert into public.revision_history(revision_item_id,user_id,subject_id,topic_label,interval_days,revision_number)
  values (v_item.id,v_uid,v_item.subject_id,v_topic_label,v_item.interval_days,v_item.revision_count + 1);

  update public.revision_items set
    status = 'not-started',
    scheduled_date = current_date + v_item.interval_days,
    last_revised_at = clock_timestamp(),
    revision_count = v_item.revision_count + 1,
    updated_at = clock_timestamp()
  where id = v_item.id;

  return jsonb_build_object('id',v_item.id,'scheduledDate',current_date + v_item.interval_days,
    'intervalDays',v_item.interval_days,'revisionCount',v_item.revision_count + 1);
end;
$$;
revoke all on function public.complete_revision_item(uuid) from public, anon;
grant execute on function public.complete_revision_item(uuid) to authenticated;

commit;
