-- Controlled access to official answer keys. Answer-key rows remain private;
-- the authenticated RPC exposes them only for verified official PYQs or to moderators.
begin;

create or replace function public.get_question_solution(p_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_category public.content_category;
  v_solution text;
  v_answer jsonb;
begin
  if v_uid is null or not public.is_approved_member() then
    raise exception 'Approved membership required' using errcode = '42501';
  end if;
  select q.category, q.solution, ak.correct_answer
    into v_category, v_solution, v_answer
  from public.questions q
  left join private.question_answer_keys ak on ak.question_id = q.id
  where q.id = p_question_id and q.is_verified = true and q.is_deleted = false;
  if not found then raise exception 'Question not found' using errcode = 'P0002'; end if;
  if v_category <> 'official-pyq' and not public.is_moderator_or_owner() then
    return null;
  end if;
  return jsonb_build_object('correctAnswer', v_answer, 'solution', v_solution);
end;
$$;
revoke all on function public.get_question_solution(uuid) from public, anon;
grant execute on function public.get_question_solution(uuid) to authenticated;

commit;
