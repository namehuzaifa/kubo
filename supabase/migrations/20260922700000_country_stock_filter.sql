-- Makes "Search By Country" a real filter.
--
-- Nothing in the catalogue ties a vehicle to a destination: vehicles.country is
-- always Japan, which is where the car is, not where it is going. What does
-- decide suitability is which side the destination drives on — a right-hand
-- drive car is what Pakistan or New Zealand want, a left-hand drive one is what
-- the Dominican Republic wants — and vehicles.steering already records that.
--
-- So each destination stores its drive side, and filtering by country means
-- filtering the catalogue by the steering that market takes. 'both' places no
-- restriction, for markets that accept either.

ALTER TABLE public.countries
  ADD COLUMN drive_side text NOT NULL DEFAULT 'both'
  CONSTRAINT countries_drive_side_check CHECK (drive_side IN ('right', 'left', 'both'));

COMMENT ON COLUMN public.countries.drive_side IS
  'Which steering this market takes: right = RHD vehicles, left = LHD, both = no restriction.';

UPDATE public.countries SET drive_side = CASE name
  -- Left-hand traffic, so right-hand drive vehicles.
  WHEN 'Pakistan'                  THEN 'right'
  WHEN 'Sri Lanka'                 THEN 'right'
  WHEN 'Jamaica'                   THEN 'right'
  WHEN 'Malawi'                    THEN 'right'
  WHEN 'New Zealand'               THEN 'right'
  WHEN 'Kiribati'                  THEN 'right'
  WHEN 'Papua New Guinea'          THEN 'right'
  WHEN 'Turks and Caicos Islands'  THEN 'right'
  -- Right-hand traffic, so left-hand drive vehicles.
  WHEN 'Dominican Republic'        THEN 'left'
  ELSE drive_side
END;

-- The figure under each flag is now derived from the catalogue, so the manual
-- number becomes an optional override rather than the only source.
COMMENT ON COLUMN public.countries.vehicle_count IS
  'Optional override for the figure shown on the home page. Left null, the count is derived from drive_side.';

UPDATE public.countries SET vehicle_count = NULL;
