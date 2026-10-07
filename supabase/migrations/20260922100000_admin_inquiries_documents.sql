-- Admin dashboard foundation: roles, customers, inquiries (= orders), documents.
-- The inquiry lifecycle doubles as the order record; there is no payment processing.

-- ---------------------------------------------------------------------------
-- 1. Roles
-- Role lives in its own table, never as a column on a user-editable profile
-- row, so a customer cannot escalate themselves to admin.
-- ---------------------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'customer');

CREATE TABLE public.user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER so policies on user_roles itself do not recurse.
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$fn$;

CREATE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'staff')
  );
$fn$;

CREATE POLICY "Users read own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins read all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 2. Shared helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

-- ---------------------------------------------------------------------------
-- 3. Customers
-- A customer row can exist before the person ever signs in: the public inquiry
-- form creates one from the submitted email. auth_user_id is filled in later,
-- when they create an account with that same address.
-- ---------------------------------------------------------------------------
CREATE TABLE public.customers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE REFERENCES auth.users (id) ON DELETE SET NULL,
  name         text,
  email        text NOT NULL,
  phone        text,
  country      text,
  port         text,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX customers_email_key ON public.customers (lower(email));

CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage customers"
  ON public.customers FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Customers read own record"
  ON public.customers FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Customers update own record"
  ON public.customers FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Inquiries (the order record)
-- ---------------------------------------------------------------------------
CREATE TYPE public.inquiry_status AS ENUM (
  'new',
  'contacted',
  'negotiating',
  'deal_won',
  'docs_ready',
  'shipped',
  'delivered',
  'deal_lost'
);

CREATE SEQUENCE public.inquiry_ref_seq START 1;

CREATE TABLE public.inquiries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_no       text NOT NULL UNIQUE,
  customer_id  uuid REFERENCES public.customers (id) ON DELETE SET NULL,
  vehicle_id   uuid REFERENCES public.vehicles (id) ON DELETE SET NULL,

  -- Snapshot of what was typed into the public form. Kept even if the customer
  -- later edits their profile, so the original request stays auditable.
  name         text,
  email        text NOT NULL,
  phone        text,
  country      text,
  port         text,
  vehicle_text text,
  message      text,

  status       public.inquiry_status NOT NULL DEFAULT 'new',
  agreed_price numeric(12,2),
  currency     text DEFAULT 'USD',
  assigned_to  uuid REFERENCES auth.users (id) ON DELETE SET NULL,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inquiries_status_idx   ON public.inquiries (status, created_at DESC);
CREATE INDEX inquiries_customer_idx ON public.inquiries (customer_id);
CREATE INDEX inquiries_vehicle_idx  ON public.inquiries (vehicle_id);
CREATE INDEX inquiries_email_idx    ON public.inquiries (lower(email));

CREATE TRIGGER inquiries_set_updated_at
  BEFORE UPDATE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Assigns INQ-<year>-#### and attaches or creates the customer from the email,
-- so an anonymous form submission still ends up owned by someone.
CREATE FUNCTION public.handle_new_inquiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  existing_customer uuid;
BEGIN
  IF NEW.ref_no IS NULL OR NEW.ref_no = '' THEN
    NEW.ref_no := 'INQ-' || to_char(now(), 'YYYY') || '-'
                  || lpad(nextval('public.inquiry_ref_seq')::text, 4, '0');
  END IF;

  IF NEW.customer_id IS NULL THEN
    SELECT id INTO existing_customer
      FROM public.customers
     WHERE lower(email) = lower(NEW.email)
     LIMIT 1;

    IF existing_customer IS NULL THEN
      INSERT INTO public.customers (name, email, phone, country, port)
      VALUES (NEW.name, NEW.email, NEW.phone, NEW.country, NEW.port)
      RETURNING id INTO existing_customer;
    END IF;

    NEW.customer_id := existing_customer;
  END IF;

  RETURN NEW;
END;
$fn$;

CREATE TRIGGER inquiries_before_insert
  BEFORE INSERT ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_inquiry();

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- The public form posts as anon. Insert only: anon must never be able to read
-- the table back, or every lead would be scrapeable.
CREATE POLICY "Anyone can submit an inquiry"
  ON public.inquiries FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Staff manage inquiries"
  ON public.inquiries FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Customers read own inquiries"
  ON public.inquiries FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT id FROM public.customers WHERE auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Documents
-- Multiple files per inquiry. visible_to_customer lets an admin stage a file
-- before the customer is allowed to see it.
-- ---------------------------------------------------------------------------
CREATE TYPE public.document_type AS ENUM (
  'invoice',
  'proforma_invoice',
  'bill_of_lading',
  'export_certificate',
  'inspection_report',
  'auction_sheet',
  'photos',
  'other'
);

CREATE TABLE public.inquiry_documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id          uuid NOT NULL REFERENCES public.inquiries (id) ON DELETE CASCADE,
  doc_type            public.document_type NOT NULL DEFAULT 'other',
  title               text NOT NULL,
  storage_path        text NOT NULL UNIQUE,
  file_size           bigint,
  mime_type           text,
  visible_to_customer boolean NOT NULL DEFAULT false,
  uploaded_by         uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  uploaded_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inquiry_documents_inquiry_idx
  ON public.inquiry_documents (inquiry_id, uploaded_at DESC);

ALTER TABLE public.inquiry_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage documents"
  ON public.inquiry_documents FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Customers read own visible documents"
  ON public.inquiry_documents FOR SELECT TO authenticated
  USING (
    visible_to_customer = true
    AND inquiry_id IN (
      SELECT i.id FROM public.inquiries i
      JOIN public.customers c ON c.id = i.customer_id
      WHERE c.auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Internal notes (staff only, never exposed to the customer)
-- ---------------------------------------------------------------------------
CREATE TABLE public.inquiry_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES public.inquiries (id) ON DELETE CASCADE,
  note       text NOT NULL,
  author_id  uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inquiry_notes_inquiry_idx
  ON public.inquiry_notes (inquiry_id, created_at DESC);

ALTER TABLE public.inquiry_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage notes"
  ON public.inquiry_notes FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- 7. Status history
-- ---------------------------------------------------------------------------
CREATE TABLE public.inquiry_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id  uuid NOT NULL REFERENCES public.inquiries (id) ON DELETE CASCADE,
  from_status public.inquiry_status,
  to_status   public.inquiry_status NOT NULL,
  note        text,
  changed_by  uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inquiry_status_history_inquiry_idx
  ON public.inquiry_status_history (inquiry_id, changed_at DESC);

CREATE FUNCTION public.log_inquiry_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.inquiry_status_history (inquiry_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER inquiries_log_status_change
  AFTER UPDATE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.log_inquiry_status_change();

ALTER TABLE public.inquiry_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read status history"
  ON public.inquiry_status_history FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Customers read own status history"
  ON public.inquiry_status_history FOR SELECT TO authenticated
  USING (
    inquiry_id IN (
      SELECT i.id FROM public.inquiries i
      JOIN public.customers c ON c.id = i.customer_id
      WHERE c.auth_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 8. Link a new auth user to any customer row already created from their email
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.link_customer_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  UPDATE public.customers
     SET auth_user_id = NEW.id
   WHERE lower(email) = lower(NEW.email)
     AND auth_user_id IS NULL;

  IF NOT FOUND THEN
    INSERT INTO public.customers (auth_user_id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$fn$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_customer_on_signup();

-- ---------------------------------------------------------------------------
-- 9. Private storage bucket for documents
-- Files are stored as <inquiry_id>/<uuid>.<ext>, so the first path segment
-- identifies the inquiry a file belongs to.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('inquiry-docs', 'inquiry-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff manage inquiry files"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'inquiry-docs' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'inquiry-docs' AND public.is_staff(auth.uid()));

CREATE POLICY "Customers read own visible files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'inquiry-docs'
    AND EXISTS (
      SELECT 1
        FROM public.inquiry_documents d
        JOIN public.inquiries i ON i.id = d.inquiry_id
        JOIN public.customers c ON c.id = i.customer_id
       WHERE d.storage_path = storage.objects.name
         AND d.visible_to_customer = true
         AND c.auth_user_id = auth.uid()
    )
  );
