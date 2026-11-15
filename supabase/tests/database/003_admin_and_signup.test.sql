-- Admin reporting authorization and signup-to-join-request lifecycle.
select plan(13);

select has_function('public','admin_dashboard_summary',array[]::text[],'admin summary RPC exists');
select has_function('public','admin_list_resources',array['text','text','integer','integer'],'resource moderation list RPC exists');
select has_function('public','admin_count_resources',array['text','text'],'resource count RPC exists');
select has_function('public','admin_storage_summary',array[]::text[],'tracked storage summary RPC exists');
select has_function('public','admin_list_audit_events',array['text','integer','integer'],'audit listing RPC exists');
select ok(has_function_privilege('authenticated','public.admin_dashboard_summary()','EXECUTE'),'authenticated role can invoke admin summary function for internal role check');
select ok(not has_function_privilege('anon','public.admin_dashboard_summary()','EXECUTE'),'anonymous role cannot invoke admin summary');
select ok(not has_function_privilege('anon','public.admin_list_audit_events(text,integer,integer)','EXECUTE'),'anonymous role cannot invoke audit listing');
select ok(has_function_privilege('authenticated','public.admin_list_audit_events(text,integer,integer)','EXECUTE'),'authenticated calls enter the owner-checking audit RPC');

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '30000000-0000-4000-8000-000000000001','authenticated','authenticated',
  'signup-access@example.invalid','',now(),'{}'::jsonb,
  '{"display_name":"Signup Applicant","exam_papers":["CS","DA"],"join_message":"I am preparing for GATE and want to collaborate with the study group."}'::jsonb,
  now(),now()
) on conflict(id) do nothing;

select is((select count(*)::integer from public.user_profiles where id='30000000-0000-4000-8000-000000000001'),1,'signup trigger provisions profile');
select is((select status::text from public.memberships where user_id='30000000-0000-4000-8000-000000000001'),'pending','signup trigger provisions pending membership');
select is((select count(*)::integer from public.join_requests where user_id='30000000-0000-4000-8000-000000000001' and status='pending'),1,'signup trigger creates a pending owner-reviewable request');
select is((select message from public.join_requests where user_id='30000000-0000-4000-8000-000000000001' and status='pending'),'I am preparing for GATE and want to collaborate with the study group.','signup request message is stored with the authenticated account');

select * from finish();
