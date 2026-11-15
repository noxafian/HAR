-- Keryvion StudyHub — foundational schema.
-- Supabase PostgreSQL 15+. This migration is intentionally explicit: no table is
-- created dynamically, and the private schema is not exposed by PostgREST.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- Domain types. General Aptitude is a question section shared by CS and DA,
-- not a standalone exam_papers row.
create type public.user_role as enum ('owner', 'moderator', 'member');
create type public.membership_status as enum ('pending', 'approved', 'rejected', 'suspended', 'removed');
create type public.exam_paper as enum ('CS', 'DA');
create type public.question_section as enum ('CS', 'DA', 'GA');
create type public.content_category as enum ('official-pyq', 'member-contributed', 'ai-generated', 'unverified');
create type public.question_type as enum ('MCQ', 'MSQ', 'NAT');
create type public.mistake_category as enum (
  'conceptual-misunderstanding', 'calculation-error', 'formula-forgotten',
  'question-misunderstood', 'time-management', 'incorrect-guessing'
);
create type public.revision_status as enum ('not-started', 'in-progress', 'due', 'overdue', 'completed');
create type public.resource_status as enum ('pending', 'verified', 'rejected', 'unverified');
create type public.discussion_category as enum (
  'doubt', 'resource-recommendation', 'question-of-the-day', 'weekly-challenge', 'general'
);
create type public.session_status as enum ('active', 'submitted', 'expired', 'abandoned');
create type public.mock_test_status as enum ('draft', 'published', 'archived');
create type public.audit_status as enum ('success', 'failure');

-- Reusable timestamp trigger.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- Identity: no role or membership fields are stored in the profile row.
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null check (char_length(display_name) between 2 and 64),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 512),
  exam_papers public.exam_paper[] not null default array['CS']::public.exam_paper[],
  profile_public boolean not null default false,
  show_study_stats boolean not null default false,
  allow_messages boolean not null default true,
  show_analytics boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_exam_papers_valid check (
    cardinality(exam_papers) between 1 and 2
    and exam_papers <@ array['CS','DA']::public.exam_paper[]
  )
);
create index user_profiles_email_lower_idx on public.user_profiles (lower(email));

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.user_profiles(id) on delete cascade,
  role public.user_role not null default 'member',
  status public.membership_status not null default 'pending',
  joined_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.user_profiles(id) on delete set null,
  rejected_at timestamptz,
  rejected_by uuid references public.user_profiles(id) on delete set null,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 500),
  suspended_at timestamptz,
  suspended_by uuid references public.user_profiles(id) on delete set null,
  suspension_reason text check (suspension_reason is null or char_length(suspension_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owner_must_be_approved check (role <> 'owner' or status = 'approved')
);
create unique index memberships_single_owner_idx on public.memberships (role) where role = 'owner';
create index memberships_status_idx on public.memberships (status);

create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  email text not null,
  display_name text not null,
  message text check (message is null or char_length(message) <= 500),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  responded_by uuid references public.user_profiles(id) on delete set null
);
create unique index join_requests_one_pending_idx on public.join_requests(user_id) where status = 'pending';
create index join_requests_status_requested_idx on public.join_requests(status, requested_at desc);

-- Canonical syllabus model: a subject can be linked to the CS and DA syllabus
-- versions independently. GA is a shared question section, not a third paper.
create table public.exam_papers (
  id uuid primary key default gen_random_uuid(),
  code public.exam_paper not null unique,
  label text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.syllabus_versions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.exam_papers(id) on delete restrict,
  year integer not null check (year between 2020 and 2040),
  is_current boolean not null default false,
  source_ref text,
  created_at timestamptz not null default now(),
  unique (paper_id, year)
);
create unique index syllabus_one_current_per_paper_idx on public.syllabus_versions(paper_id) where is_current;
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_general_aptitude boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table public.syllabus_subjects (
  syllabus_version_id uuid not null references public.syllabus_versions(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  display_order integer not null default 0,
  primary key (syllabus_version_id, subject_id)
);
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  name text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (subject_id, name)
);

create table public.marking_configurations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  mcq_1m_negative_numerator smallint not null default 1 check (mcq_1m_negative_numerator >= 0),
  mcq_2m_negative_numerator smallint not null default 2 check (mcq_2m_negative_numerator >= 0),
  mcq_negative_denominator smallint not null default 3 check (mcq_negative_denominator > 0),
  default_nat_tolerance numeric not null default 0 check (default_nat_tolerance >= 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marking_config_numerators_bounded check (mcq_1m_negative_numerator <= mcq_negative_denominator and mcq_2m_negative_numerator <= mcq_negative_denominator)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  type public.question_type not null,
  category public.content_category not null default 'unverified',
  section public.question_section not null,
  year integer check (year is null or year between 2000 and 2040),
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  prompt text not null check (char_length(prompt) between 1 and 20000),
  options jsonb,
  marks numeric(8,4) not null check (marks in (1, 2)),
  difficulty text check (difficulty is null or difficulty in ('easy','medium','hard')),
  source_ref text,
  solution text,
  is_verified boolean not null default false,
  is_deleted boolean not null default false,
  submitted_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint question_options_match_type check (
    (type = 'NAT' and options is null)
    or (type in ('MCQ','MSQ') and case when jsonb_typeof(options) = 'array' then jsonb_array_length(options) >= 2 else false end)
  ),
  constraint questions_prompt_not_blank check (char_length(trim(prompt)) > 0)
);
create index questions_subject_topic_idx on public.questions(subject_id, topic_id);
create index questions_section_category_idx on public.questions(section, category) where not is_deleted;
create index questions_year_idx on public.questions(section, year) where year is not null;

create table private.question_answer_keys (
  question_id uuid primary key references public.questions(id) on delete cascade,
  correct_answer jsonb not null,
  nat_tolerance numeric check (nat_tolerance is null or nat_tolerance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.question_reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  reported_by uuid not null references public.user_profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 100),
  details text check (details is null or char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  unique (question_id, reported_by)
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 255),
  description text check (description is null or char_length(description) <= 2000),
  paper public.question_section,
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  file_type text not null check (file_type in ('pdf','png','jpg','jpeg','docx','pptx','txt')),
  file_size bigint not null check (file_size between 1 and 52428800),
  object_key text not null unique,
  content_hash char(64) not null check (content_hash ~ '^[0-9a-f]{64}$'),
  status public.resource_status not null default 'pending',
  uploaded_by uuid not null references public.user_profiles(id) on delete restrict,
  verified_by uuid references public.user_profiles(id) on delete set null,
  verified_at timestamptz,
  is_deleted boolean not null default false,
  version integer not null default 1 check (version > 0),
  download_count bigint not null default 0 check (download_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index resources_uploaded_by_idx on public.resources(uploaded_by);
create index resources_subject_status_idx on public.resources(subject_id, status) where not is_deleted;
create index resources_created_idx on public.resources(created_at desc) where not is_deleted;
create table public.resource_bookmarks (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);

create table public.mock_tests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 255),
  paper public.exam_paper not null references public.exam_papers(code) on update cascade on delete restrict,
  duration_minutes integer not null default 180 check (duration_minutes between 1 and 480),
  total_questions integer check (total_questions is null or total_questions >= 0),
  total_marks numeric(12,6) check (total_marks is null or total_marks >= 0),
  marking_config_id uuid not null references public.marking_configurations(id) on delete restrict,
  status public.mock_test_status not null default 'draft',
  is_available boolean not null default false,
  scheduled_at timestamptz,
  published_at timestamptz,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mock_test_publish_fields check ((status = 'published' and published_at is not null) or status <> 'published'),
  constraint mock_test_availability_requires_published check (not is_available or status = 'published')
);
create index mock_tests_available_idx on public.mock_tests(paper, scheduled_at) where status = 'published' and is_available;
create table public.mock_test_questions (
  mock_test_id uuid not null references public.mock_tests(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  display_order integer not null default 0 check (display_order >= 0),
  primary key (mock_test_id, question_id),
  unique (mock_test_id, display_order)
);

create table public.exam_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  mock_test_id uuid not null references public.mock_tests(id) on delete restrict,
  paper public.exam_paper not null,
  status public.session_status not null default 'active',
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  marking_config_snapshot jsonb not null,
  question_count integer not null check (question_count > 0),
  max_possible_marks numeric(12,6) not null check (max_possible_marks > 0),
  created_at timestamptz not null default now(),
  constraint exam_session_deadline_after_start check (expires_at > started_at)
);
create unique index exam_sessions_one_active_per_test_idx on public.exam_sessions(user_id, mock_test_id) where status = 'active';
create index exam_sessions_user_started_idx on public.exam_sessions(user_id, started_at desc);
create table public.exam_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.exam_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  answer jsonb,
  marked_review boolean not null default false,
  saved_at timestamptz not null default now(),
  unique (session_id, question_id)
);
create index exam_answers_session_idx on public.exam_answers(session_id);
create table public.exam_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.exam_sessions(id) on delete restrict,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  total_marks_raw numeric not null,
  total_marks numeric not null check (total_marks >= 0),
  max_possible_marks numeric not null check (max_possible_marks >= 0),
  correct_count integer not null check (correct_count >= 0),
  incorrect_count integer not null check (incorrect_count >= 0),
  unanswered_count integer not null check (unanswered_count >= 0),
  accuracy numeric(5,2) not null check (accuracy between 0 and 100),
  duration_seconds integer not null check (duration_seconds >= 0),
  question_results jsonb not null,
  subject_breakdown jsonb not null default '{}'::jsonb,
  marking_config_snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index exam_results_user_created_idx on public.exam_results(user_id, created_at desc);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  front text not null check (char_length(front) between 1 and 2000),
  back text not null check (char_length(back) between 1 and 2000),
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  source text check (source is null or char_length(source) <= 500),
  is_ai_generated boolean not null default false,
  difficulty integer not null default 3 check (difficulty between 1 and 5),
  next_review_at timestamptz,
  review_count integer not null default 0 check (review_count >= 0),
  is_remembered boolean not null default false,
  is_difficult boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index flashcards_user_review_idx on public.flashcards(user_id, next_review_at);
create table public.flashcard_review_history (
  id uuid primary key default gen_random_uuid(),
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  result text not null check (result in ('again','hard','good','easy')),
  reviewed_at timestamptz not null default now()
);
create index flashcard_review_history_user_idx on public.flashcard_review_history(user_id, reviewed_at desc);
create table public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  question_text text not null check (char_length(question_text) >= 10),
  my_answer text not null check (char_length(my_answer) <= 500),
  correct_answer text not null check (char_length(correct_answer) <= 500),
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 2000),
  category public.mistake_category not null default 'conceptual-misunderstanding',
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index mistakes_user_created_idx on public.mistakes(user_id, created_at desc);
create table public.revision_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  status public.revision_status not null default 'not-started',
  scheduled_date date,
  last_revised_at timestamptz,
  revision_count integer not null default 0 check (revision_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, topic_id)
);
create index revision_items_due_idx on public.revision_items(user_id, scheduled_date) where status in ('due','overdue');
create table public.planner_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 255),
  description text check (description is null or char_length(description) <= 1000),
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  scheduled_date date not null,
  estimated_mins integer check (estimated_mins is null or estimated_mins between 1 and 480),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index planner_tasks_user_date_idx on public.planner_tasks(user_id, scheduled_date);
create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz,
  duration_minutes integer not null check (duration_minutes between 1 and 480),
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  session_type text not null default 'focused' check (session_type in ('focused','short-break','long-break')),
  created_at timestamptz not null default now(),
  constraint focus_session_end_after_start check (end_time is null or end_time >= start_time)
);
create index focus_sessions_user_start_idx on public.focus_sessions(user_id, start_time desc);

create table public.discussions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.user_profiles(id) on delete restrict,
  title text not null check (char_length(title) between 5 and 200),
  body text not null check (char_length(body) between 10 and 20000),
  category public.discussion_category not null default 'general',
  subject_id uuid references public.subjects(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  reply_count integer not null default 0 check (reply_count >= 0),
  is_pinned boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index discussions_created_idx on public.discussions(created_at desc) where not is_deleted;
create table public.discussion_replies (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.discussions(id) on delete cascade,
  author_id uuid not null references public.user_profiles(id) on delete restrict,
  body text not null check (char_length(body) between 5 and 5000),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index discussion_replies_discussion_idx on public.discussion_replies(discussion_id, created_at) where not is_deleted;
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.user_profiles(id) on delete restrict,
  title text not null check (char_length(title) between 5 and 200),
  body text not null,
  is_pinned boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null check (char_length(action) between 1 and 100),
  user_id uuid references public.user_profiles(id) on delete set null,
  resource_type text not null check (char_length(resource_type) between 1 and 100),
  resource_id text not null check (char_length(resource_id) <= 200),
  status public.audit_status not null,
  error_message text check (error_message is null or char_length(error_message) <= 500),
  ip_address inet,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_user_created_idx on public.audit_log(user_id, created_at desc);
create index audit_log_action_created_idx on public.audit_log(action, created_at desc);

-- Sensitive tables are in the non-exposed private schema. No authenticated grant.
create table private.ai_provider_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  provider text not null check (provider in ('openai','gemini','groq','openrouter','anthropic')),
  model_id text check (model_id is null or char_length(model_id) <= 100),
  encrypted text not null,
  nonce text not null,
  tag text not null,
  key_version text not null default '1',
  credential_hash char(64) not null check (credential_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'active' check (status in ('active','disabled','rotated')),
  usage_count bigint not null default 0 check (usage_count >= 0),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);
create index ai_provider_credentials_user_idx on private.ai_provider_credentials(user_id);
create index ai_provider_credentials_hash_idx on private.ai_provider_credentials(credential_hash);

create table private.bootstrap_config (
  singleton boolean primary key default true check (singleton),
  secret_hash text,
  used boolean not null default false,
  seeded_at timestamptz,
  used_at timestamptz,
  constraint bootstrap_hash_required_when_seeded check ((seeded_at is null and secret_hash is null) or (seeded_at is not null and secret_hash is not null))
);
insert into private.bootstrap_config(singleton) values (true);

-- Validate the structured option contract and keep topic/subject metadata coherent.
create or replace function private.validate_question_definition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_option_count integer;
  v_distinct_ids integer;
  v_invalid_options integer;
  v_topic_subject uuid;
  v_is_ga boolean;
begin
  if new.type in ('MCQ','MSQ') then
    if jsonb_typeof(new.options) <> 'array' then
      raise exception 'MCQ/MSQ options must be a JSON array' using errcode = '23514';
    end if;
    select count(*), count(distinct option_row ->> 'id'),
      count(*) filter (where jsonb_typeof(option_row) <> 'object'
        or nullif(trim(option_row ->> 'id'),'') is null
        or nullif(trim(option_row ->> 'text'),'') is null)
      into v_option_count, v_distinct_ids, v_invalid_options
    from jsonb_array_elements(new.options) option_row;
    if v_option_count < 2 or v_invalid_options > 0 or v_option_count <> v_distinct_ids then
      raise exception 'Options must contain at least two objects with unique non-empty id and text fields' using errcode = '23514';
    end if;
  end if;

  if new.subject_id is not null then
    select is_general_aptitude into v_is_ga from public.subjects where id = new.subject_id;
    if not found then raise exception 'Question subject does not exist' using errcode = '23503'; end if;
    if (new.section = 'GA') is distinct from v_is_ga then
      raise exception 'GA questions must use a General Aptitude subject and vice versa' using errcode = '23514';
    end if;
  end if;
  if new.topic_id is not null then
    select subject_id into v_topic_subject from public.topics where id = new.topic_id;
    if not found then raise exception 'Question topic does not exist' using errcode = '23503'; end if;
    if new.subject_id is distinct from v_topic_subject then
      raise exception 'Question topic must belong to its selected subject' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger question_definition_guard
before insert or update of type, options, section, subject_id, topic_id on public.questions
for each row execute function private.validate_question_definition();

-- A user signup atomically provisions a profile and a pending member record.
-- Client-supplied metadata may select CS/DA papers and display name only; role/status
-- are server-owned and are deliberately ignored.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_papers public.exam_paper[];
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
  insert into public.user_profiles(id, email, display_name, avatar_url, exam_papers)
  values (new.id, coalesce(new.email, ''), v_name, new.raw_user_meta_data ->> 'avatar_url', v_papers)
  on conflict (id) do nothing;
  insert into public.memberships(user_id, role, status)
  values (new.id, 'member', 'pending')
  on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill users that existed before these migrations were installed.
insert into public.user_profiles(id, email, display_name, avatar_url, exam_papers)
select u.id, coalesce(u.email,''),
  case when char_length(left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'),''), split_part(coalesce(u.email,'student@example.invalid'),'@',1)),64)) < 2 then 'Student'
    else left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'),''), split_part(coalesce(u.email,'student@example.invalid'),'@',1)),64) end,
  u.raw_user_meta_data ->> 'avatar_url',
  coalesce((select array_agg(value::public.exam_paper)
    from (select distinct value from jsonb_array_elements_text(
      case when jsonb_typeof(u.raw_user_meta_data -> 'exam_papers') = 'array'
        then u.raw_user_meta_data -> 'exam_papers' else '["CS"]'::jsonb end
    ) where value in ('CS','DA')) chosen), array['CS']::public.exam_paper[])
from auth.users u
on conflict (id) do nothing;
insert into public.memberships(user_id, role, status)
select p.id, 'member', 'pending'
from public.user_profiles p
on conflict (user_id) do nothing;

create or replace function public.sync_auth_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.user_profiles
      set email = coalesce(new.email,'')
      where id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_auth_user_email() from public, anon, authenticated;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row execute function public.sync_auth_user_email();

-- Membership helper functions use only auth.uid(); callers cannot supply another user id.
create or replace function public.is_approved_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.status = 'approved'
  );
$$;
create or replace function public.is_moderator_or_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.status = 'approved' and m.role in ('moderator','owner')
  );
$$;
create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.status = 'approved' and m.role = 'owner'
  );
$$;
revoke all on function public.is_approved_member() from public, anon;
revoke all on function public.is_moderator_or_owner() from public, anon;
revoke all on function public.is_platform_owner() from public, anon;
grant execute on function public.is_approved_member() to authenticated;
grant execute on function public.is_moderator_or_owner() to authenticated;
grant execute on function public.is_platform_owner() to authenticated;

-- Join requests are derived from the authenticated profile, never client email/name.
create or replace function public.submit_join_request(p_message text default null)
returns table(request_id uuid, request_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_membership public.memberships%rowtype;
  v_request_id uuid;
  v_email text;
  v_display_name text;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_message is not null and char_length(p_message) > 500 then raise exception 'Message too long' using errcode = '22023'; end if;
  select * into v_membership from public.memberships where user_id = v_uid for update;
  if not found then raise exception 'Membership record missing' using errcode = 'P0002'; end if;
  if v_membership.status = 'approved' then raise exception 'Already an approved member' using errcode = 'P0003'; end if;
  if v_membership.status = 'suspended' then raise exception 'Suspended membership cannot reapply; contact the platform owner' using errcode = '42501'; end if;
  select email, display_name into v_email, v_display_name from public.user_profiles where id = v_uid;
  insert into public.join_requests(user_id, email, display_name, message)
  values (v_uid, v_email, v_display_name, p_message)
  on conflict (user_id) where status = 'pending'
  do update set message = excluded.message
  returning id into v_request_id;
  if v_membership.status in ('rejected','removed') then
    update public.memberships set status = 'pending', rejected_at = null, rejected_by = null,
      rejection_reason = null, updated_at = now() where user_id = v_uid;
  end if;
  return query select v_request_id, 'pending'::text;
end;
$$;
revoke all on function public.submit_join_request(text) from public, anon;
grant execute on function public.submit_join_request(text) to authenticated;

-- Public-profile projection is intentionally a definer view over a narrowly selected
-- set of fields. The base table has only an owner-row SELECT policy; no public row
-- policy exists, so profile preferences/email remain private.
create view public.public_profiles with (security_barrier = true) as
select id, display_name, avatar_url, exam_papers, show_study_stats, created_at
from public.user_profiles
where profile_public = true;
comment on view public.public_profiles is 'Safe public profile projection; excludes email and private preferences.';

-- Updated-at triggers.
create trigger user_profiles_updated_at before update on public.user_profiles for each row execute function public.set_updated_at();
create trigger memberships_updated_at before update on public.memberships for each row execute function public.set_updated_at();
create trigger marking_configurations_updated_at before update on public.marking_configurations for each row execute function public.set_updated_at();
create trigger questions_updated_at before update on public.questions for each row execute function public.set_updated_at();
create trigger resources_updated_at before update on public.resources for each row execute function public.set_updated_at();
create trigger mock_tests_updated_at before update on public.mock_tests for each row execute function public.set_updated_at();
create trigger flashcards_updated_at before update on public.flashcards for each row execute function public.set_updated_at();
create trigger mistakes_updated_at before update on public.mistakes for each row execute function public.set_updated_at();
create trigger revision_items_updated_at before update on public.revision_items for each row execute function public.set_updated_at();
create trigger planner_tasks_updated_at before update on public.planner_tasks for each row execute function public.set_updated_at();
create trigger discussions_updated_at before update on public.discussions for each row execute function public.set_updated_at();
create trigger discussion_replies_updated_at before update on public.discussion_replies for each row execute function public.set_updated_at();
create trigger ai_provider_credentials_updated_at before update on private.ai_provider_credentials for each row execute function public.set_updated_at();

-- RLS on every application table and every private table.
do $$
declare r record;
begin
  for r in select schemaname, tablename from pg_tables where schemaname in ('public','private') loop
    execute format('alter table %I.%I enable row level security', r.schemaname, r.tablename);
  end loop;
end;
$$;

-- Identity policies. Profile email and preferences are selectable only by the owner.
create policy profiles_select_own on public.user_profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.user_profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy memberships_select_own on public.memberships for select to authenticated using (user_id = auth.uid());
create policy join_requests_select_own on public.join_requests for select to authenticated using (user_id = auth.uid());

-- Syllabus/content read policies.
create policy exam_papers_read_authenticated on public.exam_papers for select to authenticated using (true);
create policy syllabus_versions_read_authenticated on public.syllabus_versions for select to authenticated using (true);
create policy subjects_read_authenticated on public.subjects for select to authenticated using (true);
create policy syllabus_subjects_read_authenticated on public.syllabus_subjects for select to authenticated using (true);
create policy topics_read_authenticated on public.topics for select to authenticated using (true);
create policy marking_configurations_read_approved on public.marking_configurations for select to authenticated using (public.is_approved_member() and is_published);
create policy questions_read_approved on public.questions for select to authenticated using (public.is_approved_member() and not is_deleted and is_verified);
create policy question_reports_select_own on public.question_reports for select to authenticated using (reported_by = auth.uid());
create policy question_reports_insert_own on public.question_reports for insert to authenticated with check (reported_by = auth.uid() and public.is_approved_member());
create policy resources_select_visible on public.resources for select to authenticated
  using (public.is_approved_member() and not is_deleted and (status = 'verified' or uploaded_by = auth.uid()));
-- Resource rows are created/updated only by trusted server code after R2 upload confirmation.
create policy resource_bookmarks_own on public.resource_bookmarks for all to authenticated
  using (user_id = auth.uid() and public.is_approved_member())
  with check (user_id = auth.uid() and public.is_approved_member());
create policy mock_tests_read_published on public.mock_tests for select to authenticated
  using (public.is_approved_member() and status = 'published' and is_available);
create policy mock_test_questions_read_published on public.mock_test_questions for select to authenticated
  using (public.is_approved_member() and exists (
    select 1 from public.mock_tests mt where mt.id = mock_test_id and mt.status = 'published' and mt.is_available
  ));

-- Exam rows are read-only to clients. Writes happen only through SECURITY DEFINER RPCs.
create policy exam_sessions_select_own on public.exam_sessions for select to authenticated using (user_id = auth.uid());
create policy exam_answers_select_own on public.exam_answers for select to authenticated using (
  exists (select 1 from public.exam_sessions s where s.id = session_id and s.user_id = auth.uid())
);
create policy exam_results_select_own on public.exam_results for select to authenticated using (user_id = auth.uid());

-- Personal learning data.
create policy flashcards_own on public.flashcards for all to authenticated
  using (user_id = auth.uid() and public.is_approved_member())
  with check (user_id = auth.uid() and public.is_approved_member());
create policy flashcard_review_history_own on public.flashcard_review_history for all to authenticated
  using (user_id = auth.uid() and public.is_approved_member())
  with check (user_id = auth.uid() and public.is_approved_member() and exists (
    select 1 from public.flashcards f where f.id = flashcard_id and f.user_id = auth.uid()
  ));
create policy mistakes_own on public.mistakes for all to authenticated
  using (user_id = auth.uid() and public.is_approved_member()) with check (user_id = auth.uid() and public.is_approved_member());
create policy revision_items_own on public.revision_items for all to authenticated
  using (user_id = auth.uid() and public.is_approved_member()) with check (user_id = auth.uid() and public.is_approved_member());
create policy planner_tasks_own on public.planner_tasks for all to authenticated
  using (user_id = auth.uid() and public.is_approved_member()) with check (user_id = auth.uid() and public.is_approved_member());
create policy focus_sessions_own on public.focus_sessions for all to authenticated
  using (user_id = auth.uid() and public.is_approved_member()) with check (user_id = auth.uid() and public.is_approved_member());

-- Community policies.
create policy discussions_read_approved on public.discussions for select to authenticated
  using (public.is_approved_member() and not is_deleted);
create policy discussions_insert_own on public.discussions for insert to authenticated
  with check (public.is_approved_member() and author_id = auth.uid() and not is_pinned);
create policy discussions_update_own on public.discussions for update to authenticated
  using (public.is_approved_member() and author_id = auth.uid() and not is_deleted)
  with check (author_id = auth.uid() and not is_pinned);
create policy replies_read_approved on public.discussion_replies for select to authenticated
  using (public.is_approved_member() and not is_deleted);
create policy replies_insert_own on public.discussion_replies for insert to authenticated
  with check (public.is_approved_member() and author_id = auth.uid() and exists (
    select 1 from public.discussions d where d.id = discussion_id and not d.is_deleted
  ));
create policy replies_update_own on public.discussion_replies for update to authenticated
  using (public.is_approved_member() and author_id = auth.uid() and not is_deleted)
  with check (author_id = auth.uid() and not is_deleted);
create policy announcements_read_approved on public.announcements for select to authenticated
  using (public.is_approved_member() and (expires_at is null or expires_at > now()));
create policy audit_log_select_own on public.audit_log for select to authenticated using (user_id = auth.uid());

-- Private tables intentionally have no policies. Only trusted server role/functions access them.

-- Base grants: no anonymous table access; role-specific grants are explicit below.
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
grant usage on schema public to authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant usage on schema private to service_role;
grant all on all tables in schema private to service_role;

-- Read access for authenticated users, restricted by RLS.
grant select on public.user_profiles to authenticated;
grant update (display_name, avatar_url, exam_papers, profile_public, show_study_stats, allow_messages, show_analytics)
  on public.user_profiles to authenticated;
grant select on public.memberships, public.join_requests to authenticated;
grant select on public.exam_papers, public.syllabus_versions, public.subjects, public.syllabus_subjects, public.topics to authenticated;
grant select on public.marking_configurations to authenticated;
grant select (id,type,category,section,year,subject_id,topic_id,prompt,options,marks,difficulty,source_ref,is_verified,submitted_by,created_at,updated_at)
  on public.questions to authenticated;
grant select on public.question_reports to authenticated;
grant insert (question_id, reported_by, reason, details) on public.question_reports to authenticated;
grant select (id,title,description,paper,subject_id,topic_id,file_type,file_size,status,uploaded_by,verified_by,verified_at,is_deleted,version,download_count,created_at,updated_at)
  on public.resources to authenticated;
grant select, insert, delete on public.resource_bookmarks to authenticated;
grant select on public.mock_tests, public.mock_test_questions to authenticated;
grant select on public.exam_sessions, public.exam_answers, public.exam_results to authenticated;
grant select, insert, update, delete on public.flashcards, public.mistakes, public.revision_items, public.planner_tasks, public.focus_sessions to authenticated;
grant select, insert on public.flashcard_review_history to authenticated;
grant select, insert on public.discussions, public.discussion_replies to authenticated;
grant update (title, body, category, subject_id, topic_id) on public.discussions to authenticated;
grant update (body) on public.discussion_replies to authenticated;
grant select on public.announcements, public.audit_log to authenticated;
grant select on public.public_profiles to authenticated;

-- RPC execute privileges are added alongside the functions in subsequent migrations.

commit;
