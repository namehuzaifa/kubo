import { SOURCE_NAME, crawlSource, type SourceVehicle } from "./inventory-source.server";

export type ImportReport = {
  source_name: string;
  total_source: number;
  total_imported: number;
  total_new: number;
  total_updated: number;
  total_removed: number;
  total_duplicates: number;
  total_failed: number;
  total_missing_images: number;
  /** Feed rows left alone because the listing is managed by hand. */
  total_skipped_manual: number;
  pages_read: number;
  validation: {
    missing_stock_ids: number;
    duplicate_stock_ids: number;
    missing_price: number;
    missing_make_or_model: number;
    missing_year: number;
    missing_mileage: number;
  };
  notes: string;
};

function slugify(vehicle: SourceVehicle): string {
  return `${vehicle.make}-${vehicle.model}-${vehicle.year ?? "na"}-${vehicle.stock_id}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function featureCategory(name: string): string {
  const value = name.toLowerCase();
  if (/(camera|abs|airbag|sensor|stability|brake|alarm)/.test(value)) return "Safety";
  if (/(alloy|spoiler|aero|grill|roof|fog|hid|led|sunroof|wheel)/.test(value)) return "Exterior";
  if (/(leather|seat|display|navigation|audio|multimedia|tv|radio)/.test(value)) return "Interior";
  return "Comfort & Convenience";
}

/**
 * Upserts the crawled inventory. Matching is by stock_id, so re-running the
 * sync updates prices/specs instead of creating duplicates, and vehicles that
 * disappear from the source are marked Removed rather than deleted.
 */
export async function runInventorySync(options: {
  pagesPerBodyType?: number;
  markRemoved?: boolean;
}): Promise<ImportReport> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const startedAt = new Date().toISOString();

  const { vehicles: source, pagesRead } = await crawlSource({
    pagesPerBodyType: options.pagesPerBodyType ?? 2,
  });

  const seen = new Set<string>();
  const unique: SourceVehicle[] = [];
  let duplicates = 0;
  let missingStockIds = 0;
  for (const vehicle of source) {
    if (!vehicle.stock_id) {
      missingStockIds += 1;
      continue;
    }
    if (seen.has(vehicle.stock_id)) {
      duplicates += 1;
      continue;
    }
    seen.add(vehicle.stock_id);
    unique.push(vehicle);
  }

  const { data: existingRows } = await supabaseAdmin
    .from("vehicles")
    .select("id, stock_id")
    .eq("source_name", SOURCE_NAME);
  const existing = new Map((existingRows ?? []).map((row) => [row.stock_id, row.id]));

  // Anything staff have taken ownership of in the dashboard. `is_manual` marks
  // a listing the feed has never seen; `locked_fields` names columns that were
  // corrected by hand. The upsert below rewrites whole rows, so without these
  // guards every manual change would be undone on the next run.
  // locked_fields and is_manual were added after types.ts was last generated,
  // so the row shape is asserted here rather than inferred.
  type GuardRow = { stock_id: string; locked_fields: string[] | null; is_manual: boolean };
  const guardResult = (await supabaseAdmin
    .from("vehicles")
    .select("stock_id, locked_fields, is_manual")) as unknown as { data: GuardRow[] | null };
  const guardRows = guardResult.data ?? [];

  const manualStockIds = new Set(
    guardRows.filter((row) => row.is_manual).map((row) => row.stock_id),
  );
  const lockedByStockId = new Map(
    guardRows
      .filter((row) => (row.locked_fields?.length ?? 0) > 0)
      .map((row) => [row.stock_id, new Set(row.locked_fields ?? [])]),
  );
  let skipped = 0;

  let created = 0;
  let updated = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    const payload = batch.map((vehicle) => ({
      stock_id: vehicle.stock_id,
      slug: slugify(vehicle),
      make: vehicle.make,
      brand: vehicle.make,
      model: vehicle.model,
      variant: vehicle.variant,
      model_code: vehicle.model_code,
      title: vehicle.title,
      vehicle_type: vehicle.body_type,
      body_type: vehicle.body_type,
      category: vehicle.body_type,
      year: vehicle.year,
      registration_year: vehicle.registration_year,
      mileage: vehicle.mileage,
      mileage_unit: "km",
      engine_size: vehicle.engine_size,
      engine_type: vehicle.engine_type,
      fuel: vehicle.fuel,
      transmission: vehicle.transmission,
      steering: vehicle.steering,
      drivetrain: vehicle.drivetrain,
      drive_type: vehicle.drivetrain,
      exterior_color: vehicle.exterior_color,
      doors: vehicle.doors,
      seats: vehicle.seats,
      inventory_location: vehicle.inventory_location,
      country: "Japan",
      price: vehicle.price,
      currency: vehicle.currency,
      status: "Available",
      source_name: SOURCE_NAME,
      source_url: vehicle.source_url,
      source_updated_at: now,
      last_synced_at: now,
      updated_at: now,
    }));

    // Manual listings are left untouched. Rows with locked columns cannot go
    // through the bulk upsert, because a bulk call has to send the same columns
    // for every row and each of these needs a different set left out.
    const open: typeof payload = [];
    const guarded: typeof payload = [];
    for (const row of payload) {
      if (manualStockIds.has(row.stock_id)) skipped += 1;
      else if (lockedByStockId.has(row.stock_id)) guarded.push(row);
      else open.push(row);
    }

    const synced: { id: string; stock_id: string }[] = [];

    if (open.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("vehicles")
        .upsert(open, { onConflict: "stock_id" })
        .select("id, stock_id");

      if (error || !data) failed += open.length;
      else synced.push(...data);
    }

    for (const row of guarded) {
      const locked = lockedByStockId.get(row.stock_id)!;
      const patch = Object.fromEntries(
        Object.entries(row).filter(([column]) => !locked.has(column)),
      ) as Partial<(typeof payload)[number]>;
      const { data, error } = await supabaseAdmin
        .from("vehicles")
        .update(patch)
        .eq("stock_id", row.stock_id)
        .select("id, stock_id");

      if (error || !data?.[0]) failed += 1;
      else synced.push(data[0]);
    }

    if (synced.length === 0) continue;

    for (const row of synced) {
      if (existing.has(row.stock_id)) updated += 1;
      else created += 1;
    }

    const idByStock = new Map(synced.map((row) => [row.stock_id, row.id]));
    const vehicleIds = synced.map((row) => row.id);

    await supabaseAdmin.from("vehicle_features").delete().in("vehicle_id", vehicleIds);
    await supabaseAdmin.from("vehicle_pricing").delete().in("vehicle_id", vehicleIds);

    const featureRows = batch.flatMap((vehicle) => {
      const vehicleId = idByStock.get(vehicle.stock_id);
      if (!vehicleId) return [];
      return vehicle.features.map((feature) => ({
        vehicle_id: vehicleId,
        feature_name: feature,
        feature_category: featureCategory(feature),
        feature_value: "Yes",
      }));
    });
    if (featureRows.length) await supabaseAdmin.from("vehicle_features").insert(featureRows);

    const pricingRows = batch.flatMap((vehicle) => {
      const vehicleId = idByStock.get(vehicle.stock_id);
      if (!vehicleId) return [];
      const rows: {
        vehicle_id: string;
        price_type: string;
        amount: number | null;
        currency: string;
      }[] = [];
      if (vehicle.price !== null)
        rows.push({
          vehicle_id: vehicleId,
          price_type: "FOB",
          amount: vehicle.price,
          currency: vehicle.currency,
        });
      if (vehicle.total_price !== null)
        rows.push({
          vehicle_id: vehicleId,
          price_type: "Total",
          amount: vehicle.total_price,
          currency: vehicle.currency,
        });
      return rows;
    });
    if (pricingRows.length) await supabaseAdmin.from("vehicle_pricing").insert(pricingRows);
  }

  let removed = 0;
  if (options.markRemoved) {
    const stale = [...existing.keys()].filter((stockId) => !seen.has(stockId));
    for (let i = 0; i < stale.length; i += 200) {
      const chunk = stale.slice(i, i + 200);
      const { data } = await supabaseAdmin
        .from("vehicles")
        .update({ status: "Removed", updated_at: now })
        .in("stock_id", chunk)
        .select("id");
      removed += data?.length ?? 0;
    }
  }

  const report: ImportReport = {
    source_name: SOURCE_NAME,
    total_source: source.length,
    total_imported: created + updated,
    total_new: created,
    total_updated: updated,
    total_removed: removed,
    total_duplicates: duplicates,
    total_failed: failed,
    total_skipped_manual: skipped,
    // Source photography is intentionally not copied; listings use our own imagery.
    total_missing_images: 0,
    pages_read: pagesRead,
    validation: {
      missing_stock_ids: missingStockIds,
      duplicate_stock_ids: duplicates,
      missing_price: unique.filter((v) => v.price === null).length,
      missing_make_or_model: unique.filter((v) => !v.make || !v.model).length,
      missing_year: unique.filter((v) => v.year === null).length,
      missing_mileage: unique.filter((v) => v.mileage === null).length,
    },
    notes:
      "Factual specification data only. Source photography and marketing copy are not copied; listing imagery is our own watermarked photography.",
  };

  await supabaseAdmin.from("import_runs").insert({
    source_name: SOURCE_NAME,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    total_source: report.total_source,
    total_imported: report.total_imported,
    total_new: report.total_new,
    total_updated: report.total_updated,
    total_removed: report.total_removed,
    total_duplicates: report.total_duplicates,
    total_failed: report.total_failed,
    total_missing_images: report.total_missing_images,
    notes: report.notes,
  });

  return report;
}
