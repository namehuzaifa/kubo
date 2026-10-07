import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type InventoryFilters = {
  make?: string | undefined;
  model?: string | undefined;
  body?: string | undefined;
  fuel?: string | undefined;
  transmission?: string | undefined;
  steering?: string | undefined;
  drivetrain?: string | undefined;
  /** Destination market slug; resolved to a steering side server-side. */
  country?: string | undefined;
  color?: string | undefined;
  feature?: string | undefined;
  q?: string | undefined;
  yearMin?: number | undefined;
  yearMax?: number | undefined;
  priceMin?: number | undefined;
  priceMax?: number | undefined;
  mileageMin?: number | undefined;
  mileageMax?: number | undefined;
  engineMin?: number | undefined;
  engineMax?: number | undefined;
  sort?: string | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
};

export type InventoryVehicle = {
  id: string;
  stock_id: string;
  slug: string;
  title: string;
  make: string;
  model: string;
  variant: string | null;
  body_type: string | null;
  year: number | null;
  mileage: number | null;
  mileage_unit: string | null;
  engine_size: number | null;
  fuel: string | null;
  transmission: string | null;
  steering: string | null;
  drivetrain: string | null;
  exterior_color: string | null;
  seats: number | null;
  doors: number | null;
  price: number | null;
  currency: string | null;
  inventory_location: string | null;
  status: string;
};

const LIST_COLUMNS =
  "id, stock_id, slug, title, make, model, variant, body_type, year, mileage, mileage_unit, engine_size, fuel, transmission, steering, drivetrain, exterior_color, seats, doors, price, currency, inventory_location, status";

function publicClient(): SupabaseClient<Database> {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

function normalize(input: unknown): InventoryFilters {
  const raw = (input ?? {}) as Record<string, unknown>;
  const str = (key: string) => {
    const value = raw[key];
    return typeof value === "string" && value.trim() !== "" && value !== "All" ? value : undefined;
  };
  const int = (key: string) => {
    const value = Number(raw[key]);
    return Number.isFinite(value) ? value : undefined;
  };
  return {
    make: str("make"),
    model: str("model"),
    body: str("body"),
    fuel: str("fuel"),
    transmission: str("transmission"),
    steering: str("steering"),
    drivetrain: str("drivetrain"),
    country: str("country"),
    color: str("color"),
    feature: str("feature"),
    q: str("q"),
    yearMin: int("yearMin"),
    yearMax: int("yearMax"),
    priceMin: int("priceMin"),
    priceMax: int("priceMax"),
    mileageMin: int("mileageMin"),
    mileageMax: int("mileageMax"),
    engineMin: int("engineMin"),
    engineMax: int("engineMax"),
    sort: str("sort"),
    page: int("page"),
    perPage: int("perPage"),
  };
}

async function featureVehicleSlugs(
  supabase: SupabaseClient<Database>,
  feature: string,
): Promise<string[] | null> {
  const { data } = await supabase
    .from("vehicle_features")
    .select("vehicle_id")
    .ilike("feature_name", feature)
    .limit(20000);
  if (!data) return [];
  return [...new Set(data.map((row) => row.vehicle_id))];
}

type Query = ReturnType<ReturnType<typeof publicClient>["from"]>;

function applyFilters<
  T extends { eq: Function; gte: Function; lte: Function; or: Function; in: Function },
>(query: T, f: InventoryFilters, featureIds: string[] | null): T {
  let q: any = query.eq("status", "Available");
  if (f.make) q = q.eq("make", f.make);
  if (f.model) q = q.eq("model", f.model);
  if (f.body) q = q.eq("body_type", f.body);
  if (f.fuel) q = q.eq("fuel", f.fuel);
  if (f.transmission) q = q.eq("transmission", f.transmission);
  if (f.steering) q = q.eq("steering", f.steering);
  if (f.drivetrain) q = q.eq("drivetrain", f.drivetrain);
  if (f.color) q = q.eq("exterior_color", f.color);
  if (f.yearMin !== undefined) q = q.gte("year", f.yearMin);
  if (f.yearMax !== undefined) q = q.lte("year", f.yearMax);
  if (f.priceMin !== undefined) q = q.gte("price", f.priceMin);
  if (f.priceMax !== undefined) q = q.lte("price", f.priceMax);
  if (f.mileageMin !== undefined) q = q.gte("mileage", f.mileageMin);
  if (f.mileageMax !== undefined) q = q.lte("mileage", f.mileageMax);
  if (f.engineMin !== undefined) q = q.gte("engine_size", f.engineMin);
  if (f.engineMax !== undefined) q = q.lte("engine_size", f.engineMax);
  if (f.q) {
    const term = f.q.replace(/[%,]/g, " ").trim();
    q = q.or(
      [
        `stock_id.ilike.%${term}%`,
        `title.ilike.%${term}%`,
        `make.ilike.%${term}%`,
        `model.ilike.%${term}%`,
        `variant.ilike.%${term}%`,
        `model_code.ilike.%${term}%`,
      ].join(","),
    );
  }
  if (featureIds)
    q = q.in("id", featureIds.length ? featureIds : ["00000000-0000-0000-0000-000000000000"]);
  return q as T;
}

function sortQuery(query: any, sort: string | undefined) {
  switch (sort) {
    case "price-asc":
      return query.order("price", { ascending: true, nullsFirst: false });
    case "price-desc":
      return query.order("price", { ascending: false, nullsFirst: false });
    case "mileage":
      return query.order("mileage", { ascending: true, nullsFirst: false });
    case "mileage-desc":
      return query.order("mileage", { ascending: false, nullsFirst: false });
    case "year-asc":
      return query.order("year", { ascending: true, nullsFirst: false });
    case "recent":
      return query.order("imported_at", { ascending: false });
    default:
      return query.order("year", { ascending: false, nullsFirst: false });
  }
}

/**
 * A destination market has no direct link to a vehicle — vehicles.country is
 * where the car is, not where it is going. What decides suitability is which
 * side the market drives on, so the slug is resolved to a steering side here,
 * server-side, and the browser only ever passes the country.
 *
 * An explicit steering choice wins, so the two filters can be combined without
 * the country quietly overriding what the visitor picked.
 */
async function resolveCountry(
  supabase: SupabaseClient<Database>,
  filters: InventoryFilters,
): Promise<InventoryFilters> {
  if (!filters.country || filters.steering) return filters;

  // `countries` post-dates the generated types, so the row shape is asserted.
  const result = await (
    supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => { maybeSingle: () => Promise<{ data: { drive_side: string } | null }> };
        };
      };
    }
  )
    .from("countries")
    .select("drive_side")
    .eq("slug", filters.country)
    .maybeSingle();

  const side = result.data?.drive_side;
  if (side === "right") return { ...filters, steering: "Right" };
  if (side === "left") return { ...filters, steering: "Left" };
  return filters;
}

export const listVehicles = createServerFn({ method: "GET" })
  .inputValidator(normalize)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const filters = await resolveCountry(supabase, data);
    const perPage = Math.min(Math.max(data.perPage ?? 24, 1), 48);
    const page = Math.max(data.page ?? 1, 1);
    const featureIds = data.feature ? await featureVehicleSlugs(supabase, data.feature) : null;

    const base = supabase.from("vehicles").select(LIST_COLUMNS, { count: "exact" });
    let query: any = applyFilters(base as any, filters, featureIds);
    query = sortQuery(query, data.sort).range((page - 1) * perPage, page * perPage - 1);

    const { data: rows, count, error } = await query;
    if (error)
      return { vehicles: [] as InventoryVehicle[], total: 0, page, perPage, error: error.message };
    return {
      vehicles: (rows ?? []) as InventoryVehicle[],
      total: count ?? 0,
      page,
      perPage,
      error: null as string | null,
    };
  });

export type Facets = {
  makes: { value: string; count: number }[];
  models: { value: string; count: number }[];
  bodyTypes: { value: string; count: number }[];
  fuels: { value: string; count: number }[];
  transmissions: { value: string; count: number }[];
  steerings: { value: string; count: number }[];
  drivetrains: { value: string; count: number }[];
  colors: { value: string; count: number }[];
  features: { value: string; count: number }[];
  total: number;
};

function tally(values: (string | null)[]): { value: string; count: number }[] {
  const map = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/**
 * Facet counts are computed against the *current* filter selection (minus the
 * facet's own field) so option lists stay dependent — picking Toyota narrows
 * the model list to Toyota models that actually exist in stock.
 */
export const getFacets = createServerFn({ method: "GET" })
  .inputValidator(normalize)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const effective = await resolveCountry(supabase, data);
    const featureIds = data.feature ? await featureVehicleSlugs(supabase, data.feature) : null;

    const scoped = async (omit: keyof InventoryFilters) => {
      const filters = { ...effective, [omit]: undefined } as InventoryFilters;
      const query = applyFilters(
        supabase
          .from("vehicles")
          .select(
            "make, model, body_type, fuel, transmission, steering, drivetrain, exterior_color",
          ) as any,
        filters,
        omit === "feature" ? null : featureIds,
      );
      const { data: rows } = await (query as any).limit(6000);
      return (rows ?? []) as Record<string, string | null>[];
    };

    const [byMake, byModel, byBody, byFuel, byTrans, bySteer, byDrive, byColor, current] =
      await Promise.all([
        scoped("make"),
        scoped("model"),
        scoped("body"),
        scoped("fuel"),
        scoped("transmission"),
        scoped("steering"),
        scoped("drivetrain"),
        scoped("color"),
        scoped("feature"),
      ]);

    const { data: featureRows } = await supabase
      .from("vehicle_features")
      .select("feature_name")
      .limit(20000);

    return {
      makes: tally(byMake.map((r) => r["make"] ?? null)),
      models: tally(byModel.map((r) => r["model"] ?? null)),
      bodyTypes: tally(byBody.map((r) => r["body_type"] ?? null)),
      fuels: tally(byFuel.map((r) => r["fuel"] ?? null)),
      transmissions: tally(byTrans.map((r) => r["transmission"] ?? null)),
      steerings: tally(bySteer.map((r) => r["steering"] ?? null)),
      drivetrains: tally(byDrive.map((r) => r["drivetrain"] ?? null)),
      colors: tally(byColor.map((r) => r["exterior_color"] ?? null)),
      features: tally((featureRows ?? []).map((r) => r.feature_name)).slice(0, 30),
      total: current.length,
    } satisfies Facets;
  });

export const getVehicleByStockId = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const raw = (input ?? {}) as { stockId?: unknown };
    return { stockId: String(raw.stockId ?? "").toUpperCase() };
  })
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: vehicle } = await supabase
      .from("vehicles")
      .select("*")
      .eq("stock_id", data.stockId)
      .neq("status", "Removed")
      .maybeSingle();
    if (!vehicle) return { vehicle: null, features: [], pricing: [], related: [] };

    const [{ data: features }, { data: pricing }, { data: related }] = await Promise.all([
      supabase
        .from("vehicle_features")
        .select("feature_name, feature_category, feature_value")
        .eq("vehicle_id", vehicle.id),
      supabase
        .from("vehicle_pricing")
        .select("price_type, amount, currency")
        .eq("vehicle_id", vehicle.id),
      supabase
        .from("vehicles")
        .select(LIST_COLUMNS)
        .eq("make", vehicle.make)
        .eq("status", "Available")
        .neq("stock_id", vehicle.stock_id)
        .limit(4),
    ]);

    return {
      vehicle,
      features: features ?? [],
      pricing: pricing ?? [],
      related: (related ?? []) as InventoryVehicle[],
    };
  });

/**
 * Fetches a handful of vehicles by id, for the compare page. The ids come from
 * the visitor's browser, so the list is capped and anything that no longer
 * exists is simply left out.
 */
export const getVehiclesByIds = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => {
    const raw = (input ?? {}) as { ids?: unknown };
    const ids = Array.isArray(raw.ids) ? raw.ids.filter((id) => typeof id === "string") : [];
    return { ids: (ids as string[]).slice(0, 4) };
  })
  .handler(async ({ data }) => {
    if (data.ids.length === 0) return { vehicles: [] as InventoryVehicle[] };

    const supabase = publicClient();
    const { data: rows } = await supabase
      .from("vehicles")
      .select(LIST_COLUMNS)
      .in("id", data.ids)
      .neq("status", "Removed");

    const byId = new Map(
      ((rows ?? []) as unknown as InventoryVehicle[]).map((row) => [row.id, row]),
    );

    // Keep the order the visitor added them in.
    return {
      vehicles: data.ids.map((id) => byId.get(id)).filter(Boolean) as InventoryVehicle[],
    };
  });
