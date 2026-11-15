-- Topic-wise video lessons. Stores YouTube IDs against text paper/subject/topic names
-- (no UUID FKs to the catalogue) so admins can publish lessons even before the
-- verified topic hierarchy is imported. RLS exposes only published rows to members;
-- all writes go through trusted service-role server code.
begin;

create table if not exists public.topic_videos (
  id uuid primary key default gen_random_uuid(),
  paper text not null check (paper in ('CS', 'DA', 'GA')),
  subject_name text not null,
  topic_name text,
  youtube_id text not null check (char_length(youtube_id) between 4 and 20),
  title text not null check (char_length(title) between 1 and 255),
  description text,
  duration_seconds integer check (duration_seconds is null or (duration_seconds between 1 and 86400)),
  display_order integer not null default 0,
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists topic_videos_paper_subject_idx
  on public.topic_videos (paper, subject_name)
  where is_published = true;

alter table public.topic_videos enable row level security;

create policy topic_videos_select on public.topic_videos
  for select to authenticated
  using (is_published = true);

revoke all on public.topic_videos from public, anon;
grant select on public.topic_videos to authenticated;
grant all on public.topic_videos to service_role;

commit;
