import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { describeDbError } from "./db-error";
import {
  DOCUMENT_TYPES,
  INQUIRY_STATUSES,
  type AppRole,
  type DocumentType,
  type InquiryRow,
  type InquiryStatus,
} from "@/integrations/supabase/admin-schema";

const statusEnum = z.enum(INQUIRY_STATUSES);
const docTypeEnum = z.enum(DOCUMENT_TYPES);

/** Shape returned to the client when a staff-only call is refused. */
function denied(error: unknown): string {
  const message = error instanceof Error ? error.message : "Request failed";
  return message.startsWith("Unauthorized") || message.startsWith("Forbidden")
    ? message
    : "Request failed";
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export type AdminSession = {
  userId: string;
  email: string | null;
  name: string | null;
  isStaff: boolean;
  isAdmin: boolean;
};

/** Answers "who is calling, and may they use the dashboard?" without throwing. */
export const getAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("./auth.server");
  const user = await getSessionUser();
  if (!user) return { session: null as AdminSession | null };
  return {
    session: {
      userId: user.userId,
      email: user.email,
      name: user.name,
      isStaff: user.isStaff,
      isAdmin: user.isAdmin,
    } satisfies AdminSession,
  };
});

// ---------------------------------------------------------------------------
// Inquiry list
// ---------------------------------------------------------------------------

export type AdminInquiryRow = {
  id: string;
  ref_no: string;
  name: string | null;
  email: string;
  country: string | null;
  vehicle_text: string | null;
  status: InquiryStatus;
  agreed_price: number | null;
  currency: string | null;
  created_at: string;
};

const listSchema = z.object({
  status: statusEnum.optional(),
  q: z.string().trim().max(200).optional(),
  page: z.number().int().min(1).optional(),
  perPage: z.number().int().min(1).max(100).optional(),
});

export const listInquiries = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => listSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");
    const empty = { inquiries: [] as AdminInquiryRow[], total: 0, page: 1, perPage: 25 };

    try {
      await requireStaff();
    } catch (error) {
      return { ...empty, error: denied(error) };
    }

    const perPage = data.perPage ?? 25;
    const page = data.page ?? 1;

    let query = adminDb()
      .from("inquiries")
      .select(
        "id, ref_no, name, email, country, vehicle_text, status, agreed_price, currency, created_at",
        {
          count: "exact",
        },
      );

    if (data.status) query = query.eq("status", data.status);
    if (data.q) {
      const term = `%${data.q}%`;
      query = query.or(
        `ref_no.ilike.${term},name.ilike.${term},email.ilike.${term},vehicle_text.ilike.${term}`,
      );
    }

    const {
      data: rows,
      count,
      error,
    } = await query
      .order("created_at", { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1);

    if (error) return { ...empty, page, perPage, error: describeDbError(error) };

    return {
      inquiries: (rows ?? []) as AdminInquiryRow[],
      total: count ?? 0,
      page,
      perPage,
      error: null as string | null,
    };
  });

// ---------------------------------------------------------------------------
// Inquiry detail
// ---------------------------------------------------------------------------

export type AdminDocument = {
  id: string;
  doc_type: DocumentType;
  title: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  visible_to_customer: boolean;
  uploaded_at: string;
};

export type AdminInquiryDetail = {
  id: string;
  ref_no: string;
  customer_id: string | null;
  vehicle_id: string | null;
  name: string | null;
  email: string;
  phone: string | null;
  country: string | null;
  port: string | null;
  vehicle_text: string | null;
  message: string | null;
  status: InquiryStatus;
  agreed_price: number | null;
  currency: string | null;
  created_at: string;
  updated_at: string;
  documents: AdminDocument[];
  notes: { id: string; note: string; created_at: string }[];
  history: {
    id: string;
    from_status: InquiryStatus | null;
    to_status: InquiryStatus;
    changed_at: string;
  }[];
};

export const getInquiry = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    try {
      await requireStaff();
    } catch (error) {
      return { inquiry: null, error: denied(error) };
    }

    const db = adminDb();
    const { data: row, error } = await db
      .from("inquiries")
      .select(
        "id, ref_no, customer_id, vehicle_id, name, email, phone, country, port, vehicle_text, message, status, agreed_price, currency, created_at, updated_at",
      )
      .eq("id", data.id)
      .maybeSingle();

    if (error) return { inquiry: null, error: describeDbError(error) };
    if (!row) return { inquiry: null, error: "Not found" };

    const [{ data: documents }, { data: notes }, { data: history }] = await Promise.all([
      db
        .from("inquiry_documents")
        .select(
          "id, doc_type, title, storage_path, file_size, mime_type, visible_to_customer, uploaded_at",
        )
        .eq("inquiry_id", row.id)
        .order("uploaded_at", { ascending: false }),
      db
        .from("inquiry_notes")
        .select("id, note, created_at")
        .eq("inquiry_id", row.id)
        .order("created_at", { ascending: false }),
      db
        .from("inquiry_status_history")
        .select("id, from_status, to_status, changed_at")
        .eq("inquiry_id", row.id)
        .order("changed_at", { ascending: true }),
    ]);

    return {
      inquiry: {
        ...row,
        documents: (documents ?? []) as AdminDocument[],
        notes: (notes ?? []) as { id: string; note: string; created_at: string }[],
        history: (history ?? []) as AdminInquiryDetail["history"],
      } as AdminInquiryDetail,
      error: null as string | null,
    };
  });

// ---------------------------------------------------------------------------
// Inquiry mutations
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  id: z.string().uuid(),
  status: statusEnum.optional(),
  agreedPrice: z.number().nonnegative().nullable().optional(),
  currency: z.string().trim().max(8).nullable().optional(),
});

export const updateInquiry = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    let actor: string;
    try {
      actor = (await requireStaff()).userId;
    } catch (error) {
      return { ok: false as const, error: denied(error) };
    }

    const patch: Partial<InquiryRow> = {};
    if (data.status !== undefined) patch.status = data.status;
    if (data.agreedPrice !== undefined) patch.agreed_price = data.agreedPrice;
    if (data.currency !== undefined) patch.currency = data.currency;
    if (Object.keys(patch).length === 0) return { ok: true as const, error: null as string | null };

    const db = adminDb();

    // The status-history trigger records auth.uid(), which is null under the
    // service-role client, so the actor is stamped here instead.
    const { data: before } = await db
      .from("inquiries")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await db.from("inquiries").update(patch).eq("id", data.id);
    if (error) return { ok: false as const, error: describeDbError(error) };

    if (data.status && before && before.status !== data.status) {
      await db
        .from("inquiry_status_history")
        .update({ changed_by: actor })
        .eq("inquiry_id", data.id)
        .is("changed_by", null);
    }

    return { ok: true as const, error: null as string | null };
  });

export const addInquiryNote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ inquiryId: z.string().uuid(), note: z.string().trim().min(1).max(4000) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    let actor: string;
    try {
      actor = (await requireStaff()).userId;
    } catch (error) {
      return { ok: false as const, error: denied(error) };
    }

    const { error } = await adminDb()
      .from("inquiry_notes")
      .insert({ inquiry_id: data.inquiryId, note: data.note, author_id: actor });

    return error
      ? { ok: false as const, error: describeDbError(error) }
      : { ok: true as const, error: null as string | null };
  });

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/** Keeps the storage key predictable and free of anything path-ish. */
function storageKey(inquiryId: string, fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const ext =
    dot > 0
      ? fileName
          .slice(dot + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
      : "";
  return `${inquiryId}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
}

/**
 * Hands the browser a one-shot upload URL so large files go straight to
 * storage instead of through the server function.
 */
export const createDocumentUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ inquiryId: z.string().uuid(), fileName: z.string().trim().min(1).max(255) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");
    const { DOCUMENT_BUCKET } = await import("@/integrations/supabase/admin-schema");

    try {
      await requireStaff();
    } catch (error) {
      return { path: null, token: null, error: denied(error) };
    }

    const path = storageKey(data.inquiryId, data.fileName);
    const { data: signed, error } = await adminDb()
      .storage.from(DOCUMENT_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !signed)
      return { path: null, token: null, error: error?.message ?? "Could not start upload" };
    return { path: signed.path, token: signed.token, error: null as string | null };
  });

/** Records an uploaded file against the inquiry. Hidden from the customer until published. */
export const recordDocument = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        inquiryId: z.string().uuid(),
        storagePath: z.string().trim().min(1).max(500),
        title: z.string().trim().min(1).max(200),
        docType: docTypeEnum,
        fileSize: z.number().int().nonnegative().nullable().optional(),
        mimeType: z.string().trim().max(150).nullable().optional(),
        visibleToCustomer: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    let actor: string;
    try {
      actor = (await requireStaff()).userId;
    } catch (error) {
      return { ok: false as const, error: denied(error) };
    }

    // The signed upload URL was issued for this inquiry's folder; refuse a path
    // that points anywhere else.
    if (!data.storagePath.startsWith(`${data.inquiryId}/`)) {
      return { ok: false as const, error: "Invalid storage path" };
    }

    const { error } = await adminDb()
      .from("inquiry_documents")
      .insert({
        inquiry_id: data.inquiryId,
        storage_path: data.storagePath,
        title: data.title,
        doc_type: data.docType,
        file_size: data.fileSize ?? null,
        mime_type: data.mimeType ?? null,
        visible_to_customer: data.visibleToCustomer ?? false,
        uploaded_by: actor,
      });

    return error
      ? { ok: false as const, error: describeDbError(error) }
      : { ok: true as const, error: null as string | null };
  });

export const setDocumentVisibility = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ documentId: z.string().uuid(), visible: z.boolean() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    try {
      await requireStaff();
    } catch (error) {
      return { ok: false as const, error: denied(error) };
    }

    const { error } = await adminDb()
      .from("inquiry_documents")
      .update({ visible_to_customer: data.visible })
      .eq("id", data.documentId);

    return error
      ? { ok: false as const, error: describeDbError(error) }
      : { ok: true as const, error: null as string | null };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");
    const { DOCUMENT_BUCKET } = await import("@/integrations/supabase/admin-schema");

    try {
      await requireStaff();
    } catch (error) {
      return { ok: false as const, error: denied(error) };
    }

    const db = adminDb();
    const { data: doc } = await db
      .from("inquiry_documents")
      .select("storage_path")
      .eq("id", data.documentId)
      .maybeSingle();

    if (!doc) return { ok: false as const, error: "Not found" };

    // Remove the row first: an orphaned storage object is harmless, a row
    // pointing at a missing file is a broken download for the customer.
    const { error } = await db.from("inquiry_documents").delete().eq("id", data.documentId);
    if (error) return { ok: false as const, error: describeDbError(error) };

    await db.storage.from(DOCUMENT_BUCKET).remove([doc.storage_path]);
    return { ok: true as const, error: null as string | null };
  });

/** Short-lived download link for staff, for any document. */
export const getDocumentUrl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ documentId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");
    const { DOCUMENT_BUCKET } = await import("@/integrations/supabase/admin-schema");

    try {
      await requireStaff();
    } catch (error) {
      return { url: null, error: denied(error) };
    }

    const db = adminDb();
    const { data: doc } = await db
      .from("inquiry_documents")
      .select("storage_path")
      .eq("id", data.documentId)
      .maybeSingle();

    if (!doc) return { url: null, error: "Not found" };

    const { data: signed, error } = await db.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrl(doc.storage_path, 60 * 5);

    if (error || !signed) return { url: null, error: "Could not create download link" };
    return { url: signed.signedUrl, error: null as string | null };
  });

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type DashboardStats = {
  byStatus: { status: InquiryStatus; count: number }[];
  totalInquiries: number;
  newThisWeek: number;
  previousWeek: number;
  openDeals: number;
  needsAttention: number;
  totalVehicles: number;
  availableVehicles: number;
  featuredVehicles: number;
  customers: number;
  documents: number;
  topMakes: { name: string; count: number }[];
  recent: {
    id: string;
    ref_no: string;
    name: string | null;
    status: InquiryStatus;
    created_at: string;
  }[];
};

const EMPTY_STATS: DashboardStats = {
  byStatus: [],
  totalInquiries: 0,
  newThisWeek: 0,
  previousWeek: 0,
  openDeals: 0,
  needsAttention: 0,
  totalVehicles: 0,
  availableVehicles: 0,
  featuredVehicles: 0,
  customers: 0,
  documents: 0,
  topMakes: [],
  recent: [],
};

export const getDashboardStats = createServerFn({ method: "GET" }).handler(async () => {
  const { requireStaff, adminDb } = await import("./auth.server");

  try {
    await requireStaff();
  } catch (error) {
    return { stats: EMPTY_STATS, error: denied(error) };
  }

  const db = adminDb();
  const day = 24 * 60 * 60 * 1000;
  const weekAgo = new Date(Date.now() - 7 * day).toISOString();
  const fortnightAgo = new Date(Date.now() - 14 * day).toISOString();

  const [
    { data: statuses },
    thisWeek,
    lastFortnight,
    vehicleCount,
    availableCount,
    featuredCount,
    customerCount,
    documentCount,
    { data: makeRows },
    { data: recent },
  ] = await Promise.all([
    db.from("inquiries").select("status"),
    db.from("inquiries").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    db
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .gte("created_at", fortnightAgo)
      .lt("created_at", weekAgo),
    db.from("vehicles").select("id", { count: "exact", head: true }),
    db.from("vehicles").select("id", { count: "exact", head: true }).eq("status", "Available"),
    db.from("vehicles").select("id", { count: "exact", head: true }).eq("is_featured", true),
    db.from("customers").select("id", { count: "exact", head: true }),
    db.from("inquiry_documents").select("id", { count: "exact", head: true }),
    db.from("vehicles").select("make"),
    db
      .from("inquiries")
      .select("id, ref_no, name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const tally = new Map<InquiryStatus, number>();
  for (const row of statuses ?? []) {
    tally.set(row.status, (tally.get(row.status) ?? 0) + 1);
  }

  const makeTally = new Map<string, number>();
  for (const row of makeRows ?? []) {
    if (row.make) makeTally.set(row.make, (makeTally.get(row.make) ?? 0) + 1);
  }

  // Deals in flight — won but not yet delivered or lost.
  const openStatuses: InquiryStatus[] = ["deal_won", "docs_ready", "shipped"];
  // Nobody has replied to these yet.
  const attentionStatuses: InquiryStatus[] = ["new", "contacted"];

  const sum = (list: InquiryStatus[]) =>
    list.reduce((total, status) => total + (tally.get(status) ?? 0), 0);

  return {
    stats: {
      byStatus: INQUIRY_STATUSES.map((status) => ({ status, count: tally.get(status) ?? 0 })),
      totalInquiries: statuses?.length ?? 0,
      newThisWeek: thisWeek.count ?? 0,
      previousWeek: lastFortnight.count ?? 0,
      openDeals: sum(openStatuses),
      needsAttention: sum(attentionStatuses),
      totalVehicles: vehicleCount.count ?? 0,
      availableVehicles: availableCount.count ?? 0,
      featuredVehicles: featuredCount.count ?? 0,
      customers: customerCount.count ?? 0,
      documents: documentCount.count ?? 0,
      topMakes: [...makeTally.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 6),
      recent: (recent ?? []) as DashboardStats["recent"],
    } satisfies DashboardStats,
    error: null as string | null,
  };
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  roles: AppRole[];
  emailConfirmed: boolean;
  lastSignInAt: string | null;
  createdAt: string;
};

/**
 * Supabase's admin API lists accounts page by page and cannot filter, so the
 * whole set is pulled once and searched here. That is comfortable at this
 * business's scale, and the cap keeps it from ever becoming an unbounded read.
 */
const USER_SCAN_PAGE = 200;
const USER_SCAN_CAP = 1000;

const usersSchema = z.object({
  q: z.string().trim().max(200).optional(),
  page: z.number().int().min(1).optional(),
  perPage: z.number().int().min(1).max(100).optional(),
});

export const listUsers = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => usersSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb } = await import("./auth.server");

    try {
      await requireAdmin();
    } catch (error) {
      return { rows: [] as AdminUserRow[], total: 0, error: denied(error) };
    }

    const db = adminDb();
    const collected: Omit<AdminUserRow, "roles">[] = [];

    for (let page = 1; collected.length < USER_SCAN_CAP; page += 1) {
      const { data: batch, error } = await db.auth.admin.listUsers({
        page,
        perPage: USER_SCAN_PAGE,
      });
      if (error) return { rows: [] as AdminUserRow[], total: 0, error: error.message };

      const users = batch?.users ?? [];
      for (const user of users) {
        const meta = user.user_metadata as { full_name?: unknown } | undefined;
        collected.push({
          id: user.id,
          email: user.email ?? "",
          name: typeof meta?.full_name === "string" ? meta.full_name : null,
          emailConfirmed: Boolean(user.email_confirmed_at),
          lastSignInAt: user.last_sign_in_at ?? null,
          createdAt: user.created_at,
        });
      }
      if (users.length < USER_SCAN_PAGE) break;
    }

    const { data: roleRows } = await db.from("user_roles").select("user_id, role");
    const rolesByUser = new Map<string, AppRole[]>();
    for (const row of roleRows ?? []) {
      const list = rolesByUser.get(row.user_id) ?? [];
      list.push(row.role);
      rolesByUser.set(row.user_id, list);
    }

    const q = data.q?.toLowerCase();
    const matched: AdminUserRow[] = collected
      .map((user) => ({ ...user, roles: rolesByUser.get(user.id) ?? [] }))
      .filter(
        (user) =>
          !q || user.email.toLowerCase().includes(q) || (user.name ?? "").toLowerCase().includes(q),
      );

    const perPage = data.perPage ?? 25;
    const page = data.page ?? 1;
    const start = (page - 1) * perPage;

    return {
      rows: matched.slice(start, start + perPage),
      total: matched.length,
      error: null as string | null,
    };
  });

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
});

/** Edits another account's name and sign-in address. Admins only. */
export const updateUserAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updateUserSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireAdmin, adminDb } = await import("./auth.server");

    try {
      await requireAdmin();
    } catch (error) {
      return { ok: false as const, error: denied(error) };
    }

    const db = adminDb();
    const attrs: {
      email?: string;
      email_confirm?: boolean;
      user_metadata?: Record<string, unknown>;
    } = {};

    if (data.email !== undefined) {
      // An admin changing someone's address is a deliberate act, so it takes
      // effect at once rather than waiting on a confirmation link that person
      // may never receive.
      attrs.email = data.email;
      attrs.email_confirm = true;
    }

    if (data.name !== undefined) {
      // Supabase replaces user_metadata wholesale, so anything already in there
      // has to be carried over or it is lost.
      const { data: existing } = await db.auth.admin.getUserById(data.userId);
      attrs.user_metadata = {
        ...(existing?.user?.user_metadata ?? {}),
        full_name: data.name,
      };
    }

    if (Object.keys(attrs).length === 0) return { ok: true as const, error: null as string | null };

    const { error } = await db.auth.admin.updateUserById(data.userId, attrs);
    if (error) return { ok: false as const, error: error.message };

    // The customers row keeps its own copy of both. A stale address there would
    // collide with the unique index the next time anything touched it.
    const patch: { email?: string; name?: string } = {};
    if (data.email !== undefined) patch.email = data.email;
    if (data.name !== undefined) patch.name = data.name;

    const { error: customerError } = await db
      .from("customers")
      .update(patch as never)
      .eq("auth_user_id", data.userId);
    if (customerError) return { ok: false as const, error: describeDbError(customerError) };

    return { ok: true as const, error: null as string | null };
  });
