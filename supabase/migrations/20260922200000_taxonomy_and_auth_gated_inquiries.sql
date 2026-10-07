-- Manageable taxonomy, protection for hand-edited listings, and inquiries that
-- require a signed-in customer.

-- ---------------------------------------------------------------------------
-- 1. Taxonomy
--
-- These four lists drive the public browse UI. Until now they lived as hard
-- coded arrays in src/data/site.ts, which meant staff could not change what the
-- site offered without a code change. Each row carries its own ordering and an
-- is_active flag so entries can be hidden without being deleted — deleting one
-- that vehicles still reference would silently drop them out of the filters.
-- ---------------------------------------------------------------------------

CREATE TABLE public.makes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE,
  name       text NOT NULL UNIQUE,
  logo_url   text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.body_styles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE,
  name       text NOT NULL UNIQUE,
  image_url  text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE,
  name       text NOT NULL UNIQUE,
  image_url  text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Destination markets the exporter ships to. Not the same thing as
-- vehicles.country, which records where the vehicle itself is (always Japan).
CREATE TABLE public.countries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE,
  name       text NOT NULL UNIQUE,
  image_url  text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER makes_set_updated_at
  BEFORE UPDATE ON public.makes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER body_styles_set_updated_at
  BEFORE UPDATE ON public.body_styles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER countries_set_updated_at
  BEFORE UPDATE ON public.countries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.makes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_styles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.countries   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Makes are publicly readable"
  ON public.makes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff manage makes"
  ON public.makes FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Body styles are publicly readable"
  ON public.body_styles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff manage body styles"
  ON public.body_styles FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Categories are publicly readable"
  ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff manage categories"
  ON public.categories FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Countries are publicly readable"
  ON public.countries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff manage countries"
  ON public.countries FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. Seed the taxonomy from what is already in stock, so the lists are not
--    empty on first load and match the catalogue exactly.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.slugify(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT trim(both '-' from regexp_replace(lower(coalesce(_value, '')), '[^a-z0-9]+', '-', 'g'));
$fn$;

INSERT INTO public.makes (slug, name, sort_order)
SELECT public.slugify(make), make, row_number() OVER (ORDER BY count(*) DESC, make)
  FROM public.vehicles
 WHERE make IS NOT NULL AND make <> ''
 GROUP BY make
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.body_styles (slug, name, sort_order)
SELECT public.slugify(body_type), body_type, row_number() OVER (ORDER BY count(*) DESC, body_type)
  FROM public.vehicles
 WHERE body_type IS NOT NULL AND body_type <> ''
 GROUP BY body_type
ON CONFLICT (name) DO NOTHING;

-- The site has always offered these ten browse tiles, so keep them available
-- even where nothing is currently in stock under them.
INSERT INTO public.body_styles (slug, name, sort_order)
SELECT public.slugify(name), name, 100
  FROM (VALUES ('Sedan'), ('Coupe'), ('Wagon'), ('Hatchback'), ('SUV'), ('Convertible'),
               ('Van & MiniVan'), ('Truck'), ('Bus'), ('Mini Vehicle')) AS seed(name)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.categories (slug, name, sort_order)
SELECT public.slugify(category), category, row_number() OVER (ORDER BY count(*) DESC, category)
  FROM public.vehicles
 WHERE category IS NOT NULL AND category <> ''
 GROUP BY category
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.countries (slug, name, image_url, sort_order)
VALUES
  ('dominican-republic', 'Dominican Republic', NULL, 1),
  ('jamaica',            'Jamaica',            NULL, 2),
  ('malawi',             'Malawi',             NULL, 3),
  ('pakistan',           'Pakistan',           NULL, 4),
  ('sri-lanka',          'Sri Lanka',          NULL, 5),
  ('new-zealand',        'New Zealand',        NULL, 6),
  ('kiribati',           'Kiribati',           NULL, 7),
  ('papua-new-guinea',   'Papua New Guinea',   NULL, 8),
  ('turks-and-caicos',   'Turks and Caicos Islands', NULL, 9)
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Protect hand-edited listings from the inventory sync.
--
-- The sync upserts the whole of every row it sees, so without this any manual
-- correction would be silently overwritten on the next run. `locked_fields`
-- names the columns staff have taken ownership of; `is_manual` marks listings
-- created in the dashboard, which the feed does not know about at all.
-- ---------------------------------------------------------------------------
ALTER TABLE public.vehicles
  ADD COLUMN locked_fields text[] NOT NULL DEFAULT '{}',
  ADD COLUMN is_manual     boolean NOT NULL DEFAULT false,
  ADD COLUMN is_featured   boolean NOT NULL DEFAULT false;

CREATE INDEX vehicles_is_featured_idx ON public.vehicles (is_featured) WHERE is_featured;
CREATE INDEX vehicles_is_manual_idx   ON public.vehicles (is_manual) WHERE is_manual;

-- ---------------------------------------------------------------------------
-- 4. Inquiries now require a signed-in customer.
--
-- Anonymous submission is withdrawn: the customer portal can only show someone
-- their documents if the inquiry is tied to an account from the start.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can submit an inquiry" ON public.inquiries;

CREATE POLICY "Signed-in customers can submit an inquiry"
  ON public.inquiries FOR INSERT TO authenticated
  WITH CHECK (
    customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
    OR public.is_staff(auth.uid())
  );
