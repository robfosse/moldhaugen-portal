-- Fix: missing UPDATE policy on info_entries caused all edits to be silently dropped by RLS
CREATE POLICY "Creator or admin can update info entries"
  ON public.info_entries FOR UPDATE
  USING (
    auth.uid() = created_by OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  )
  WITH CHECK (
    auth.uid() = created_by OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );
