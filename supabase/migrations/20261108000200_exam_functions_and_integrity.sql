-- Keryvion StudyHub — exam engine, publication immutability and server RPCs.
-- All user-bound SECURITY DEFINER functions derive identity from auth.uid().

begin;

-- The exam paper is inferred from the mock test; only GA-section questions are shared.
create or replace function private.enforce_mock_question_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_paper public.exam_paper;
  v_status public.mock_test_status;
  v_section public.question_section;
begin
  if tg_op = 'UPDATE' and exists (
    select 1 from public.mock_tests old_test where old_test.id = old.mock_test_id and old_test.status in ('published','archived')
  ) then
    raise exception 'Published test question sets are immutable' using errcode = '55000';
  end if;
  select paper, status into v_paper, v_status
  from public.mock_tests where id = new.mock_test_id;
  if not found then raise exception 'Mock test not found' using errcode = 'P0002'; end if;
  if v_status <> 'draft' then raise exception 'Published test question sets are immutable' using errcode = '55000'; end if;
  select section into v_section from public.questions where id = new.question_id and not is_deleted;
  if not found then raise exception 'Question not found' using errcode = 'P0002'; end if;
  if v_section::text not in (v_paper::text, 'GA') then
    raise exception 'Question section % cannot be included in % mock test', v_section, v_paper using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger mock_question_scope_guard
before insert or update on public.mock_test_questions
for each row execute function private.enforce_mock_question_scope();

create or replace function private.guard_published_mock_question_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.mock_tests mt
    where mt.id = old.mock_test_id and mt.status in ('published','archived')
  ) then
    raise exception 'Published test question sets are immutable' using errcode = '55000';
  end if;
  return old;
end;
$$;
create trigger mock_question_delete_guard
before delete on public.mock_test_questions
for each row execute function private.guard_published_mock_question_delete();

-- Draft -> published is atomic and validates that the complete test can be scored.
create or replace function private.validate_mock_test_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question_count integer;
  v_total_marks numeric(16,10);
  v_missing_keys integer;
begin
  if tg_op = 'INSERT' and new.status <> 'draft' then
    raise exception 'Create a draft test and publish it after adding questions' using errcode = '55000';
  end if;

  if tg_op = 'UPDATE' and old.status in ('published','archived') then
    if new.id is distinct from old.id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
      or new.title is distinct from old.title
      or new.paper is distinct from old.paper
      or new.duration_minutes is distinct from old.duration_minutes
      or new.marking_config_id is distinct from old.marking_config_id
      or new.total_questions is distinct from old.total_questions
      or new.total_marks is distinct from old.total_marks
      or new.published_at is distinct from old.published_at
      or (old.status = 'archived' and new.status <> 'archived')
      or (old.status = 'published' and new.status not in ('published','archived')) then
      raise exception 'Published mock test definition is immutable' using errcode = '55000';
    end if;
    if old.status = 'archived' and new.is_available then
      raise exception 'Archived mock tests cannot be made available' using errcode = '55000';
    end if;
    return new;
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status = 'draft') then
    select count(*), coalesce(sum(q.marks), 0)
      into v_question_count, v_total_marks
    from public.mock_test_questions mtq
    join public.questions q on q.id = mtq.question_id
    where mtq.mock_test_id = new.id and not q.is_deleted and q.is_verified;

    if v_question_count = 0 then
      raise exception 'Cannot publish an empty test' using errcode = '23514';
    end if;

    if exists (
      select 1 from public.mock_test_questions mtq
      join public.questions q on q.id = mtq.question_id
      where mtq.mock_test_id = new.id and q.section::text not in (new.paper::text, 'GA')
    ) then
      raise exception 'Mock test contains a question from the wrong paper section' using errcode = '23514';
    end if;

    select count(*) into v_missing_keys
    from public.mock_test_questions mtq
    join public.questions q on q.id = mtq.question_id
    left join private.question_answer_keys ak on ak.question_id = q.id
    where mtq.mock_test_id = new.id and (ak.question_id is null or q.is_deleted or not q.is_verified);
    if v_missing_keys > 0 then
      raise exception 'Every published question must be verified and have an answer key' using errcode = '23514';
    end if;

    if not exists (select 1 from public.marking_configurations mc where mc.id = new.marking_config_id) then
      raise exception 'Marking configuration not found' using errcode = '23503';
    end if;

    new.published_at := coalesce(new.published_at, statement_timestamp());
    new.total_questions := v_question_count;
    new.total_marks := v_total_marks;
    update public.marking_configurations set is_published = true where id = new.marking_config_id;
  end if;
  return new;
end;
$$;
create trigger mock_test_publish_guard
before insert or update on public.mock_tests
for each row execute function private.validate_mock_test_publish();

create or replace function private.prevent_published_mock_test_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status in ('published','archived') then
    raise exception 'Published mock tests must be archived, not deleted' using errcode = '55000';
  end if;
  return old;
end;
$$;
create trigger published_mock_test_delete_guard
before delete on public.mock_tests
for each row execute function private.prevent_published_mock_test_delete();

create or replace function private.guard_published_question_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question_id uuid;
begin
  v_question_id := old.id;
  if exists (
    select 1 from public.mock_test_questions mtq
    join public.mock_tests mt on mt.id = mtq.mock_test_id
    where mtq.question_id = v_question_id and mt.status in ('published','archived')
  ) then
    raise exception 'Question used by a published test is immutable' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger published_question_mutation_guard
before update or delete on public.questions
for each row execute function private.guard_published_question_mutation();

create or replace function private.guard_answer_key_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question_id uuid;
  v_type public.question_type;
begin
  v_question_id := case when tg_op = 'INSERT' then new.question_id else old.question_id end;
  if exists (
    select 1 from public.mock_test_questions mtq
    join public.mock_tests mt on mt.id = mtq.mock_test_id
    where mtq.question_id = v_question_id and mt.status in ('published','archived')
  ) then
    raise exception 'Answer key used by a published test is immutable' using errcode = '55000';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if tg_op = 'UPDATE' and new.question_id is distinct from old.question_id and exists (
    select 1 from public.mock_test_questions mtq join public.mock_tests mt on mt.id=mtq.mock_test_id
    where mtq.question_id=new.question_id and mt.status in ('published','archived')
  ) then raise exception 'Cannot reassign an answer key used by a published test' using errcode = '55000'; end if;

  select type into v_type from public.questions where id = new.question_id;
  if not found then raise exception 'Question not found' using errcode = '23503'; end if;
  if new.correct_answer = 'null'::jsonb then
    raise exception 'Answer key cannot be JSON null' using errcode = '23514';
  elsif v_type = 'MCQ' and jsonb_typeof(new.correct_answer) <> 'string' then
    raise exception 'MCQ answer key must be a string option id' using errcode = '23514';
  elsif v_type = 'MSQ' and (jsonb_typeof(new.correct_answer) <> 'array' or jsonb_array_length(new.correct_answer) = 0) then
    raise exception 'MSQ answer key must be a non-empty array' using errcode = '23514';
  elsif v_type = 'NAT' and jsonb_typeof(new.correct_answer) not in ('number','string') then
    raise exception 'NAT answer key must be numeric' using errcode = '23514';
  end if;
  if v_type in ('MCQ','MSQ') and exists (
    select 1 from jsonb_array_elements_text(
      case when v_type='MCQ' then jsonb_build_array(new.correct_answer #>> '{}') else new.correct_answer end
    ) selected(option_id)
    where not exists (select 1 from public.questions q, jsonb_array_elements(q.options) option_row
      where q.id=new.question_id and option_row ->> 'id'=selected.option_id)
  ) then raise exception 'Answer key references an unknown option id' using errcode = '23514'; end if;
  if v_type='MSQ' and (select count(*) from jsonb_array_elements_text(new.correct_answer)) <>
      (select count(distinct value) from jsonb_array_elements_text(new.correct_answer) as valueset(value)) then
    raise exception 'MSQ answer key contains duplicate option ids' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger answer_key_mutation_guard
before insert or update or delete on private.question_answer_keys
for each row execute function private.guard_answer_key_mutation();

create or replace function private.guard_marking_configuration_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_published or exists (select 1 from public.mock_tests mt where mt.marking_config_id = old.id) then
      raise exception 'Marking configuration referenced by a test is immutable' using errcode = '55000';
    end if;
    return old;
  end if;
  if old.is_published and (
    new.name is distinct from old.name
    or new.description is distinct from old.description
    or new.mcq_1m_negative_numerator is distinct from old.mcq_1m_negative_numerator
    or new.mcq_2m_negative_numerator is distinct from old.mcq_2m_negative_numerator
    or new.mcq_negative_denominator is distinct from old.mcq_negative_denominator
    or new.is_published is distinct from old.is_published
    or new.default_nat_tolerance is distinct from old.default_nat_tolerance
  ) then
    raise exception 'Published marking configuration is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger marking_configuration_guard
before update or delete on public.marking_configurations
for each row execute function private.guard_marking_configuration_mutation();

create or replace function private.prevent_exam_result_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Exam results are append-only' using errcode = '55000';
end;
$$;
create trigger exam_results_immutable
before update or delete on public.exam_results
for each row execute function private.prevent_exam_result_mutation();

-- A single transaction-scoped advisory lock serializes concurrent session creation
-- for one (user, test) pair. No stale active session can be returned.
create or replace function public.create_exam_session(p_mock_test_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_membership public.memberships%rowtype;
  v_test public.mock_tests%rowtype;
  v_config public.marking_configurations%rowtype;
  v_session_id uuid;
  v_count integer;
  v_max_marks numeric(16,10);
  v_started_at timestamptz := clock_timestamp();
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_membership from public.memberships where user_id = v_uid for share;
  if not found or v_membership.status <> 'approved' then
    raise exception 'Approved membership required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || p_mock_test_id::text, 0));
  v_started_at := clock_timestamp();

  select * into v_test from public.mock_tests
  where id = p_mock_test_id and status = 'published' and is_available;
  if not found then raise exception 'Mock test unavailable' using errcode = 'P0002'; end if;

  update public.exam_sessions set status = 'expired'
  where user_id = v_uid and mock_test_id = p_mock_test_id
    and status = 'active' and expires_at <= v_started_at;

  select id into v_session_id from public.exam_sessions
  where user_id = v_uid and mock_test_id = p_mock_test_id and status = 'active'
  for update;
  if found then return v_session_id; end if;

  select * into v_config from public.marking_configurations where id = v_test.marking_config_id;
  select count(*), coalesce(sum(q.marks),0)
    into v_count, v_max_marks
  from public.mock_test_questions mtq
  join public.questions q on q.id = mtq.question_id
  where mtq.mock_test_id = p_mock_test_id;
  if v_count = 0 then raise exception 'Published test has no questions' using errcode = '23514'; end if;

  insert into public.exam_sessions (
    user_id, mock_test_id, paper, status, started_at, expires_at,
    marking_config_snapshot, question_count, max_possible_marks
  ) values (
    v_uid, p_mock_test_id, v_test.paper, 'active', v_started_at,
    v_started_at + make_interval(mins => v_test.duration_minutes),
    to_jsonb(v_config), v_count, v_max_marks
  ) returning id into v_session_id;
  return v_session_id;
end;
$$;
revoke all on function public.create_exam_session(uuid) from public, anon;
grant execute on function public.create_exam_session(uuid) to authenticated;

-- Save an answer as JSONB so MCQ strings, MSQ arrays, and NAT strings/numbers
-- keep their types. The session row lock serializes autosave with final scoring.
create or replace function public.save_exam_answer(
  p_session_id uuid,
  p_question_id uuid,
  p_answer jsonb,
  p_marked_review boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_membership public.memberships%rowtype;
  v_session public.exam_sessions%rowtype;
  v_question public.questions%rowtype;
  v_answer jsonb := p_answer;
  v_count integer;
  v_distinct_count integer;
  v_invalid_count integer;
  v_numeric numeric;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_membership from public.memberships where user_id = v_uid for share;
  if not found or v_membership.status <> 'approved' then
    raise exception 'Approved membership required' using errcode = '42501';
  end if;
  select * into v_session from public.exam_sessions
  where id = p_session_id and user_id = v_uid for update;
  if not found then raise exception 'Session not found' using errcode = 'P0002'; end if;
  if v_session.status = 'active' and clock_timestamp() >= v_session.expires_at then
    update public.exam_sessions set status = 'expired' where id = p_session_id;
    return jsonb_build_object('saved', false, 'status', 'expired');
  end if;
  if v_session.status <> 'active' then
    return jsonb_build_object('saved', false, 'status', 'session_' || v_session.status);
  end if;

  select q.* into v_question
  from public.questions q
  join public.mock_test_questions mtq on mtq.question_id = q.id
  where mtq.mock_test_id = v_session.mock_test_id and q.id = p_question_id;
  if not found then raise exception 'Question is not part of this session' using errcode = '22023'; end if;

  if v_answer = 'null'::jsonb then v_answer := null; end if;
  if v_answer is not null then
    if v_question.type = 'MCQ' then
      if jsonb_typeof(v_answer) <> 'string' or not exists (
        select 1 from jsonb_array_elements(v_question.options) option_row
        where option_row ->> 'id' = v_answer #>> '{}'
      ) then raise exception 'Invalid MCQ option' using errcode = '22023'; end if;
    elsif v_question.type = 'MSQ' then
      if jsonb_typeof(v_answer) <> 'array' then raise exception 'MSQ answer must be an array' using errcode = '22023'; end if;
      select count(*), count(distinct value), count(*) filter (where jsonb_typeof(value) <> 'string')
        into v_count, v_distinct_count, v_invalid_count
      from jsonb_array_elements(v_answer) as selected(value);
      if v_invalid_count > 0 or v_count <> v_distinct_count then
        raise exception 'MSQ selections must be unique option ids' using errcode = '22023';
      end if;
      if exists (
        select 1 from jsonb_array_elements_text(v_answer) selected(option_id)
        where not exists (
          select 1 from jsonb_array_elements(v_question.options) option_row
          where option_row ->> 'id' = selected.option_id
        )
      ) then raise exception 'Unknown MSQ option' using errcode = '22023'; end if;
    elsif v_question.type = 'NAT' then
      if jsonb_typeof(v_answer) not in ('string','number') then raise exception 'NAT answer must be numeric' using errcode = '22023'; end if;
      begin
        v_numeric := (v_answer #>> '{}')::numeric;
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Invalid NAT numeric answer' using errcode = '22023';
      end;
    end if;
  end if;

  insert into public.exam_answers(session_id, question_id, answer, marked_review)
  values (p_session_id, p_question_id, v_answer, coalesce(p_marked_review,false))
  on conflict (session_id, question_id)
  do update set answer = excluded.answer, marked_review = excluded.marked_review, saved_at = clock_timestamp();
  return jsonb_build_object('saved', true, 'status', 'saved', 'questionId', p_question_id);
end;
$$;
revoke all on function public.save_exam_answer(uuid,uuid,jsonb,boolean) from public, anon;
grant execute on function public.save_exam_answer(uuid,uuid,jsonb,boolean) to authenticated;

-- Score under a row lock. Ownership is checked before idempotency; membership
-- is re-read and share-locked so a suspension cannot race an in-flight save/submit.
create or replace function public.score_exam(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_membership public.memberships%rowtype;
  v_session public.exam_sessions%rowtype;
  v_existing public.exam_results%rowtype;
  v_config jsonb;
  v_question record;
  v_answer jsonb;
  v_correct_answer jsonb;
  v_outcome text;
  v_award numeric;
  v_total_raw numeric := 0;
  v_positive_raw numeric := 0;
  v_negative_numerator bigint := 0;
  v_negative_denominator integer := 3;
  v_max_marks numeric := 0;
  v_correct integer := 0;
  v_incorrect integer := 0;
  v_unanswered integer := 0;
  v_question_results jsonb := '[]'::jsonb;
  v_selected text[];
  v_key text[];
  v_student numeric;
  v_correct_numeric numeric;
  v_tolerance numeric;
  v_result_id uuid;
  v_duration integer;
  v_accuracy numeric(5,2);
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select * into v_membership from public.memberships where user_id = v_uid for share;
  if not found or v_membership.status <> 'approved' then
    raise exception 'Approved membership required' using errcode = '42501';
  end if;
  select * into v_session from public.exam_sessions
  where id = p_session_id and user_id = v_uid for update;
  if not found then raise exception 'Session not found' using errcode = 'P0002'; end if;

  select * into v_existing from public.exam_results where session_id = p_session_id;
  if found then
    return jsonb_build_object('resultId', v_existing.id, 'alreadyScored', true,
      'totalMarks', v_existing.total_marks, 'totalMarksRaw', v_existing.total_marks_raw,
      'maxPossibleMarks', v_existing.max_possible_marks,
      'correct', v_existing.correct_count, 'incorrect', v_existing.incorrect_count,
      'unanswered', v_existing.unanswered_count, 'accuracy', v_existing.accuracy,
      'durationSeconds', v_existing.duration_seconds,
      'questionResults', v_existing.question_results,
      'subjectBreakdown', v_existing.subject_breakdown);
  end if;
  if v_session.status = 'abandoned' then raise exception 'Abandoned session cannot be scored' using errcode = '55000'; end if;
  if v_session.status not in ('active','expired','submitted') then
    raise exception 'Session cannot be scored from state %', v_session.status using errcode = '55000';
  end if;

  if v_session.status = 'active' and clock_timestamp() >= v_session.expires_at then
    update public.exam_sessions set status = 'expired' where id = p_session_id;
  end if;
  v_config := v_session.marking_config_snapshot;

  for v_question in
    select q.id, q.type, q.marks, q.subject_id,
           ak.correct_answer, ak.nat_tolerance, ea.answer
    from public.mock_test_questions mtq
    join public.questions q on q.id = mtq.question_id
    left join private.question_answer_keys ak on ak.question_id = q.id
    left join public.exam_answers ea on ea.session_id = p_session_id and ea.question_id = q.id
    where mtq.mock_test_id = v_session.mock_test_id
    order by mtq.display_order
  loop
    if v_question.correct_answer is null then
      raise exception 'Published test is missing an answer key for question %', v_question.id using errcode = '23514';
    end if;
    v_answer := v_question.answer;
    v_correct_answer := v_question.correct_answer;
    v_max_marks := v_max_marks + v_question.marks;
    v_award := 0;

    if v_answer is null or v_answer = 'null'::jsonb or v_answer = '""'::jsonb or v_answer = '[]'::jsonb then
      v_outcome := 'unanswered';
      v_unanswered := v_unanswered + 1;
    elsif v_question.type = 'MCQ' then
      if upper(trim(v_answer #>> '{}')) = upper(trim(v_correct_answer #>> '{}')) then
        v_outcome := 'correct'; v_award := v_question.marks; v_correct := v_correct + 1;
      else
        v_outcome := 'incorrect';
        v_negative_numerator := v_negative_numerator + case
          when v_question.marks = 2 then (v_config ->> 'mcq_2m_negative_numerator')::integer
          else (v_config ->> 'mcq_1m_negative_numerator')::integer end;
        v_negative_denominator := (v_config ->> 'mcq_negative_denominator')::integer;
        v_award := -(case when v_question.marks = 2
          then (v_config ->> 'mcq_2m_negative_numerator')::numeric
          else (v_config ->> 'mcq_1m_negative_numerator')::numeric end) / v_negative_denominator;
        v_incorrect := v_incorrect + 1;
      end if;
    elsif v_question.type = 'MSQ' then
      select array_agg(selected.option_id order by selected.option_id)
        into v_selected from jsonb_array_elements_text(v_answer) selected(option_id);
      select array_agg(correct.option_id order by correct.option_id)
        into v_key from jsonb_array_elements_text(v_correct_answer) correct(option_id);
      if coalesce(v_selected, array[]::text[]) = coalesce(v_key, array[]::text[])
         and cardinality(v_selected) = cardinality(array(select distinct unnest(v_selected))) then
        v_outcome := 'correct'; v_award := v_question.marks; v_correct := v_correct + 1;
      else
        v_outcome := 'incorrect'; v_award := 0; v_incorrect := v_incorrect + 1;
      end if;
    else
      begin
        v_student := (v_answer #>> '{}')::numeric;
        v_correct_numeric := (v_correct_answer #>> '{}')::numeric;
        v_tolerance := coalesce(v_question.nat_tolerance, (v_config ->> 'default_nat_tolerance')::numeric, 0);
        if abs(v_student - v_correct_numeric) <= v_tolerance then
          v_outcome := 'correct'; v_award := v_question.marks; v_correct := v_correct + 1;
        else
          v_outcome := 'incorrect'; v_award := 0; v_incorrect := v_incorrect + 1;
        end if;
      exception when invalid_text_representation or numeric_value_out_of_range then
        v_outcome := 'incorrect'; v_award := 0; v_incorrect := v_incorrect + 1;
      end;
    end if;

    if v_outcome = 'correct' then v_positive_raw := v_positive_raw + v_award; end if;
    v_question_results := v_question_results || jsonb_build_array(jsonb_build_object(
      'questionId', v_question.id,
      'type', v_question.type,
      'studentAnswer', v_answer,
      'correctAnswer', v_correct_answer,
      'outcome', v_outcome,
      'marksAwarded', v_award,
      'maxMarks', v_question.marks
    ));
  end loop;

  v_total_raw := v_positive_raw - (v_negative_numerator::numeric / v_negative_denominator);

  if (v_correct + v_incorrect + v_unanswered) <> v_session.question_count then
    raise exception 'Published question count changed during session' using errcode = '23514';
  end if;
  v_accuracy := case when v_session.question_count = 0 then 0
    else round((v_correct::numeric / v_session.question_count) * 100, 2) end;
  v_duration := greatest(0, floor(extract(epoch from (least(clock_timestamp(), v_session.expires_at) - v_session.started_at)))::integer);

  insert into public.exam_results(
    session_id, user_id, total_marks_raw, total_marks, max_possible_marks,
    correct_count, incorrect_count, unanswered_count, accuracy, duration_seconds,
    question_results, subject_breakdown, marking_config_snapshot
  ) values (
    p_session_id, v_uid, v_total_raw, greatest(0,v_total_raw), v_max_marks,
    v_correct, v_incorrect, v_unanswered, v_accuracy, v_duration,
    v_question_results, '{}'::jsonb, v_config
  ) returning id into v_result_id;

  update public.exam_sessions set status = 'submitted', submitted_at = coalesce(submitted_at, clock_timestamp())
  where id = p_session_id;

  return jsonb_build_object('resultId', v_result_id, 'alreadyScored', false,
    'totalMarks', greatest(0,v_total_raw), 'totalMarksRaw', v_total_raw,
    'maxPossibleMarks', v_max_marks, 'correct', v_correct, 'incorrect', v_incorrect,
    'unanswered', v_unanswered, 'accuracy', v_accuracy, 'durationSeconds', v_duration,
    'questionResults', v_question_results);
end;
$$;
revoke all on function public.score_exam(uuid) from public, anon;
grant execute on function public.score_exam(uuid) to authenticated;

-- Security-definer function ownership is migration role; callers get execute only.
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function private.enforce_mock_question_scope() from public, anon, authenticated;
revoke all on function private.prevent_published_mock_test_delete() from public, anon, authenticated;
revoke all on function private.guard_published_mock_question_delete() from public, anon, authenticated;
revoke all on function private.validate_mock_test_publish() from public, anon, authenticated;
revoke all on function private.guard_published_question_mutation() from public, anon, authenticated;
revoke all on function private.guard_answer_key_mutation() from public, anon, authenticated;
revoke all on function private.guard_marking_configuration_mutation() from public, anon, authenticated;
revoke all on function private.prevent_exam_result_mutation() from public, anon, authenticated;

commit;
