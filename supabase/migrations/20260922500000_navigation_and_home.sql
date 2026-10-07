-- Editable navigation and home page.
--
-- The menu was a literal array in src/data/site.ts and the home page rendered
-- from a hard coded demo dataset in the same file rather than from stock. This
-- migration adds the menu as rows and gives the home page the same content
-- record the other pages already have.

-- ---------------------------------------------------------------------------
-- 1. The top menu
-- ---------------------------------------------------------------------------
CREATE TABLE public.nav_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label      text NOT NULL,
  href       text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX nav_items_order_idx ON public.nav_items (sort_order);

CREATE TRIGGER nav_items_set_updated_at
  BEFORE UPDATE ON public.nav_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.nav_items (label, href, sort_order) VALUES
  ('Home',         '/',             1),
  ('About Us',     '/about',        2),
  ('All Stock',    '/all-stock',    3),
  ('New Arrivals', '/new-arrivals', 4),
  ('On Sale',      '/on-sale',      5),
  ('One Price',    '/one-price',    6),
  ('Inquiry',      '/inquiry',      7),
  ('How To Buy',   '/how-to-buy',   8),
  ('Contact Us',   '/contact',      9);

-- ---------------------------------------------------------------------------
-- 2. The home page hero
--
-- The existing hero pulled its artwork from an external URL baked into the
-- component. Making it a column means staff can upload their own instead.
-- ---------------------------------------------------------------------------
ALTER TABLE public.page_content
  ADD COLUMN hero_image_url text,
  ADD COLUMN cta_label      text,
  ADD COLUMN cta_href       text;

INSERT INTO public.page_content (slug, title, hero_title, hero_subtitle, cta_label, cta_href, meta_title, meta_description)
VALUES (
  'home',
  'Home',
  'Japanese used cars, exported worldwide',
  'Direct auction access, in-house inspection and door-to-door shipping, handled by one team in Osaka.',
  'Browse new arrivals',
  '/new-arrivals',
  'Kubo Trading Japan — Japanese Used Car Exporter',
  'Kubo Trading Japan exports quality Japanese used cars, vans and trucks worldwide from Osaka.'
)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Same access rule as the rest of the site copy
-- ---------------------------------------------------------------------------
ALTER TABLE public.nav_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nav items are publicly readable"
  ON public.nav_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff manage nav items"
  ON public.nav_items FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
