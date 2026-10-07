import { createServerFn } from "@tanstack/react-start";

import type { InventoryVehicle } from "./inventory.functions";
import type { PageContentRow } from "@/integrations/supabase/admin-schema";

/**
 * Everything the home page renders, in one round trip.
 *
 * The browse tiles come from the managed lists rather than from whatever
 * happens to be in stock, so staff control which makes and body styles are
 * offered; the counts beside them come from the live catalogue, so a tile never
 * claims stock that is not there.
 */

export type BrowseTile = {
  slug: string;
  name: string;
  image_url: string | null;
  count: number;
};

/** One of the promo panels in the hero grid. */
export type HomePanel = {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_href: string | null;
  variant: string;
  ends_at: string | null;
};

export type HomeData = {
  page: PageContentRow | null;
  panels: HomePanel[];
  makes: BrowseTile[];
  bodyStyles: BrowseTile[];
  countries: BrowseTile[];
  featured: InventoryVehicle[];
  latest: InventoryVehicle[];
  totalVehicles: number;
};

const CARD_COLUMNS =
  "id, stock_id, slug, title, make, model, variant, body_type, year, mileage, mileage_unit, engine_size, fuel, transmission, steering, drivetrain, exterior_color, seats, doors, price, currency, inventory_location, status";

const EMPTY: HomeData = {
  page: null,
  panels: [],
  makes: [],
  bodyStyles: [],
  countries: [],
  featured: [],
  latest: [],
  totalVehicles: 0,
};

export const getHomeData = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomeData> => {
    const { adminDb } = await import("./auth.server");

    try {
      const db = adminDb();

      const [
        { data: page },
        { data: panels },
        { data: makes },
        { data: bodyStyles },
        { data: countries },
        { data: stockRows },
        { data: featured },
        { data: latest },
        totalCount,
      ] = await Promise.all([
        db.from("page_content").select("*").eq("slug", "home").maybeSingle(),
        db
          .from("page_blocks")
          .select("id, title, body, image_url, cta_label, cta_href, variant, ends_at")
          .eq("page_slug", "home")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        db
          .from("makes")
          .select("slug, name, logo_url")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        db
          .from("body_styles")
          .select("slug, name, image_url")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        db
          .from("countries")
          .select("slug, name, image_url, vehicle_count, drive_side")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        // Only the two columns needed to count; the catalogue is small enough
        // that this is cheaper than a round trip per tile.
        db.from("vehicles").select("make, body_type, steering").eq("status", "Available"),
        db
          .from("vehicles")
          .select(CARD_COLUMNS)
          .eq("is_featured", true)
          .eq("status", "Available")
          .order("updated_at", { ascending: false })
          .limit(8),
        db
          .from("vehicles")
          .select(CARD_COLUMNS)
          .eq("status", "Available")
          .order("imported_at", { ascending: false })
          .limit(8),
        db.from("vehicles").select("id", { count: "exact", head: true }).eq("status", "Available"),
      ]);

      const makeCounts = new Map<string, number>();
      const bodyCounts = new Map<string, number>();
      // A destination takes the steering side it drives on, so the figure under
      // each flag is how much of the catalogue suits that market.
      const steeringCounts = { Right: 0, Left: 0 };
      for (const row of stockRows ?? []) {
        if (row.make) makeCounts.set(row.make, (makeCounts.get(row.make) ?? 0) + 1);
        if (row.body_type) bodyCounts.set(row.body_type, (bodyCounts.get(row.body_type) ?? 0) + 1);
        if (row.steering === "Right") steeringCounts.Right += 1;
        else if (row.steering === "Left") steeringCounts.Left += 1;
      }

      const countForSide = (side: string | null): number => {
        if (side === "right") return steeringCounts.Right;
        if (side === "left") return steeringCounts.Left;
        return steeringCounts.Right + steeringCounts.Left;
      };

      const featuredList = (featured ?? []) as unknown as InventoryVehicle[];
      const latestList = (latest ?? []) as unknown as InventoryVehicle[];

      return {
        page: (page ?? null) as PageContentRow | null,
        panels: (panels ?? []) as HomePanel[],
        makes: (makes ?? []).map((row) => ({
          slug: row.slug,
          name: row.name,
          image_url: row.logo_url,
          count: makeCounts.get(row.name) ?? 0,
        })),
        bodyStyles: (bodyStyles ?? []).map((row) => ({
          slug: row.slug,
          name: row.name,
          image_url: row.image_url,
          count: bodyCounts.get(row.name) ?? 0,
        })),
        countries: (countries ?? []).map((row) => ({
          slug: row.slug,
          name: row.name,
          image_url: row.image_url,
          // A manual figure, when set, overrides the derived one.
          count: row.vehicle_count ?? countForSide(row.drive_side),
        })),
        // Nothing flagged as featured yet — fall back to the newest arrivals so
        // the section is never an empty grid.
        featured: featuredList.length > 0 ? featuredList : latestList.slice(0, 8),
        latest: latestList.slice(0, 4),
        totalVehicles: totalCount.count ?? 0,
      };
    } catch {
      return EMPTY;
    }
  },
);
