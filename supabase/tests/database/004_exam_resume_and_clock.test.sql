-- Database-clock RPC used for accurate exam countdown after resume.
select plan(3);

select has_function('public', 'get_server_time', array[]::text[], 'database clock RPC exists');
select ok(
  has_function_privilege('authenticated', 'public.get_server_time()', 'EXECUTE'),
  'authenticated members can read the database clock'
);
select ok(
  not has_function_privilege('anon', 'public.get_server_time()', 'EXECUTE'),
  'anonymous role cannot call the database clock RPC'
);

select * from finish();
