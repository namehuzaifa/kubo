import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { describeDbError } from "./db-error";
import type { InventoryVehicle } from "./inventory.functions";
import type { InquiryStatus } from "@/integrations/supabase/admin-schema";

/**
 * The signed-in customer's own area: their profile, their shortlist and a
 * summary of their inquiries.
 *
 * Every function resolves the customer from the session rather than taking an
 * id, so one customer can never read or change another's record even though
 * these run under the service-role client.
 */

const CARD_COLUMNS =
  "id, stock_id, slug, title, make, model, variant, body_type, year, mileage, mileage_unit, engine_size, fuel, transmission, steering, drivetrain, exterior_color, seats, doors, price, currency, inventory_location, status";

export type AccountProfile = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  country: string | null;
  port: string | null;
  created_at: string;
};

export type AccountOverview = {
  profile: AccountProfile | null;
  counts: { inquiries: number; open: number; documents: number; saved: number };
  recent: { id: string; ref_no: string; status: InquiryStatus; created_at: string }[];
};

const EMPTY_OVERVIEW: AccountOverview = {
  profile: null,
  counts: { inquiries: 0, open: 0, documents: 0, saved: 0 },
  recent: [],
};

/** Resolves the caller's customer row, creating it if the signup trigger missed it. */
async function currentCustomer(): Promise<{ id: string; email: string } | null> {
  const { getSessionUser, adminDb } = await import("./auth.server");

  const user = await getSessionUser();
  if (!user?.email) return null;

  const db = adminDb();
  const { data: existing } = await db
    .from("customers")
    .select("id, email")
    .eq("auth_user_id", user.userId)
    .maybeSingle();

  if (existing) return existing;

  const { data: created } = await db
    .from("customers")
    .insert({ auth_user_id: user.userId, email: user.email })
    .select("id, email")
    .single();

  return created ?? null;
}

export const getAccountOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<AccountOverview> => {
    const { adminDb } = await import("./auth.server");

    try {
      const customer = await currentCustomer();
      if (!customer) return EMPTY_OVERVIEW;

      const db = adminDb();
      const [{ data: profile }, { data: inquiries }, savedCount] = await Promise.all([
        db
          .from("customers")
          .select("id, name, email, phone, country, port, created_at")
          .eq("id", customer.id)
          .maybeSingle(),
        db
          .from("inquiries")
          .select("id, ref_no, status, created_at")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false }),
        db
          .from("saved_vehicles")
          .select("id", { count: "exact", head: true })
          .eq("customer_id", customer.id),
      ]);

      const all = inquiries ?? [];
      const ids = all.map((row) => row.id);

      let documents = 0;
      if (ids.length > 0) {
        const { count } = await db
          .from("inquiry_documents")
          .select("id", { count: "exact", head: true })
          .in("inquiry_id", ids)
          .eq("visible_to_customer", true);
        documents = count ?? 0;
      }

      // Anything still moving — not delivered and not lost.
      const closed: InquiryStatus[] = ["delivered", "deal_lost"];

      return {
        profile: (profile ?? null) as AccountProfile | null,
        counts: {
          inquiries: all.length,
          open: all.filter((row) => !closed.includes(row.status)).length,
          documents,
          saved: savedCount.count ?? 0,
        },
        recent: all.slice(0, 5) as AccountOverview["recent"],
      };
    } catch {
      return EMPTY_OVERVIEW;
    }
  },
);

const profileSchema = z.object({
  name: z.string().trim().max(120),
  phone: z.string().trim().max(60),
  country: z.string().trim().max(120),
  port: z.string().trim().max(120),
});

export type UpdateProfileInput = z.input<typeof profileSchema>;

/** The email is not editable here — it is the sign-in identity. */
export const updateProfile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data }) => {
    const { adminDb } = await import("./auth.server");

    const customer = await currentCustomer();
    if (!customer) return { ok: false as const, error: "Please sign in." };

    const { error } = await adminDb()
      .from("customers")
      .update({
        name: data.name || null,
        phone: data.phone || null,
        country: data.country || null,
        port: data.port || null,
      })
      .eq("id", customer.id);

    return error
      ? { ok: false as const, error: describeDbError(error) }
      : { ok: true as const, error: null as string | null };
  });

// ---------------------------------------------------------------------------
// Shortlist
// ---------------------------------------------------------------------------

export const listSavedVehicles = createServerFn({ method: "GET" }).handler(async () => {
  const { adminDb } = await import("./auth.server");

  try {
    const customer = await currentCustomer();
    if (!customer) return { vehicles: [] as InventoryVehicle[] };

    const db = adminDb();
    const { data: saved } = await db
      .from("saved_vehicles")
      .select("vehicle_id")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    const ids = (saved ?? []).map((row) => row.vehicle_id);
    if (ids.length === 0) return { vehicles: [] as InventoryVehicle[] };

    const { data: vehicles } = await db.from("vehicles").select(CARD_COLUMNS).in("id", ids);

    // Keep the order the customer saved them in.
    const byId = new Map((vehicles ?? []).map((row) => [(row as { id: string }).id, row]));
    return {
      vehicles: ids.map((id) => byId.get(id)).filter(Boolean) as unknown as InventoryVehicle[],
    };
  } catch {
    return { vehicles: [] as InventoryVehicle[] };
  }
});

/** The ids the heart on each card needs, so it can render already-saved state. */
export const listSavedVehicleIds = createServerFn({ method: "GET" }).handler(async () => {
  const { adminDb } = await import("./auth.server");

  try {
    const customer = await currentCustomer();
    if (!customer) return { ids: [] as string[] };

    const { data } = await adminDb()
      .from("saved_vehicles")
      .select("vehicle_id")
      .eq("customer_id", customer.id);

    return { ids: (data ?? []).map((row) => row.vehicle_id) };
  } catch {
    return { ids: [] as string[] };
  }
});

export const toggleSavedVehicle = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ vehicleId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { adminDb } = await import("./auth.server");

    const customer = await currentCustomer();
    if (!customer) return { ok: false as const, saved: false, error: "Please sign in to save." };

    const db = adminDb();
    const { data: existing } = await db
      .from("saved_vehicles")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("vehicle_id", data.vehicleId)
      .maybeSingle();

    if (existing) {
      const { error } = await db.from("saved_vehicles").delete().eq("id", existing.id);
      return error
        ? { ok: false as const, saved: true, error: describeDbError(error) }
        : { ok: true as const, saved: false, error: null as string | null };
    }

    const { error } = await db
      .from("saved_vehicles")
      .insert({ customer_id: customer.id, vehicle_id: data.vehicleId });

    return error
      ? { ok: false as const, saved: false, error: describeDbError(error) }
      : { ok: true as const, saved: true, error: null as string | null };
  });

export const removeSavedVehicle = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ vehicleId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { adminDb } = await import("./auth.server");

    const customer = await currentCustomer();
    if (!customer) return { ok: false as const, error: "Please sign in." };

    const { error } = await adminDb()
      .from("saved_vehicles")
      .delete()
      .eq("customer_id", customer.id)
      .eq("vehicle_id", data.vehicleId);

    return error
      ? { ok: false as const, error: describeDbError(error) }
      : { ok: true as const, error: null as string | null };
  });
