-- Vehicles a customer has saved for later.
--
-- The heart in the header had no behaviour behind it. Saving is the step before
-- an inquiry: a customer marks the cars they are weighing up, then sends one
-- inquiry about the shortlist. It is per customer, not per browser, so it
-- survives changing device.

CREATE TABLE public.saved_vehicles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  vehicle_id  uuid NOT NULL REFERENCES public.vehicles (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, vehicle_id)
);

CREATE INDEX saved_vehicles_customer_idx ON public.saved_vehicles (customer_id, created_at DESC);

ALTER TABLE public.saved_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers manage their own saved vehicles"
  ON public.saved_vehicles FOR ALL TO authenticated
  USING (
    customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Staff read saved vehicles"
  ON public.saved_vehicles FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- The currency badge in the header was hard coded. It lives with the rest of
-- the brand settings so staff can change it.
UPDATE public.site_settings
   SET value = value || jsonb_build_object('currency_label', 'JPY, ¥')
 WHERE key = 'contact'
   AND NOT (value ? 'currency_label');
