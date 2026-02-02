-- Admin support for approving entregadores

ALTER TABLE public.users
  ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;

-- Allow admins to update any user
CREATE POLICY "Admins can update users" ON public.users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_admin = TRUE
    )
  );
