-- Editable page copy and contact details.
--
-- The About, How To Buy and Contact pages, and the phone number in the header,
-- were literals in src/data/site.ts and the route files. Changing a phone number
-- meant a code change and a redeploy. These three tables move that copy into the
-- database so staff can edit it, seeded with exactly what the pages say today.

-- ---------------------------------------------------------------------------
-- 1. Global settings — brand and contact details used across the site
-- ---------------------------------------------------------------------------
CREATE TABLE public.site_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER site_settings_set_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.site_settings (key, value) VALUES (
  'contact',
  jsonb_build_object(
    'name',    'Kubo Trading Japan',
    'tagline', 'Japanese Used Car Exporter',
    'phone',   '+81 6-4560-4097',
    'email',   'info@kubotrading.com',
    'address', '1-8-15 Nishitanabe, Higashisumiyoshi-ku, Osaka, Japan'
  )
) ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. One row per editable page: the hero, plus free prose where a page has it
-- ---------------------------------------------------------------------------
CREATE TABLE public.page_content (
  slug          text PRIMARY KEY,
  title         text NOT NULL,
  hero_title    text NOT NULL,
  hero_subtitle text,
  body          text,
  meta_title    text,
  meta_description text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER page_content_set_updated_at
  BEFORE UPDATE ON public.page_content
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.page_content (slug, title, hero_title, hero_subtitle, body, meta_title, meta_description)
VALUES
  (
    'how-to-buy',
    'How To Buy',
    'How To Buy',
    'From first enquiry to documents in your hand, usually two to four weeks depending on sailing schedule.',
    NULL,
    'How To Buy a Japanese Used Car | Kubo Trading Japan',
    'Step by step: choosing a vehicle, quotation, payment, inspection, shipping and export documents.'
  ),
  (
    'about',
    'About Us',
    'About Kubo Trading Japan',
    'A small Osaka team handling sourcing, inspection, documentation and shipping under one roof.',
    -- Paragraphs are separated by a blank line and rendered as separate <p> tags.
    E'We are a licensed Japanese used vehicle exporter based in Osaka, supplying cars, vans, trucks and machinery to dealers and private buyers worldwide. Our staff bid daily at USS, TAA, JU and HAA auctions and also hold our own one-price yard stock.\n\nEvery unit is checked against its auction sheet before purchase, and we translate those sheets into plain English so you know exactly what you are buying — grade, repairs, corrosion and mileage verification included.\n\nAfter purchase we handle de-registration, export certificates, pre-shipment inspection (JEVIC, QISJ, EAA), booking and Bill of Lading, then send documents by courier the moment the vessel departs.',
    'About Us | Kubo Trading Japan',
    'Kubo Trading Japan is an Osaka-based used vehicle exporter with direct auction access, in-house inspection and shipping to over 40 countries.'
  ),
  (
    'contact',
    'Contact Us',
    'Contact Us',
    'Our Osaka office answers enquiries in English and Japanese, Monday to Saturday, 9:00–18:00 JST.',
    NULL,
    'Contact Kubo Trading Japan | Osaka Used Car Exporter',
    'Contact Kubo Trading Japan in Osaka by phone or email for vehicle quotations, shipping schedules and export documentation.'
  )
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Repeatable blocks within a page: the buying steps and the about stats
-- ---------------------------------------------------------------------------
CREATE TABLE public.page_blocks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_slug  text NOT NULL REFERENCES public.page_content (slug) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX page_blocks_page_idx ON public.page_blocks (page_slug, sort_order);

CREATE TRIGGER page_blocks_set_updated_at
  BEFORE UPDATE ON public.page_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.page_blocks (page_slug, title, body, sort_order) VALUES
  ('how-to-buy', '1. Choose a vehicle', 'Pick from our stock list or send us a target model and budget for auction bidding.', 1),
  ('how-to-buy', '2. Get a quotation', 'We reply with an FOB or CIF quotation to your nearest port, including inspection fees.', 2),
  ('how-to-buy', '3. Confirm and pay', 'Sign the proforma invoice and send payment by T/T bank transfer to our company account.', 3),
  ('how-to-buy', '4. Inspection & shipping', 'We de-register the car, arrange pre-shipment inspection and book the next vessel.', 4),
  ('how-to-buy', '5. Receive documents', 'B/L, export certificate, English translation and inspection certificate are couriered to you.', 5),
  ('about', '15+ years', 'Exporting from Japan', 1),
  ('about', '40+ countries', 'Ports served', 2),
  ('about', 'Daily', 'Auction bidding', 3),
  ('about', 'In-house', 'Inspection & translation', 4);

-- ---------------------------------------------------------------------------
-- 4. Everything here is website copy: public to read, staff to change.
-- ---------------------------------------------------------------------------
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_content  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_blocks   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site settings are publicly readable"
  ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff manage site settings"
  ON public.site_settings FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Page content is publicly readable"
  ON public.page_content FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff manage page content"
  ON public.page_content FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Page blocks are publicly readable"
  ON public.page_blocks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff manage page blocks"
  ON public.page_blocks FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
