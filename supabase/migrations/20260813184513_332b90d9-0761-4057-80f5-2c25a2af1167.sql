REVOKE ALL ON public.import_runs FROM anon, authenticated;
GRANT ALL ON public.import_runs TO service_role;
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client access to import runs" ON public.import_runs FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);