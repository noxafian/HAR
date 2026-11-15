begin;

create or replace function public.submit_member_question(
  p_question jsonb,
  p_correct_answer jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_question_id uuid;
  v_type public.question_type;
  v_section public.question_section;
  v_category public.content_category;
  v_options jsonb;
  v_answer_type text;
begin
  if v_user_id is null or not public.is_approved_member() then
    raise exception 'Approved membership required' using errcode = '42501';
  end if;
  v_type := (p_question->>'type')::public.question_type;
  v_section := coalesce((p_question->>'section')::public.question_section, 'CS'::public.question_section);
  v_category := (p_question->>'category')::public.content_category;
  if v_category not in ('member-contributed','ai-generated') then
    raise exception 'Unsupported question category' using errcode = '22023';
  end if;
  v_options := p_question->'options';
  if p_correct_answer is not null then
    v_answer_type := jsonb_typeof(p_correct_answer);
    if (v_type = 'MCQ' and v_answer_type <> 'string')
      or (v_type = 'MSQ' and v_answer_type <> 'array')
      or (v_type = 'NAT' and v_answer_type <> 'number') then
      raise exception 'Answer format does not match question type' using errcode = '22023';
    end if;
  end if;
  insert into public.questions(type,category,section,year,subject_id,topic_id,prompt,options,marks,difficulty,source_ref,solution,submitted_by)
  values (
    v_type, v_category, v_section, nullif(p_question->>'year','')::integer,
    nullif(p_question->>'subject_id','')::uuid, nullif(p_question->>'topic_id','')::uuid,
    p_question->>'prompt', case when v_type = 'NAT' then null else coalesce(v_options,'[]'::jsonb) end,
    coalesce(nullif(p_question->>'marks','')::numeric,1), nullif(p_question->>'difficulty',''),
    nullif(p_question->>'source_ref',''), nullif(p_question->>'solution',''), v_user_id
  ) returning id into v_question_id;
  if p_correct_answer is not null then
    if v_type = 'MCQ' and not exists (
      select 1 from jsonb_array_elements(v_options) opt
      where opt->>'id' = p_correct_answer #>> '{}'
    ) then
      raise exception 'MCQ answer must reference an available option id' using errcode = '22023';
    elsif v_type = 'MSQ' and (
      jsonb_array_length(p_correct_answer) = 0
      or exists (
        select 1 from jsonb_array_elements_text(p_correct_answer) selected(option_id)
        where not exists (select 1 from jsonb_array_elements(v_options) opt where opt->>'id' = selected.option_id)
      )
      or jsonb_array_length(p_correct_answer) <> (select count(distinct option_id) from jsonb_array_elements_text(p_correct_answer) selected(option_id))
    ) then
      raise exception 'MSQ answer must contain unique available option ids' using errcode = '22023';
    end if;
    insert into private.question_answer_keys(question_id,correct_answer)
      values (v_question_id,p_correct_answer);
  end if;
  return v_question_id;
end;
$$;

create or replace function public.moderate_question(
  p_question_id uuid,
  p_action text,
  p_solution text default null,
  p_correct_answer jsonb default null,
  p_nat_tolerance numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question public.questions%rowtype;
begin
  if auth.uid() is null or not public.is_moderator_or_owner() then
    raise exception 'Moderator or owner required' using errcode = '42501';
  end if;
  select * into v_question from public.questions where id = p_question_id for update;
  if not found then raise exception 'Question not found' using errcode = 'P0002'; end if;
  if p_action = 'delete' then
    update public.questions set is_deleted = true, is_verified = false where id = p_question_id;
  elsif p_action = 'reject' then
    update public.questions set is_deleted = true, is_verified = false where id = p_question_id;
  elsif p_action = 'verify' then
    if p_solution is not null then
      update public.questions set solution = p_solution where id = p_question_id;
    end if;
    if p_correct_answer is not null then
      if v_question.type = 'MCQ' and jsonb_typeof(p_correct_answer) <> 'string' then
        raise exception 'MCQ answer must be a string option id' using errcode = '22023';
      elsif v_question.type = 'MSQ' and (jsonb_typeof(p_correct_answer) <> 'array' or jsonb_array_length(p_correct_answer) = 0) then
        raise exception 'MSQ answer must be a non-empty array' using errcode = '22023';
      elsif v_question.type = 'NAT' and jsonb_typeof(p_correct_answer) <> 'number' then
        raise exception 'NAT answer must be numeric' using errcode = '22023';
      end if;
      insert into private.question_answer_keys(question_id,correct_answer,nat_tolerance)
      values (p_question_id,p_correct_answer,p_nat_tolerance)
      on conflict (question_id) do update set correct_answer = excluded.correct_answer,
        nat_tolerance = excluded.nat_tolerance, updated_at = now();
    end if;
    if not exists (select 1 from private.question_answer_keys where question_id = p_question_id) then
      raise exception 'Question cannot be verified without an answer key' using errcode = '23514';
    end if;
    update public.questions set is_verified = true, is_deleted = false where id = p_question_id;
  else
    raise exception 'Invalid moderation action' using errcode = '22023';
  end if;
  return p_question_id;
end;
$$;

create or replace function public.soft_delete_discussion(p_discussion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_moderator_or_owner() then
    raise exception 'Moderator or owner required' using errcode = '42501';
  end if;
  update public.discussions set is_deleted = true where id = p_discussion_id and not is_deleted;
  if not found then raise exception 'Discussion not found' using errcode = 'P0002'; end if;
end;
$$;

revoke all on function public.submit_member_question(jsonb,jsonb) from public, anon;
revoke all on function public.moderate_question(uuid,text,text,jsonb,numeric) from public, anon;
revoke all on function public.soft_delete_discussion(uuid) from public, anon;
grant execute on function public.submit_member_question(jsonb,jsonb) to authenticated;
grant execute on function public.moderate_question(uuid,text,text,jsonb,numeric) to authenticated;
grant execute on function public.soft_delete_discussion(uuid) to authenticated;


create or replace function private.sync_discussion_reply_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_discussion_id uuid := coalesce(new.discussion_id, old.discussion_id);
begin
  update public.discussions d
    set reply_count = (select count(*) from public.discussion_replies r where r.discussion_id = v_discussion_id and not r.is_deleted)
    where d.id = v_discussion_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger trg_discussion_reply_count
  after insert or update of is_deleted or delete on public.discussion_replies
  for each row execute function private.sync_discussion_reply_count();

commit;
