-- Identity and privacy security smoke tests. Executed by `supabase test db`.
create extension if not exists pgtap with schema extensions;
select plan(15);

select has_table('public', 'user_profiles', 'profile table exists');
select has_table('public', 'memberships', 'membership authority table exists');
select has_table('public', 'questions', 'question bank exists');
select has_table('private', 'question_answer_keys', 'answer keys live in private schema');
select has_view('public', 'public_profiles', 'public profile projection exists');
select ok(not has_schema_privilege('authenticated', 'private', 'USAGE'), 'authenticated cannot access private schema');
select ok(not has_column_privilege('authenticated', 'public.questions', 'solution', 'SELECT'), 'authenticated cannot select question solutions');
select ok(not has_column_privilege('authenticated', 'public.resources', 'object_key', 'SELECT'), 'authenticated cannot select R2 object keys');
select ok(has_function_privilege('authenticated', 'public.create_exam_session(uuid)', 'EXECUTE'), 'authenticated can invoke session creation RPC');
select ok(not has_function_privilege('anon', 'public.create_exam_session(uuid)', 'EXECUTE'), 'anonymous role cannot invoke session creation RPC');
select ok(not has_column('public', 'public_profiles', 'email'), 'public profile view does not contain email');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'privacy-owner@example.invalid', '', now(), '{}'::jsonb, '{"display_name":"Privacy Owner"}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'privacy-public@example.invalid', '', now(), '{}'::jsonb, '{"display_name":"Public Learner"}'::jsonb, now(), now())
on conflict (id) do nothing;

update public.memberships
set status = 'approved', approved_at = now(), joined_at = now()
where user_id = '10000000-0000-4000-8000-000000000001';
update public.user_profiles set profile_public = true
where id = '10000000-0000-4000-8000-000000000002';

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
set local request.jwt.claim.role = 'authenticated';
set local role authenticated;

select is(
  (select count(*)::integer from public.user_profiles where id = '10000000-0000-4000-8000-000000000002'),
  0,
  'private profile row is not visible to another member'
);
select is(
  (select count(*)::integer from public.public_profiles where id = '10000000-0000-4000-8000-000000000002'),
  1,
  'public profile projection exposes only opted-in profile'
);
select is(
  (select count(*)::integer from public.memberships where user_id = auth.uid()),
  1,
  'member can read own membership only'
);
select throws_ok(
  $$update public.memberships set role = 'owner' where user_id = auth.uid()$$,
  '42501', null,
  'authenticated user cannot self-promote membership role'
);

select * from finish();
