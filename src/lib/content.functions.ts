import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { describeDbError } from "./db-error";
import {
  EDITABLE_PAGES,
  type ContactSettings,
  type PageBlockRow,
  type PageContentRow,
} from "@/integrations/supabase/admin-schema";

const pageEnum = z.enum(EDITABLE_PAGES);

/**
 * Used whenever the database has not answered — during the first render of a
 * fresh install, or if the settings row is ever missing. Without it the header
 * would render with an empty phone number.
 */
export const FALLBACK_CONTACT: ContactSettings = {
  name: "Kubo Trading Japan",
  tagline: "Japanese Used Car Exporter",
  phone: "",
  email: "",
  address: "",
  logo_url: "",
  currency_label: "JPY, ¥",
};

function staffError(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed";
}

// ---------------------------------------------------------------------------
// Contact details
// ---------------------------------------------------------------------------

/** Brand and contact details for the header, footer and Contact page. */
export const getSiteSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { adminDb } = await import("./auth.server");

  try {
    const { data } = await adminDb()
      .from("site_settings")
      .select("value")
      .eq("key", "contact")
      .maybeSingle();

    const stored = (data?.value ?? {}) as Partial<ContactSettings>;
    return { contact: { ...FALLBACK_CONTACT, ...stored } satisfies ContactSettings };
  } catch {
    // The site must still render if the settings table is unreachable.
    return { contact: FALLBACK_CONTACT };
  }
});

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  tagline: z.string().trim().max(160),
  phone: z.string().trim().max(60),
  email: z.string().trim().max(200),
  address: z.string().trim().max(400),
  logo_url: z.string().trim().max(2000),
  currency_label: z.string().trim().max(24),
});

export const saveSiteSettings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => contactSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    try {
      await requireStaff();
    } catch (error) {
      return { ok: false as const, error: staffError(error) };
    }

    const { error } = await adminDb()
      .from("site_settings")
      .upsert({ key: "contact", value: data }, { onConflict: "key" });

    return error
      ? { ok: false as const, error: describeDbError(error) }
      : { ok: true as const, error: null as string | null };
  });

// ---------------------------------------------------------------------------
// Page copy
// ---------------------------------------------------------------------------

export type PageBlock = Pick<
  PageBlockRow,
  | "id"
  | "title"
  | "body"
  | "image_url"
  | "cta_label"
  | "cta_href"
  | "variant"
  | "ends_at"
  | "sort_order"
  | "is_active"
>;

export type PageContent = {
  page: PageContentRow | null;
  blocks: PageBlock[];
};

const getPageSchema = z.object({
  slug: pageEnum,
  includeInactive: z.boolean().optional(),
});

/** One page's copy and its repeatable blocks. */
export const getPageContent = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => getPageSchema.parse(input))
  .handler(async ({ data }): Promise<PageContent> => {
    const { adminDb, getSessionUser } = await import("./auth.server");

    let includeInactive = false;
    if (data.includeInactive) {
      const user = await getSessionUser();
      includeInactive = user?.isStaff === true;
    }

    try {
      const db = adminDb();
      const { data: page } = await db
        .from("page_content")
        .select("*")
        .eq("slug", data.slug)
        .maybeSingle();

      let query = db
        .from("page_blocks")
        .select(
          "id, title, body, image_url, cta_label, cta_href, variant, ends_at, sort_order, is_active",
        )
        .eq("page_slug", data.slug)
        .order("sort_order", { ascending: true });

      if (!includeInactive) query = query.eq("is_active", true);

      const { data: blocks } = await query;
      return {
        page: (page ?? null) as PageContentRow | null,
        blocks: (blocks ?? []) as PageBlock[],
      };
    } catch {
      // A page that cannot reach the database still renders from its route
      // defaults rather than failing the whole request.
      return { page: null, blocks: [] };
    }
  });

const savePageSchema = z.object({
  slug: pageEnum,
  title: z.string().trim().min(1).max(120),
  heroTitle: z.string().trim().min(1).max(200),
  heroSubtitle: z.string().trim().max(600).nullable().optional(),
  body: z.string().trim().max(20000).nullable().optional(),
  heroImageUrl: z.string().trim().max(2000).nullable().optional(),
  ctaLabel: z.string().trim().max(80).nullable().optional(),
  ctaHref: z.string().trim().max(400).nullable().optional(),
  metaTitle: z.string().trim().max(200).nullable().optional(),
  metaDescription: z.string().trim().max(400).nullable().optional(),
});

export const savePageContent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => savePageSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    try {
      await requireStaff();
    } catch (error) {
      return { ok: false as const, error: staffError(error) };
    }

    const { error } = await adminDb()
      .from("page_content")
      .update({
        title: data.title,
        hero_title: data.heroTitle,
        hero_subtitle: data.heroSubtitle || null,
        body: data.body || null,
        hero_image_url: data.heroImageUrl || null,
        cta_label: data.ctaLabel || null,
        cta_href: data.ctaHref || null,
        meta_title: data.metaTitle || null,
        meta_description: data.metaDescription || null,
      })
      .eq("slug", data.slug);

    return error
      ? { ok: false as const, error: describeDbError(error) }
      : { ok: true as const, error: null as string | null };
  });

// ---------------------------------------------------------------------------
// Page blocks
// ---------------------------------------------------------------------------

const saveBlockSchema = z.object({
  pageSlug: pageEnum,
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(4000).nullable().optional(),
  imageUrl: z.string().trim().max(2000).nullable().optional(),
  ctaLabel: z.string().trim().max(80).nullable().optional(),
  ctaHref: z.string().trim().max(400).nullable().optional(),
  endsAt: z.string().trim().max(40).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export type SavePageBlockInput = z.input<typeof saveBlockSchema>;

export const savePageBlock = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => saveBlockSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    try {
      await requireStaff();
    } catch (error) {
      return { ok: false as const, error: staffError(error) };
    }

    const db = adminDb();
    const payload = {
      page_slug: data.pageSlug,
      title: data.title,
      body: data.body || null,
      ...(data.imageUrl === undefined ? {} : { image_url: data.imageUrl || null }),
      ...(data.ctaLabel === undefined ? {} : { cta_label: data.ctaLabel || null }),
      ...(data.ctaHref === undefined ? {} : { cta_href: data.ctaHref || null }),
      ...(data.endsAt === undefined ? {} : { ends_at: data.endsAt || null }),
      ...(data.sortOrder === undefined ? {} : { sort_order: data.sortOrder }),
      ...(data.isActive === undefined ? {} : { is_active: data.isActive }),
    };

    const { error } = data.id
      ? await db.from("page_blocks").update(payload).eq("id", data.id)
      : await db.from("page_blocks").insert(payload);

    return error
      ? { ok: false as const, error: describeDbError(error) }
      : { ok: true as const, error: null as string | null };
  });

export const deletePageBlock = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    try {
      await requireStaff();
    } catch (error) {
      return { ok: false as const, error: staffError(error) };
    }

    const { error } = await adminDb().from("page_blocks").delete().eq("id", data.id);
    return error
      ? { ok: false as const, error: describeDbError(error) }
      : { ok: true as const, error: null as string | null };
  });

export const reorderPageBlocks = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        order: z
          .array(z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0) }))
          .max(200),
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
      await db.from("page_blocks").update({ sort_order: entry.sortOrder }).eq("id", entry.id);
    }
    return { ok: true as const, error: null as string | null };
  });

// ---------------------------------------------------------------------------
// Top menu
// ---------------------------------------------------------------------------

export type NavItem = { id: string; label: string; href: string; is_active: boolean };

/** The public menu, in the order staff arranged it. */
export const getNavItems = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ includeInactive: z.boolean().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { adminDb, getSessionUser } = await import("./auth.server");

    let includeInactive = false;
    if (data.includeInactive) {
      const user = await getSessionUser();
      includeInactive = user?.isStaff === true;
    }

    try {
      let query = adminDb()
        .from("nav_items")
        .select("id, label, href, is_active")
        .order("sort_order", { ascending: true });

      if (!includeInactive) query = query.eq("is_active", true);

      const { data: rows } = await query;
      return { items: (rows ?? []) as NavItem[] };
    } catch {
      // The header still renders without a menu rather than failing the page.
      return { items: [] as NavItem[] };
    }
  });

const saveNavSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(60),
  href: z.string().trim().min(1).max(400),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export type SaveNavItemInput = z.input<typeof saveNavSchema>;

export const saveNavItem = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => saveNavSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    try {
      await requireStaff();
    } catch (error) {
      return { ok: false as const, error: staffError(error) };
    }

    const db = adminDb();
    const payload = {
      label: data.label,
      href: data.href,
      ...(data.sortOrder === undefined ? {} : { sort_order: data.sortOrder }),
      ...(data.isActive === undefined ? {} : { is_active: data.isActive }),
    };

    const { error } = data.id
      ? await db.from("nav_items").update(payload).eq("id", data.id)
      : await db.from("nav_items").insert(payload);

    return error
      ? { ok: false as const, error: describeDbError(error) }
      : { ok: true as const, error: null as string | null };
  });

export const deleteNavItem = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    try {
      await requireStaff();
    } catch (error) {
      return { ok: false as const, error: staffError(error) };
    }

    const { error } = await adminDb().from("nav_items").delete().eq("id", data.id);
    return error
      ? { ok: false as const, error: describeDbError(error) }
      : { ok: true as const, error: null as string | null };
  });

export const reorderNavItems = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        order: z
          .array(z.object({ id: z.string().uuid(), sortOrder: z.number().int().min(0) }))
          .max(100),
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
      await db.from("nav_items").update({ sort_order: entry.sortOrder }).eq("id", entry.id);
    }
    return { ok: true as const, error: null as string | null };
  });
