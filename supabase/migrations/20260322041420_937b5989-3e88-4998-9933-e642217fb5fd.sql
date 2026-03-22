
CREATE POLICY "Users can delete their own battles"
  ON public.battles FOR DELETE
  TO authenticated
  USING (auth.uid() = challenger_id);
