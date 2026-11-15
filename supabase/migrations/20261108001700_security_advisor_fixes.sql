-- =============================================================================
-- Security Advisor Fixes — StudyHub
-- Migration: 20261108001700_security_advisor_fixes.sql
--
-- Addresses all Supabase Security Advisor warnings identified across
-- all 17 prior migrations and the 4 script-based migrations.
--
-- Safe to run on a live database. All statements are idempotent.
-- Does NOT drop tables, remove policies, or change existing data.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- FIX 1: public.public_profiles view
-- ---------------------------------------------------------------------------
-- The advisor flags this view as "SECURITY DEFINER" but the original DDL uses
-- security_barrier = true (a query-planner hint), not security_definer.
-- Adding security_invoker = on explicitly makes the intent unambiguous and
-- suppresses the advisor warning. The view continues to enforce the
-- WHERE profile_public = true filter and the caller's RLS context.
-- ---------------------------------------------------------------------------
create or replace view public.public_profiles
  with (security_barrier = true, security_invoker = on)
as
select id, display_name, avatar_url, exam_papers, show_study_stats, created_at
from public.user_profiles
where profile_public = true;

comment on view public.public_profiles is
  'Safe public profile projection. Uses security_barrier to prevent filter-pushdown '
  'data leaks and security_invoker so the caller''s RLS context applies. '
  'Excludes email and all private preferences.';

-- Re-grant SELECT that was on the original view (in case CREATE OR REPLACE reset it).
grant select on public.public_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- FIX 2: Unindexed foreign-key columns
-- ---------------------------------------------------------------------------
-- The advisor flags FK columns with no matching index because Postgres must
-- perform a full-table scan to verify referential integrity on DELETE/UPDATE
-- of the parent row.  High-traffic FK columns are prioritised.
-- ---------------------------------------------------------------------------

-- exam_sessions → mock_tests (high-volume: every session lookup by test)
create index if not exists exam_sessions_mock_test_id_idx
  on public.exam_sessions (mock_test_id);

-- flashcard_review_history → flashcards (accessed per flashcard frequently)
create index if not exists flashcard_review_history_flashcard_id_idx
  on public.flashcard_review_history (flashcard_id);

-- questions.submitted_by → user_profiles (admin Q-lists by submitter)
create index if not exists questions_submitted_by_idx
  on public.questions (submitted_by)
  where submitted_by is not null;

-- discussions.author_id → user_profiles (profile-page discussion listing)
create index if not exists discussions_author_id_idx
  on public.discussions (author_id)
  where not is_deleted;

-- discussion_replies.author_id → user_profiles (profile-page reply listing)
create index if not exists discussion_replies_author_id_idx
  on public.discussion_replies (author_id)
  where not is_deleted;

-- mock_tests.marking_config_id → marking_configurations
create index if not exists mock_tests_marking_config_id_idx
  on public.mock_tests (marking_config_id);

-- mock_tests.created_by → user_profiles
create index if not exists mock_tests_created_by_idx
  on public.mock_tests (created_by)
  where created_by is not null;

-- memberships moderator-audit columns (low-traffic but flagged by advisor)
create index if not exists memberships_approved_by_idx
  on public.memberships (approved_by)
  where approved_by is not null;

create index if not exists memberships_rejected_by_idx
  on public.memberships (rejected_by)
  where rejected_by is not null;

create index if not exists memberships_suspended_by_idx
  on public.memberships (suspended_by)
  where suspended_by is not null;

-- join_requests.responded_by → user_profiles
create index if not exists join_requests_responded_by_idx
  on public.join_requests (responded_by)
  where responded_by is not null;

-- announcements.author_id → user_profiles
create index if not exists announcements_author_id_idx
  on public.announcements (author_id);

-- revision_history.revision_item_id → revision_items
create index if not exists revision_history_item_id_idx
  on public.revision_history (revision_item_id)
  where revision_item_id is not null;

-- revision_history.subject_id → subjects
create index if not exists revision_history_subject_id_idx
  on public.revision_history (subject_id)
  where subject_id is not null;

-- ---------------------------------------------------------------------------
-- FIX 3: revision_history — explicit no-write policies
-- ---------------------------------------------------------------------------
-- RLS is enabled and a SELECT policy exists. The advisor flags the absence of
-- INSERT/UPDATE/DELETE policies.  All writes go through the
-- complete_revision_item() SECURITY DEFINER RPC; direct client writes should
-- be blocked. Adding explicit denial policies makes the intent machine-readable
-- and silences the advisor without changing behaviour.
-- ---------------------------------------------------------------------------

-- Clients may not insert directly; use complete_revision_item() RPC instead.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'revision_history'
      and policyname = 'revision_history_no_direct_insert'
  ) then
    execute $pol$
      create policy revision_history_no_direct_insert
        on public.revision_history
        for insert to authenticated
        with check (false)
    $pol$;
  end if;
end;
$$;

-- Revision history rows are immutable once written.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'revision_history'
      and policyname = 'revision_history_no_update'
  ) then
    execute $pol$
      create policy revision_history_no_update
        on public.revision_history
        for update to authenticated
        using (false)
    $pol$;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'revision_history'
      and policyname = 'revision_history_no_delete'
  ) then
    execute $pol$
      create policy revision_history_no_delete
        on public.revision_history
        for delete to authenticated
        using (false)
    $pol$;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- FIX 4: gate_syllabus and user_topic_progress (script-migration tables)
-- ---------------------------------------------------------------------------
-- scripts/migration-16.sql created these tables without RLS.
-- scripts/migration-19-gate-syllabus-progress.sql re-created them with RLS,
-- but if migration-16 ran first the tables may already exist without RLS.
-- These statements are idempotent and safe to run regardless of order.
-- ---------------------------------------------------------------------------

-- gate_syllabus: public read-only reference data for all authenticated users.
alter table if exists public.gate_syllabus enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gate_syllabus'
      and policyname = 'gate_syllabus_select'
  ) then
    execute $pol$
      create policy gate_syllabus_select
        on public.gate_syllabus
        for select to authenticated
        using (true)
    $pol$;
  end if;
end;
$$;

-- Clients may not modify the syllabus directly.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'gate_syllabus'
      and policyname = 'gate_syllabus_no_write'
  ) then
    execute $pol$
      create policy gate_syllabus_no_write
        on public.gate_syllabus
        for all to authenticated
        using (false)
        with check (false)
    $pol$;
  end if;
end;
$$;

-- user_topic_progress: row-owned by the user.
alter table if exists public.user_topic_progress enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_topic_progress'
      and policyname = 'user_topic_progress_select'
  ) then
    execute $pol$
      create policy user_topic_progress_select
        on public.user_topic_progress
        for select to authenticated
        using (user_id = auth.uid())
    $pol$;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_topic_progress'
      and policyname = 'user_topic_progress_insert'
  ) then
    execute $pol$
      create policy user_topic_progress_insert
        on public.user_topic_progress
        for insert to authenticated
        with check (user_id = auth.uid())
    $pol$;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_topic_progress'
      and policyname = 'user_topic_progress_update'
  ) then
    execute $pol$
      create policy user_topic_progress_update
        on public.user_topic_progress
        for update to authenticated
        using (user_id = auth.uid())
    $pol$;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_topic_progress'
      and policyname = 'user_topic_progress_delete'
  ) then
    execute $pol$
      create policy user_topic_progress_delete
        on public.user_topic_progress
        for delete to authenticated
        using (user_id = auth.uid())
    $pol$;
  end if;
end;
$$;

-- Grant minimum-required access for the script-migration tables.
-- (These are no-ops if grants were already applied by migration-19.)
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'gate_syllabus') then
    execute 'grant select on public.gate_syllabus to authenticated';
    execute 'grant all on public.gate_syllabus to service_role';
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'user_topic_progress') then
    execute 'grant select, insert, update, delete on public.user_topic_progress to authenticated';
    execute 'grant all on public.user_topic_progress to service_role';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- FIX 5: topic_videos updated_at trigger (only if table exists)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'topic_videos'
  ) then
    if not exists (
      select 1 from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where t.tgname = 'topic_videos_updated_at'
        and c.relname = 'topic_videos'
        and n.nspname = 'public'
    ) then
      execute $t$
        create trigger topic_videos_updated_at
          before update on public.topic_videos
          for each row execute function public.set_updated_at()
      $t$;
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- FIX 6: Private-schema tables — advisory comments
-- ---------------------------------------------------------------------------
-- These tables intentionally have no RLS client policies; access is entirely
-- through SECURITY DEFINER RPCs with service_role.  The comments make this
-- explicit in the database catalogue so the intent survives schema dumps.
-- ---------------------------------------------------------------------------
comment on table private.question_answer_keys is
  'Answer keys are intentionally invisible to PostgREST and RLS clients. '
  'Access only via SECURITY DEFINER RPCs (guard_answer_key_mutation, score_exam, '
  'get_question_solution). service_role bypasses RLS by design.';

comment on table private.ai_provider_credentials is
  'Encrypted AI provider credentials. No client RLS policies by design. '
  'All access via service_role-only SECURITY DEFINER RPCs (ai_credential_*).';

comment on table private.rate_limit_buckets is
  'Persistent rate-limit counters. No client RLS policies by design. '
  'All access via service_role-only SECURITY DEFINER RPCs (consume_rate_limit, etc.).';

comment on table private.resource_upload_intents is
  'Upload intent tokens. No client RLS policies by design. '
  'All access via service_role-only SECURITY DEFINER RPCs (create_resource_upload_intent, etc.).';

comment on table private.bootstrap_config is
  'One-time owner bootstrap configuration. Singleton row, bcrypt hash only. '
  'No client RLS policies by design. Access via service_role bootstrap RPCs only.';

commit;
