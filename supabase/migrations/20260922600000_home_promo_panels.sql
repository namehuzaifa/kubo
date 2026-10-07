-- The home page promo panels, as manageable rows.
--
-- The hero grid — the large promo, the countdown panel and the two small tiles
-- beside it — was fixed markup with hard coded copy and image URLs. These
-- columns turn each panel into a row so staff can change the wording, the
-- artwork, the button and the countdown without touching the code.

ALTER TABLE public.page_blocks
  ADD COLUMN image_url text,
  ADD COLUMN cta_label text,
  ADD COLUMN cta_href  text,
  -- Which slot in the hero grid this block fills.
  ADD COLUMN variant   text NOT NULL DEFAULT 'tile',
  -- Only meaningful for the countdown panel.
  ADD COLUMN ends_at   timestamptz;

-- Destination markets have no per-country stock link — a vehicle in Osaka can
-- ship anywhere — so the figure under each flag is a marketing number staff
-- set, not something derivable from the catalogue.
ALTER TABLE public.countries
  ADD COLUMN vehicle_count integer;

INSERT INTO public.page_blocks (page_slug, title, body, variant, cta_label, cta_href, image_url, ends_at, sort_order)
VALUES
  (
    'home',
    'Car Shopping Event',
    'Shop great deals on Mercedes, BMW, Ford and more.',
    'hero',
    'New Arrivals',
    '/new-arrivals',
    'https://kubotrading.com/wp-content/uploads/2024/04/secong-background-760x312.png',
    NULL,
    1
  ),
  (
    'home',
    'Vehicles on sales',
    NULL,
    'sale',
    'Buy Now',
    '/on-sale',
    'https://kubotrading.com/wp-content/uploads/2024/04/3-background-1-920x560.png',
    now() + interval '7 days',
    2
  ),
  ('home', 'One Price Stock',        'For Purchase', 'tile', 'View Details', '/one-price', NULL, NULL, 3),
  ('home', 'Translate Auction Sheet', 'Get photo',   'tile', 'View Details', '/inquiry',   NULL, NULL, 4);

-- The figures the home page showed before this became editable.
UPDATE public.countries SET vehicle_count = CASE name
  WHEN 'Dominican Republic'        THEN 6
  WHEN 'Jamaica'                   THEN 8
  WHEN 'Malawi'                    THEN 11
  WHEN 'Pakistan'                  THEN 13
  WHEN 'Sri Lanka'                 THEN 9
  WHEN 'New Zealand'               THEN 11
  WHEN 'Kiribati'                  THEN 13
  WHEN 'Papua New Guinea'          THEN 7
  WHEN 'Turks and Caicos Islands'  THEN 2
  ELSE vehicle_count
END;
