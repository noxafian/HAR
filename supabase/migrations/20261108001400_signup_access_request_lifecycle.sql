-- Every new account receives one owner-reviewable join request in the same
-- transaction as profile and pending-membership provisioning.
begin;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_papers public.exam_paper[];
  v_message text;
begin
  v_name := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, 'student@example.invalid'), '@', 1)),64);
  if char_length(v_name) < 2 then v_name := 'Student'; end if;
  select coalesce(array_agg(paper_code::public.exam_paper), array['CS']::public.exam_paper[])
    into v_papers
    from (select distinct value as paper_code from jsonb_array_elements_text(
      case when jsonb_typeof(new.raw_user_meta_data -> 'exam_papers') = 'array'
        then new.raw_user_meta_data -> 'exam_papers' else '["CS"]'::jsonb end
    ) as x(value) where value in ('CS','DA')) selected;
  if cardinality(v_papers) = 0 then v_papers := array['CS']::public.exam_paper[]; end if;
  v_message := nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'join_message','')),500),'');

  insert into public.user_profiles(id,email,display_name,avatar_url,exam_papers)
  values(new.id,coalesce(new.email,''),v_name,new.raw_user_meta_data ->> 'avatar_url',v_papers)
  on conflict(id) do nothing;
  insert into public.memberships(user_id,role,status)
  values(new.id,'member','pending')
  on conflict(user_id) do nothing;
  insert into public.join_requests(user_id,email,display_name,message)
  values(new.id,coalesce(new.email,''),v_name,v_message)
  on conflict(user_id) where status='pending' do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_auth_user() from public,anon,authenticated;

commit;
