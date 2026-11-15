-- Atomic spaced-repetition review. Intervals are deterministic and visible in
-- the API contract: again=1d, hard=3d, good=7d, easy=14d.
begin;
create or replace function public.review_flashcard(p_flashcard_id uuid, p_result text)
returns table(id uuid, next_review_at timestamptz, review_count integer, is_remembered boolean, is_difficult boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_interval_days integer;
  v_card public.flashcards%rowtype;
begin
  if v_user_id is null or not public.is_approved_member() then
    raise exception 'Approved membership required' using errcode = '42501';
  end if;
  if p_result not in ('again','hard','good','easy') then
    raise exception 'Invalid review result' using errcode = '22023';
  end if;
  v_interval_days := case p_result when 'again' then 1 when 'hard' then 3 when 'good' then 7 else 14 end;
  select * into v_card from public.flashcards
    where flashcards.id = p_flashcard_id and user_id = v_user_id for update;
  if not found then raise exception 'Flashcard not found' using errcode = 'P0002'; end if;
  insert into public.flashcard_review_history(flashcard_id,user_id,result)
    values (p_flashcard_id,v_user_id,p_result);
  update public.flashcards f set
    next_review_at = now() + make_interval(days => v_interval_days),
    review_count = f.review_count + 1,
    is_remembered = p_result in ('good','easy'),
    is_difficult = p_result in ('again','hard'),
    difficulty = case p_result when 'again' then greatest(1,f.difficulty-1)
      when 'easy' then least(5,f.difficulty+1) else f.difficulty end
    where f.id = p_flashcard_id
    returning f.id, f.next_review_at, f.review_count, f.is_remembered, f.is_difficult
    into id,next_review_at,review_count,is_remembered,is_difficult;
  return next;
end;
$$;
revoke all on function public.review_flashcard(uuid,text) from public, anon;
grant execute on function public.review_flashcard(uuid,text) to authenticated;
commit;
