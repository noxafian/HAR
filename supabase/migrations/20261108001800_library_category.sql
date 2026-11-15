-- Add category column to resources table
ALTER TABLE public.resources 
ADD COLUMN IF NOT EXISTS category text 
CHECK (category IN ('notes', 'year-wise-paper', 'subject-wise-paper', 'topic-wise-paper'))
DEFAULT 'notes';
