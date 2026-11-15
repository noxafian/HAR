-- Only canonical reference rows are seeded. No fake members, questions, results,
-- provider credentials, or demo content are inserted.
insert into public.exam_papers(code, label, description)
values
  ('CS', 'Computer Science and Information Technology', 'GATE CS paper'),
  ('DA', 'Data Science and Artificial Intelligence', 'GATE DA paper')
on conflict (code) do update set label = excluded.label, description = excluded.description;

insert into public.marking_configurations(name, description)
values ('GATE standard', 'Standard GATE marking: one-third negative marking for incorrect MCQs; no negative marking for MSQ/NAT.')
on conflict (name) do nothing;

insert into public.subjects(name, is_general_aptitude, display_order)
values ('General Aptitude', true, 0)
on conflict (name) do update set is_general_aptitude = true;
