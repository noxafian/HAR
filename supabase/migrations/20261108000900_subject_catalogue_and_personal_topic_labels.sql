-- Canonical CS/DA subject catalogue. User-entered personal subtopic names stay
-- on personal records and never mutate the official syllabus taxonomy.

insert into public.subjects(name, is_general_aptitude, display_order)
values
  ('Engineering Mathematics', false, 10),
  ('Discrete Mathematics', false, 20),
  ('Digital Logic', false, 30),
  ('Computer Organization and Architecture', false, 40),
  ('Programming and Data Structures', false, 50),
  ('Algorithms', false, 60),
  ('Theory of Computation', false, 70),
  ('Compiler Design', false, 80),
  ('Operating Systems', false, 90),
  ('Database Management Systems', false, 100),
  ('Computer Networks', false, 110),
  ('Probability and Statistics', false, 120),
  ('Linear Algebra', false, 130),
  ('Calculus and Optimization', false, 140),
  ('Programming, Data Structures and Algorithms', false, 150),
  ('Database Management and Warehousing', false, 160),
  ('Machine Learning', false, 170),
  ('Artificial Intelligence', false, 180)
on conflict (name) do update set display_order = excluded.display_order;

-- One canonical General Aptitude subject is linked to both paper syllabi.
update public.syllabus_versions set is_current = false
where is_current = true and paper_id in (select id from public.exam_papers where code in ('CS','DA'));

with papers as (
  select id, code from public.exam_papers where code in ('CS','DA')
), versions as (
  insert into public.syllabus_versions(paper_id, year, is_current, source_ref)
  select id, 2027, true, 'GATE 2027 official syllabus — pending source URL verification'
  from papers
  on conflict (paper_id, year) do update set is_current = true
  returning id, paper_id
), subject_links as (
  select v.id as syllabus_version_id, s.id as subject_id, s.display_order
  from versions v
  cross join public.subjects s
  where
    (v.paper_id = (select id from public.exam_papers where code='CS') and s.name in (
      'Engineering Mathematics','Discrete Mathematics','Digital Logic','Computer Organization and Architecture',
      'Programming and Data Structures','Algorithms','Theory of Computation','Compiler Design','Operating Systems',
      'Database Management Systems','Computer Networks','General Aptitude'))
    or
    (v.paper_id = (select id from public.exam_papers where code='DA') and s.name in (
      'Probability and Statistics','Linear Algebra','Calculus and Optimization',
      'Programming, Data Structures and Algorithms','Database Management and Warehousing',
      'Machine Learning','Artificial Intelligence','General Aptitude'))
)
insert into public.syllabus_subjects(syllabus_version_id, subject_id, display_order)
select syllabus_version_id, subject_id, display_order from subject_links
on conflict do nothing;

alter table public.flashcards add column if not exists topic_label text check (topic_label is null or char_length(topic_label) <= 100);
alter table public.mistakes add column if not exists topic_label text check (topic_label is null or char_length(topic_label) <= 100);
alter table public.planner_tasks add column if not exists topic_label text check (topic_label is null or char_length(topic_label) <= 100);
alter table public.focus_sessions add column if not exists topic_label text check (topic_label is null or char_length(topic_label) <= 100);
