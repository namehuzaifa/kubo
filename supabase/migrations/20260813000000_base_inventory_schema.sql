-- Base inventory schema.
--
-- These tables already existed in the original Supabase project but were never
-- captured as a migration — they were created through the hosted editor. This
-- file reconstructs them from the generated types and the live column shapes so
-- the schema can be rebuilt on a fresh project.
--
-- Row-level security for import_runs is deliberately left to the migration that
-- follows this one (20260813184513), which is where it was originally defined.

-- ---------------------------------------------------------------------------
-- vehicles
-- stock_id is the upsert key used by the inventory sync; slug is the public URL
-- segment. Both are unique.
-- ---------------------------------------------------------------------------
CREATE TABLE public.vehicles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id           text NOT NULL UNIQUE,
  slug               text NOT NULL UNIQUE,
  title              text NOT NULL,
  make               text NOT NULL,
  model              text NOT NULL,
  variant            text,
  brand              text,
  model_code         text,
  category           text,
  vehicle_type       text,
  body_type          text,
  year               integer,
  registration_year  integer,
  mileage            integer,
  mileage_unit       text,
  engine_size        numeric,
  engine_type        text,
  fuel               text,
  transmission       text,
  gears              integer,
  steering           text,
  drivetrain         text,
  drive_type         text,
  exterior_color     text,
  interior_color     text,
  doors              integer,
  seats              integer,
  chassis_number     text,
  condition          text,
  inventory_location text,
  country            text,
  port               text,
  shipment           text,
  inspection         text,
  insurance          text,
  description        text,
  price              numeric,
  currency           text,
  status             text NOT NULL DEFAULT 'Available',
  source_name        text,
  source_url         text,
  source_updated_at  timestamptz,
  imported_at        timestamptz NOT NULL DEFAULT now(),
  last_synced_at     timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vehicles_status_idx    ON public.vehicles (status);
CREATE INDEX vehicles_make_idx      ON public.vehicles (make);
CREATE INDEX vehicles_model_idx     ON public.vehicles (model);
CREATE INDEX vehicles_body_type_idx ON public.vehicles (body_type);
CREATE INDEX vehicles_price_idx     ON public.vehicles (price);
CREATE INDEX vehicles_year_idx      ON public.vehicles (year);

-- ---------------------------------------------------------------------------
-- Child tables. The sync deletes and re-inserts these per vehicle, so they need
-- no unique keys of their own — only the cascade.
-- ---------------------------------------------------------------------------
CREATE TABLE public.vehicle_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id  uuid NOT NULL REFERENCES public.vehicles (id) ON DELETE CASCADE,
  image_url   text NOT NULL,
  image_order integer NOT NULL DEFAULT 0,
  image_type  text,
  alt_text    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vehicle_images_vehicle_idx ON public.vehicle_images (vehicle_id, image_order);

CREATE TABLE public.vehicle_features (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id       uuid NOT NULL REFERENCES public.vehicles (id) ON DELETE CASCADE,
  feature_name     text NOT NULL,
  feature_category text,
  feature_value    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vehicle_features_vehicle_idx ON public.vehicle_features (vehicle_id);
CREATE INDEX vehicle_features_name_idx    ON public.vehicle_features (feature_name);

CREATE TABLE public.vehicle_pricing (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles (id) ON DELETE CASCADE,
  price_type text NOT NULL,
  amount     numeric,
  currency   text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vehicle_pricing_vehicle_idx ON public.vehicle_pricing (vehicle_id);

-- ---------------------------------------------------------------------------
-- import_runs — sync bookkeeping. RLS is applied by the next migration.
-- ---------------------------------------------------------------------------
CREATE TABLE public.import_runs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name           text NOT NULL,
  started_at            timestamptz NOT NULL DEFAULT now(),
  finished_at           timestamptz,
  notes                 text,
  total_source          integer NOT NULL DEFAULT 0,
  total_new             integer NOT NULL DEFAULT 0,
  total_updated         integer NOT NULL DEFAULT 0,
  total_imported        integer NOT NULL DEFAULT 0,
  total_duplicates      integer NOT NULL DEFAULT 0,
  total_failed          integer NOT NULL DEFAULT 0,
  total_missing_images  integer NOT NULL DEFAULT 0,
  total_removed         integer NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- The public site reads the catalogue with the anon key, so these four tables
-- are readable by anyone. Every write path runs server-side under the service
-- role, which bypasses RLS — so no write policy is granted here.
-- ---------------------------------------------------------------------------
ALTER TABLE public.vehicles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_images   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_pricing  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vehicles are publicly readable"
  ON public.vehicles FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Vehicle images are publicly readable"
  ON public.vehicle_images FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Vehicle features are publicly readable"
  ON public.vehicle_features FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Vehicle pricing is publicly readable"
  ON public.vehicle_pricing FOR SELECT TO anon, authenticated USING (true);
