import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { describeDbError } from "./db-error";
import {
  DRIVE_SIDES,
  TAXONOMIES,
  type DriveSide,
  type TaxonomyName,
} from "@/integrations/supabase/admin-schema";

/**
 * The four browse lists are structurally identical, so one set of functions
 * serves all of them. `makes` is the only one that names its picture column
 * `logo_url` instead of `image_url`.
 *
 * Because the table is chosen at runtime, the generated per-table types cannot
 * narrow these queries. Rows are therefore selected with `*` and shaped by
 * `toItem` below, which is the single place that decides what a taxonomy row
 * looks like to the rest of the app.
 */
const taxonomyEnum = z.enum(TAXONOMIES);

function imageColumn(taxonomy: TaxonomyName): "logo_url" | "image_url" {
  return taxonomy === "makes" ? "logo_url" : "image_url";
}

export type TaxonomyItem = {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  /** Countries only; null everywhere else. */
  vehicle_count: number | null;
  /** Countries only: which steering side this market takes. */
  drive_side: DriveSide;
};

function toItem(row: Record<string, unknown>, taxonomy: TaxonomyName): TaxonomyItem {
  return {
    id: String(row["id"]),
    slug: String(row["slug"]),
    name: String(row["name"]),
    image_url: (row[imageColumn(taxonomy)] as string | null) ?? null,
    sort_order: Number(row["sort_order"] ?? 0),
    is_active: row["is_active"] !== false,
    vehicle_count:
      row["vehicle_count"] === null || row["vehicle_count"] === undefined
        ? null
        : Number(row["vehicle_count"]),
    drive_side: (DRIVE_SIDES as readonly string[]).includes(String(row["drive_side"]))
      ? (row["drive_side"] as DriveSide)
      : "both",
  };
}

function asRows(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function staffError(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed";
}

// ---------------------------------------------------------------------------
// Read — used by both the public site and the dashboard
// ---------------------------------------------------------------------------

const listSchema = z.object({
  taxonomy: taxonomyEnum,
  includeInactive: z.boolean().optional(),
});

/**
 * Lists one taxonomy. `includeInactive` is staff-only: the public site must
 * never receive entries that have been switched off.
 */
export const listTaxonomy = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data }) => {
    const { adminDb, getSessionUser } = await import("./auth.server");

    let includeInactive = false;
    if (data.includeInactive) {
      const user = await getSessionUser();
      includeInactive = user?.isStaff === true;
    }

    let query = adminDb()
      .from(data.taxonomy)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (!includeInactive) query = query.eq("is_active", true);

    const { data: rows, error } = await query;
    if (error) return { items: [] as TaxonomyItem[], error: describeDbError(error) };

    return {
      items: asRows(rows).map((row) => toItem(row, data.taxonomy)),
      error: null as string | null,
    };
  });

export type AllTaxonomies = {
  makes: TaxonomyItem[];
  body_styles: TaxonomyItem[];
  categories: TaxonomyItem[];
  countries: TaxonomyItem[];
};

/** Every browse list in one call, for the public pages. */
export const listAllTaxonomies = createServerFn({ method: "GET" }).handler(async () => {
  const { adminDb } = await import("./auth.server");
  const db = adminDb();

  const results = await Promise.all(
    TAXONOMIES.map((taxonomy) =>
      db
        .from(taxonomy)
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
    ),
  );

  const out = {} as AllTaxonomies;
  TAXONOMIES.forEach((taxonomy, index) => {
    out[taxonomy] = asRows(results[index]?.data).map((row) => toItem(row, taxonomy));
  });
  return out;
});

// ---------------------------------------------------------------------------
// Write — staff only
// ---------------------------------------------------------------------------

const saveSchema = z.object({
  taxonomy: taxonomyEnum,
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(140).optional(),
  imageUrl: z.string().trim().max(2000).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
  /** Countries only: the figure shown under the flag on the home page. */
  vehicleCount: z.number().int().min(0).max(999999).nullable().optional(),
  /** Countries only: which steering side this market takes. */
  driveSide: z.enum(DRIVE_SIDES).optional(),
});

export type SaveTaxonomyInput = z.input<typeof saveSchema>;

export const saveTaxonomyItem = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    try {
      await requireStaff();
    } catch (error) {
      return { ok: false as const, error: staffError(error) };
    }

    const payload: Record<string, unknown> = {
      name: data.name,
      slug: data.slug?.trim() ? slugify(data.slug) : slugify(data.name),
    };
    if (data.imageUrl !== undefined) payload[imageColumn(data.taxonomy)] = data.imageUrl || null;
    if (data.sortOrder !== undefined) payload["sort_order"] = data.sortOrder;
    if (data.isActive !== undefined) payload["is_active"] = data.isActive;
    // Only the countries table has this column.
    if (data.vehicleCount !== undefined && data.taxonomy === "countries") {
      payload["vehicle_count"] = data.vehicleCount;
    }
    if (data.driveSide !== undefined && data.taxonomy === "countries") {
      payload["drive_side"] = data.driveSide;
    }

    const table = adminDb().from(data.taxonomy);
    const { error } = data.id
      ? await table.update(payload as never).eq("id", data.id)
      : await table.insert(payload as never);

    if (error) {
      // 23505 is a unique violation — a duplicate name or slug.
      return {
        ok: false as const,
        error:
          error.code === "23505"
            ? `"${data.name}" already exists in this list.`
            : describeDbError(error),
      };
    }
    return { ok: true as const, error: null as string | null };
  });

/**
 * Deleting is refused while vehicles still reference the entry. Vehicles store
 * the make, body type and category by name rather than by id, so nothing in the
 * database would block the delete — the affected listings would simply drop out
 * of the browse filters with no warning.
 */
export const deleteTaxonomyItem = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ taxonomy: taxonomyEnum, id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    try {
      await requireStaff();
    } catch (error) {
      return { ok: false as const, error: staffError(error) };
    }

    const db = adminDb();
    const { data: row } = await db.from(data.taxonomy).select("*").eq("id", data.id).maybeSingle();
    if (!row) return { ok: false as const, error: "Not found" };

    const name = String((row as Record<string, unknown>)["name"]);
    const linkedColumn: Record<TaxonomyName, "make" | "body_type" | "category" | null> = {
      makes: "make",
      body_styles: "body_type",
      categories: "category",
      countries: null,
    };
    const column = linkedColumn[data.taxonomy];

    if (column) {
      const { count } = await db
        .from("vehicles")
        .select("id", { count: "exact", head: true })
        .eq(column, name);

      if ((count ?? 0) > 0) {
        return {
          ok: false as const,
          error: `${count} vehicle${count === 1 ? "" : "s"} still use "${name}". Switch it off instead of deleting it.`,
        };
      }
    }

    const { error } = await db.from(data.taxonomy).delete().eq("id", data.id);
    return error
      ? { ok: false as const, error: describeDbError(error) }
      : { ok: true as const, error: null as string | null };
  });

export const reorderTaxonomy = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        taxonomy: taxonomyEnum,
        order: z
          .array(z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0) }))
          .max(500),
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
    for (const entry of data.order) {
      await db
        .from(data.taxonomy)
        .update({ sort_order: entry.sortOrder } as never)
        .eq("id", entry.id);
    }
    return { ok: true as const, error: null as string | null };
  });
