-- Add json to resources.file_type check constraint
ALTER TABLE public.resources
  DROP CONSTRAINT IF EXISTS resources_file_type_check;

ALTER TABLE public.resources
  ADD CONSTRAINT resources_file_type_check
  CHECK (file_type IN ('pdf', 'png', 'jpg', 'jpeg', 'docx', 'pptx', 'txt', 'json'));
