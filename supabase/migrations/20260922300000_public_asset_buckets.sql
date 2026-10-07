-- Storage for images staff upload from the dashboard: browse-list tiles, make
-- logos and listing photography.
--
-- These buckets are public, unlike inquiry-docs. The files are website imagery
-- that has to load from an <img> tag on pages anyone can visit, so a signed URL
-- per request would be pointless overhead. Writing still requires staff.

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('site-assets', 'site-assets', true),
  ('vehicle-photos', 'vehicle-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Site imagery is publicly readable"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('site-assets', 'vehicle-photos'));

CREATE POLICY "Staff manage site imagery"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('site-assets', 'vehicle-photos') AND public.is_staff(auth.uid())
  );

CREATE POLICY "Staff replace site imagery"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('site-assets', 'vehicle-photos') AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id IN ('site-assets', 'vehicle-photos') AND public.is_staff(auth.uid()));

CREATE POLICY "Staff remove site imagery"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('site-assets', 'vehicle-photos') AND public.is_staff(auth.uid()));
