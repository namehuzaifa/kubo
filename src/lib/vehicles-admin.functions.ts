import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { describeDbError } from "./db-error";
import type { AdminDb } from "./auth.server";
import type { VehicleRow } from "@/integrations/supabase/admin-schema";

/**
 * Columns staff may edit from the dashboard. Editing one adds it to the
 * vehicle's `locked_fields`, which is how a manual correction survives the next
 * inventory sync — the sync upserts whole rows, so without the lock it would
 * silently overwrite the edit.
 */
const EDITABLE = {
  title: z.string().trim().min(1).max(300),
  make: z.string().trim().min(1).max(120),
  model: z.string().trim().min(1).max(120),
  variant: z.string().trim().max(160).nullable(),
  body_type: z.string().trim().max(120).nullable(),
  category: z.string().trim().max(120).nullable(),
  vehicle_type: z.string().trim().max(120).nullable(),
  country: z.string().trim().max(120).nullable(),
  year: z.number().int().min(1900).max(2100).nullable(),
  registration_year: z.number().int().min(1900).max(2100).nullable(),
  mileage: z.number().int().min(0).nullable(),
  mileage_unit: z.string().trim().max(16).nullable(),
  engine_size: z.number().min(0).nullable(),
  fuel: z.string().trim().max(60).nullable(),
  transmission: z.string().trim().max(60).nullable(),
  steering: z.string().trim().max(40).nullable(),
  drivetrain: z.string().trim().max(60).nullable(),
  exterior_color: z.string().trim().max(60).nullable(),
  interior_color: z.string().trim().max(60).nullable(),
  doors: z.number().int().min(0).max(12).nullable(),
  seats: z.number().int().min(0).max(80).nullable(),
  price: z.number().min(0).nullable(),
  currency: z.string().trim().max(8).nullable(),
  status: z.string().trim().min(1).max(40),
  inventory_location: z.string().trim().max(120).nullable(),
  port: z.string().trim().max(120).nullable(),
  description: z.string().trim().max(8000).nullable(),
  is_featured: z.boolean(),
} as const;

export const EDITABLE_FIELDS = Object.keys(EDITABLE) as (keyof typeof EDITABLE)[];

// `is_featured` is ours alone — the feed knows nothing about it, so it never
// needs locking against the sync.
const LOCKABLE = EDITABLE_FIELDS.filter((field) => field !== "is_featured");

const editableSchema = z.object(
  Object.fromEntries(Object.entries(EDITABLE).map(([key, schema]) => [key, schema.optional()])) as {
    [K in keyof typeof EDITABLE]: z.ZodOptional<(typeof EDITABLE)[K]>;
  },
);

function staffError(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export type AdminVehicleRow = {
  id: string;
  stock_id: string;
  slug: string;
  title: string;
  make: string;
  model: string;
  year: number | null;
  body_type: string | null;
  price: number | null;
  currency: string | null;
  status: string;
  is_featured: boolean;
  is_manual: boolean;
  locked_fields: string[];
  updated_at: string;
  /** What the public site actually shows for this vehicle. */
  thumbnail_url: string | null;
};

/**
 * Resolves the picture the website displays for each vehicle, in the same order
 * the public pages use: its own photography first, and otherwise the stock tile
 * for its body style. Source-feed photography is deliberately never used.
 */
async function resolveThumbnails(
  db: AdminDb,
  rows: { id: string; body_type: string | null }[],
): Promise<Map<string, string>> {
  const thumbnails = new Map<string, string>();
  if (rows.length === 0) return thumbnails;

  const { data: images } = await db
    .from("vehicle_images")
    .select("vehicle_id, image_url, image_order")
    .in(
      "vehicle_id",
      rows.map((row) => row.id),
    )
    .order("image_order", { ascending: true });

  for (const image of images ?? []) {
    if (!thumbnails.has(image.vehicle_id)) thumbnails.set(image.vehicle_id, image.image_url);
  }

  const missing = rows.filter((row) => !thumbnails.has(row.id) && row.body_type);
  if (missing.length > 0) {
    const { data: styles } = await db.from("body_styles").select("name, image_url");
    const byName = new Map(
      (styles ?? [])
        .filter((style) => style.image_url)
        .map((style) => [style.name, style.image_url as string]),
    );
    for (const row of missing) {
      const fallback = row.body_type ? byName.get(row.body_type) : undefined;
      if (fallback) thumbnails.set(row.id, fallback);
    }
  }

  return thumbnails;
}

const listSchema = z.object({
  q: z.string().trim().max(200).optional(),
  make: z.string().trim().max(120).optional(),
  bodyType: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  page: z.number().int().min(1).optional(),
  perPage: z.number().int().min(1).max(100).optional(),
});

export const listAdminVehicles = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => listSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");
    const empty = { vehicles: [] as AdminVehicleRow[], total: 0, page: 1, perPage: 25 };

    try {
      await requireStaff();
    } catch (error) {
      return { ...empty, error: staffError(error) };
    }

    const perPage = data.perPage ?? 25;
    const page = data.page ?? 1;

    let query = adminDb()
      .from("vehicles")
      .select(
        "id, stock_id, slug, title, make, model, year, body_type, price, currency, status, is_featured, is_manual, locked_fields, updated_at",
        { count: "exact" },
      );

    if (data.make) query = query.eq("make", data.make);
    if (data.bodyType) query = query.eq("body_type", data.bodyType);
    if (data.status) query = query.eq("status", data.status);
    if (data.q) {
      const term = `%${data.q}%`;
      query = query.or(
        `stock_id.ilike.${term},title.ilike.${term},make.ilike.${term},model.ilike.${term}`,
      );
    }

    const {
      data: rows,
      count,
      error,
    } = await query
      .order("updated_at", { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1);

    if (error) return { ...empty, page, perPage, error: describeDbError(error) };

    const db = adminDb();
    const listed = (rows ?? []) as AdminVehicleRow[];
    const thumbnails = await resolveThumbnails(db, listed);

    return {
      vehicles: listed.map((vehicle) => ({
        ...vehicle,
        thumbnail_url: thumbnails.get(vehicle.id) ?? null,
      })),
      total: count ?? 0,
      page,
      perPage,
      error: null as string | null,
    };
  });

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export type AdminVehicleImage = {
  id: string;
  image_url: string;
  image_order: number;
  alt_text: string | null;
};

export const getAdminVehicle = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    const empty = { vehicle: null as VehicleRow | null, images: [] as AdminVehicleImage[] };

    try {
      await requireStaff();
    } catch (error) {
      return { ...empty, error: staffError(error) };
    }

    const db = adminDb();
    const { data: vehicle, error } = await db
      .from("vehicles")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();

    if (error) return { ...empty, error: describeDbError(error) };
    if (!vehicle) return { ...empty, error: "Not found" };

    const { data: images } = await db
      .from("vehicle_images")
      .select("id, image_url, image_order, alt_text")
      .eq("vehicle_id", data.id)
      .order("image_order", { ascending: true });

    return {
      vehicle: vehicle as VehicleRow,
      images: (images ?? []) as AdminVehicleImage[],
      error: null as string | null,
    };
  });

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  stockId: z.string().trim().min(1).max(60).optional(),
  fields: editableSchema,
});

export const saveVehicle = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    try {
      await requireStaff();
    } catch (error) {
      return { ok: false as const, id: null, error: staffError(error) };
    }

    const db = adminDb();
    const fields = Object.fromEntries(
      Object.entries(data.fields).filter(([, value]) => value !== undefined),
    ) as Record<string, unknown>;

    if (Object.keys(fields).length === 0 && data.id) {
      return { ok: true as const, id: data.id, error: null as string | null };
    }

    // --- update ------------------------------------------------------------
    if (data.id) {
      const { data: current } = await db
        .from("vehicles")
        .select("locked_fields")
        .eq("id", data.id)
        .maybeSingle();

      const locked = new Set<string>((current?.locked_fields as string[] | undefined) ?? []);
      for (const field of Object.keys(fields)) {
        if ((LOCKABLE as string[]).includes(field)) locked.add(field);
      }

      const { error } = await db
        .from("vehicles")
        .update({ ...fields, locked_fields: [...locked], updated_at: new Date().toISOString() })
        .eq("id", data.id);

      return error
        ? { ok: false as const, id: null, error: describeDbError(error) }
        : { ok: true as const, id: data.id, error: null as string | null };
    }

    // --- create ------------------------------------------------------------
    const title = (fields["title"] as string | undefined) ?? "";
    const make = (fields["make"] as string | undefined) ?? "";
    const model = (fields["model"] as string | undefined) ?? "";
    if (!title || !make || !model) {
      return { ok: false as const, id: null, error: "Title, make and model are required." };
    }

    const stockId = data.stockId?.trim() || `MAN-${Date.now().toString(36).toUpperCase()}`;
    const year = fields["year"] as number | null | undefined;
    const slug = slugify([make, model, year, stockId].filter(Boolean).join(" "));

    const { data: created, error } = await db
      .from("vehicles")
      .insert({
        ...fields,
        title,
        make,
        model,
        stock_id: stockId,
        slug,
        status: (fields["status"] as string | undefined) ?? "Available",
        // Listings created here are not in the feed, so the sync must leave
        // them alone entirely rather than treating them as stale and removing them.
        is_manual: true,
        locked_fields: LOCKABLE as unknown as string[],
        source_name: "manual",
      })
      .select("id")
      .single();

    if (error) {
      const message =
        error.code === "23505"
          ? "A vehicle with that stock ID or slug already exists."
          : describeDbError(error);
      return { ok: false as const, id: null, error: message };
    }
    return { ok: true as const, id: created.id as string, error: null as string | null };
  });

/** Clears a lock so the inventory sync may manage that column again. */
export const unlockVehicleField = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), field: z.string().trim().max(60) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    try {
      await requireStaff();
    } catch (error) {
      return { ok: false as const, error: staffError(error) };
    }

    const db = adminDb();
    const { data: current } = await db
      .from("vehicles")
      .select("locked_fields")
      .eq("id", data.id)
      .maybeSingle();

    const locked = ((current?.locked_fields as string[] | undefined) ?? []).filter(
      (field) => field !== data.field,
    );
    const { error } = await db.from("vehicles").update({ locked_fields: locked }).eq("id", data.id);

    return error
      ? { ok: false as const, error: describeDbError(error) }
      : { ok: true as const, error: null as string | null };
  });

export const deleteVehicle = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    try {
      await requireStaff();
    } catch (error) {
      return { ok: false as const, error: staffError(error) };
    }

    // Images, features and pricing cascade with the vehicle.
    const { error } = await adminDb().from("vehicles").delete().eq("id", data.id);
    return error
      ? { ok: false as const, error: describeDbError(error) }
      : { ok: true as const, error: null as string | null };
  });

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export const addVehicleImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        vehicleId: z.string().uuid(),
        imageUrl: z.string().trim().url().max(2000),
        altText: z.string().trim().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    try {
      await requireStaff();
    } catch (error) {
      return { ok: false as const, error: staffError(error) };
    }

    const db = adminDb();
    const { count } = await db
      .from("vehicle_images")
      .select("id", { count: "exact", head: true })
      .eq("vehicle_id", data.vehicleId);

    const { error } = await db.from("vehicle_images").insert({
      vehicle_id: data.vehicleId,
      image_url: data.imageUrl,
      alt_text: data.altText ?? null,
      image_order: count ?? 0,
    });

    return error
      ? { ok: false as const, error: describeDbError(error) }
      : { ok: true as const, error: null as string | null };
  });

export const deleteVehicleImage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ imageId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    try {
      await requireStaff();
    } catch (error) {
      return { ok: false as const, error: staffError(error) };
    }

    const { error } = await adminDb().from("vehicle_images").delete().eq("id", data.imageId);
    return error
      ? { ok: false as const, error: describeDbError(error) }
      : { ok: true as const, error: null as string | null };
  });

// ---------------------------------------------------------------------------
// Filter options for the list screen
// ---------------------------------------------------------------------------

export const getVehicleFilterOptions = createServerFn({ method: "GET" }).handler(async () => {
  const { requireStaff, adminDb } = await import("./auth.server");

  try {
    await requireStaff();
  } catch {
    return { makes: [] as string[], bodyTypes: [] as string[], statuses: [] as string[] };
  }

  const db = adminDb();
  const { data: rows } = await db.from("vehicles").select("make, body_type, status");

  const unique = (values: (string | null)[]) =>
    [...new Set(values.filter((value): value is string => Boolean(value)))].sort();

  return {
    makes: unique((rows ?? []).map((row) => row.make)),
    bodyTypes: unique((rows ?? []).map((row) => row.body_type)),
    statuses: unique((rows ?? []).map((row) => row.status)),
  };
});
