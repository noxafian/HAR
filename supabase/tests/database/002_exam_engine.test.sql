-- Exam-engine transaction tests: session creation, answer type validation,
-- exact aggregate negative-mark numerator, idempotency and post-submit lockout.
select plan(10);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '20000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'exam-learner@example.invalid', '', now(), '{}'::jsonb,
  '{"display_name":"Exam Learner"}'::jsonb, now(), now()
) on conflict (id) do nothing;

update public.memberships
set status = 'approved', approved_at = now(), joined_at = now()
where user_id = '20000000-0000-4000-8000-000000000001';

insert into public.marking_configurations(name, description)
values ('pgTAP exam engine fixture', 'Isolated automated test fixture')
on conflict (name) do nothing;

insert into public.questions(id, type, category, section, subject_id, prompt, options, marks, is_verified)
values
  ('20000000-0000-4000-8000-000000000011', 'MCQ', 'official-pyq', 'CS', null, 'One-mark MCQ fixture prompt', '[{"id":"A","text":"Option A"},{"id":"B","text":"Option B"}]'::jsonb, 1, true),
  ('20000000-0000-4000-8000-000000000012', 'MCQ', 'official-pyq', 'CS', null, 'Two-mark MCQ fixture prompt', '[{"id":"A","text":"Option A"},{"id":"B","text":"Option B"}]'::jsonb, 2, true),
  ('20000000-0000-4000-8000-000000000013', 'MSQ', 'official-pyq', 'GA', null, 'Two-mark MSQ fixture prompt', '[{"id":"A","text":"Option A"},{"id":"B","text":"Option B"},{"id":"C","text":"Option C"}]'::jsonb, 2, true),
  ('20000000-0000-4000-8000-000000000014', 'NAT', 'official-pyq', 'GA', null, 'Two-mark NAT fixture prompt', null, 2, true)
on conflict (id) do nothing;

insert into private.question_answer_keys(question_id, correct_answer, nat_tolerance)
values
  ('20000000-0000-4000-8000-000000000011', '"B"'::jsonb, null),
  ('20000000-0000-4000-8000-000000000012', '"B"'::jsonb, null),
  ('20000000-0000-4000-8000-000000000013', '["A","B"]'::jsonb, null),
  ('20000000-0000-4000-8000-000000000014', '3.14'::jsonb, 0.01)
on conflict (question_id) do nothing;

insert into public.mock_tests(id, title, paper, duration_minutes, marking_config_id, created_by)
select '20000000-0000-4000-8000-000000000021', 'pgTAP exam engine test', 'CS', 60, id,
       '20000000-0000-4000-8000-000000000001'
from public.marking_configurations where name = 'pgTAP exam engine fixture'
on conflict (id) do nothing;

insert into public.mock_test_questions(mock_test_id, question_id, display_order)
values
  ('20000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000011', 1),
  ('20000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000012', 2),
  ('20000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000013', 3),
  ('20000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000014', 4)
on conflict do nothing;

update public.mock_tests set status = 'published', is_available = true
where id = '20000000-0000-4000-8000-000000000021' and status = 'draft';

create temporary table exam_test_context(session_id uuid);
grant select, insert on exam_test_context to authenticated;

set local request.jwt.claim.sub = '20000000-0000-4000-8000-000000000001';
set local request.jwt.claim.role = 'authenticated';
set local role authenticated;

insert into exam_test_context(session_id)
select public.create_exam_session('20000000-0000-4000-8000-000000000021');
select ok((select session_id is not null from exam_test_context), 'approved member can create session');
select is(
  public.create_exam_session('20000000-0000-4000-8000-000000000021'),
  (select session_id from exam_test_context),
  'session creation is idempotent for a user/test pair'
);
select is(
  public.save_exam_answer((select session_id from exam_test_context), '20000000-0000-4000-8000-000000000011', to_jsonb('A'::text), false) ->> 'status',
  'saved', 'MCQ answer saves as a JSON string'
);
select is(
  public.save_exam_answer((select session_id from exam_test_context), '20000000-0000-4000-8000-000000000012', to_jsonb('A'::text), false) ->> 'status',
  'saved', 'second MCQ answer saves'
);
select is(
  public.save_exam_answer((select session_id from exam_test_context), '20000000-0000-4000-8000-000000000013', jsonb_build_array('A','B'), false) ->> 'status',
  'saved', 'MSQ answer saves as a structured JSON array'
);
select is(
  public.save_exam_answer((select session_id from exam_test_context), '20000000-0000-4000-8000-000000000014', to_jsonb('3.14'::text), false) ->> 'status',
  'saved', 'NAT numeric string saves'
);

select is(
  (public.score_exam((select session_id from exam_test_context)) ->> 'totalMarksRaw')::numeric,
  3::numeric,
  '1-mark and 2-mark MCQ negative penalties aggregate exactly to one mark'
);
select is(
  (public.score_exam((select session_id from exam_test_context)) ->> 'correct')::integer,
  2,
  'MSQ and NAT earn positive marks; two deliberately wrong MCQs are incorrect'
);
select is(
  public.save_exam_answer((select session_id from exam_test_context), '20000000-0000-4000-8000-000000000011', to_jsonb('B'::text), false) ->> 'status',
  'session_submitted', 'submitted session rejects further answer changes'
);
select is(
  (public.score_exam((select session_id from exam_test_context)) ->> 'alreadyScored')::boolean,
  true,
  'repeated scoring returns the existing immutable result'
);

select * from finish();
