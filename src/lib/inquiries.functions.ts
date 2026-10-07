import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { describeDbError } from "./db-error";
import type { DocumentType, InquiryStatus } from "@/integrations/supabase/admin-schema";

// ---------------------------------------------------------------------------
// Public inquiry submission
// ---------------------------------------------------------------------------

const submitSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.string().trim().max(60).optional().or(z.literal("")),
  country: z.string().trim().max(120).optional().or(z.literal("")),
  port: z.string().trim().max(120).optional().or(z.literal("")),
  vehicleText: z.string().trim().max(300).optional().or(z.literal("")),
  vehicleId: z.string().uuid().optional().or(z.literal("")),
  message: z.string().trim().max(4000).optional().or(z.literal("")),
  // Hidden field no real person fills in. Bots do.
  website: z.string().max(0).optional().or(z.literal("")),
});

export type SubmitInquiryInput = z.input<typeof submitSchema>;

const blank = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/**
 * Accepts an inquiry from a signed-in customer.
 *
 * Sign-in is required: the portal can only show someone their quotation and
 * shipping documents if the inquiry is tied to an account from the outset.
 * The email is taken from the session rather than the form, so an inquiry can
 * never be filed under somebody else's address.
 */
export const submitInquiry = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data }) => {
    // Silently accept and discard honeypot hits so bots get no signal.
    if (data.website) return { ok: true as const, refNo: null, error: null as string | null };

    const { adminDb, getSessionUser } = await import("./auth.server");

    const user = await getSessionUser();
    if (!user?.email) {
      return {
        ok: false as const,
        refNo: null,
        error: "Please sign in to send an inquiry.",
      };
    }

    const db = adminDb();

    // The signup trigger creates this row, but an account made before that
    // trigger existed would not have one.
    const { data: existing } = await db
      .from("customers")
      .select("id")
      .eq("auth_user_id", user.userId)
      .maybeSingle();

    let customerId = existing?.id ?? null;
    if (!customerId) {
      const { data: created } = await db
        .from("customers")
        .insert({ auth_user_id: user.userId, email: user.email, name: data.name.trim() })
        .select("id")
        .single();
      customerId = created?.id ?? null;
    }

    const { data: row, error } = await db
      .from("inquiries")
      .insert({
        customer_id: customerId,
        name: data.name.trim(),
        email: user.email.toLowerCase(),
        phone: blank(data.phone),
        country: blank(data.country),
        port: blank(data.port),
        vehicle_text: blank(data.vehicleText),
        vehicle_id: blank(data.vehicleId),
        message: blank(data.message),
      })
      .select("ref_no")
      .single();

    if (error) {
      console.error("inquiry submit failed", error);
      return {
        ok: false as const,
        refNo: null,
        error: "Could not save your inquiry. Please try again.",
      };
    }

    return { ok: true as const, refNo: row.ref_no, error: null as string | null };
  });

// ---------------------------------------------------------------------------
// Customer portal
// ---------------------------------------------------------------------------

export type CustomerInquirySummary = {
  id: string;
  ref_no: string;
  status: InquiryStatus;
  vehicle_text: string | null;
  agreed_price: number | null;
  currency: string | null;
  created_at: string;
  updated_at: string;
  document_count: number;
};

/** The signed-in customer's own inquiries. */
export const listMyInquiries = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser, currentCustomerId, adminDb } = await import("./auth.server");

  const user = await getSessionUser();
  if (!user) return { inquiries: [] as CustomerInquirySummary[], error: "Not signed in" };

  const customerId = await currentCustomerId(user.userId);
  if (!customerId)
    return { inquiries: [] as CustomerInquirySummary[], error: null as string | null };

  const db = adminDb();
  const { data: rows, error } = await db
    .from("inquiries")
    .select("id, ref_no, status, vehicle_text, agreed_price, currency, created_at, updated_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) return { inquiries: [] as CustomerInquirySummary[], error: describeDbError(error) };

  const ids = (rows ?? []).map((row) => row.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: docs } = await db
      .from("inquiry_documents")
      .select("inquiry_id")
      .in("inquiry_id", ids)
      .eq("visible_to_customer", true);
    for (const doc of docs ?? []) {
      counts.set(doc.inquiry_id, (counts.get(doc.inquiry_id) ?? 0) + 1);
    }
  }

  return {
    inquiries: (rows ?? []).map((row) => ({
      ...row,
      document_count: counts.get(row.id) ?? 0,
    })) as CustomerInquirySummary[],
    error: null as string | null,
  };
});

export type CustomerDocument = {
  id: string;
  doc_type: DocumentType;
  title: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: string;
};

export type CustomerInquiryDetail = {
  id: string;
  ref_no: string;
  status: InquiryStatus;
  name: string | null;
  email: string;
  phone: string | null;
  country: string | null;
  port: string | null;
  vehicle_text: string | null;
  message: string | null;
  agreed_price: number | null;
  currency: string | null;
  created_at: string;
  documents: CustomerDocument[];
  timeline: { to_status: InquiryStatus; changed_at: string }[];
};

/** One of the signed-in customer's inquiries, with the files shared with them. */
export const getMyInquiry = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { getSessionUser, currentCustomerId, adminDb } = await import("./auth.server");

    const user = await getSessionUser();
    if (!user) return { inquiry: null, error: "Not signed in" };

    const customerId = await currentCustomerId(user.userId);
    if (!customerId) return { inquiry: null, error: "No customer record" };

    const db = adminDb();
    const { data: row, error } = await db
      .from("inquiries")
      .select(
        "id, ref_no, status, name, email, phone, country, port, vehicle_text, message, agreed_price, currency, created_at",
      )
      // Scoping by customer_id is what stops one customer reading another's
      // inquiry: the service-role client ignores RLS.
      .eq("id", data.id)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (error) return { inquiry: null, error: describeDbError(error) };
    if (!row) return { inquiry: null, error: "Not found" };

    const [{ data: docs }, { data: history }] = await Promise.all([
      db
        .from("inquiry_documents")
        .select("id, doc_type, title, file_size, mime_type, uploaded_at")
        .eq("inquiry_id", row.id)
        .eq("visible_to_customer", true)
        .order("uploaded_at", { ascending: false }),
      db
        .from("inquiry_status_history")
        .select("to_status, changed_at")
        .eq("inquiry_id", row.id)
        .order("changed_at", { ascending: true }),
    ]);

    return {
      inquiry: {
        ...row,
        documents: (docs ?? []) as CustomerDocument[],
        timeline: (history ?? []) as { to_status: InquiryStatus; changed_at: string }[],
      } as CustomerInquiryDetail,
      error: null as string | null,
    };
  });

/**
 * A short-lived download link for one document the customer is allowed to see.
 * The bucket is private, so this signed URL is the only way out.
 */
export const getMyDocumentUrl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { getSessionUser, currentCustomerId, adminDb } = await import("./auth.server");
    const { DOCUMENT_BUCKET } = await import("@/integrations/supabase/admin-schema");

    const user = await getSessionUser();
    if (!user) return { url: null, error: "Not signed in" };

    const customerId = await currentCustomerId(user.userId);
    if (!customerId) return { url: null, error: "No customer record" };

    const db = adminDb();
    const { data: doc } = await db
      .from("inquiry_documents")
      .select("storage_path, visible_to_customer, inquiry_id")
      .eq("id", data.documentId)
      .maybeSingle();

    if (!doc || !doc.visible_to_customer) return { url: null, error: "Not found" };

    const { data: owns } = await db
      .from("inquiries")
      .select("id")
      .eq("id", doc.inquiry_id)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (!owns) return { url: null, error: "Not found" };

    const { data: signed, error } = await db.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrl(doc.storage_path, 60 * 5);

    if (error || !signed) return { url: null, error: "Could not create download link" };
    return { url: signed.signedUrl, error: null as string | null };
  });
