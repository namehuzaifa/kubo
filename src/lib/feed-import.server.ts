/**
 * Generic dealer-feed importer.
 *
 * Accepts an authorised inventory feed (CSV or JSON rows) from any supplier —
 * e.g. a Goo-net Exchange / dealer export obtained with the account holder's
 * permission — and upserts it into the same `vehicles` tables the BE FORWARD
 * sync writes to. Matching is by stock id, so re-posting a feed updates
 * existing rows instead of duplicating them.
 */

export type FeedRow = Record<string, string | number | null | undefined>;

export type FeedReport = {
  source_name: string;
  total_source: number;
  total_imported: number;
  total_new: number;
  total_updated: number;
  total_duplicates: number;
  total_failed: number;
  skipped_missing_stock_id: number;
};

/** Column aliases seen across supplier exports, mapped to our canonical field. */
const ALIASES: Record<string, string[]> = {
  stock_id: ["stock_id", "stock id", "stock no", "stockno", "ref no", "ref_no", "reference", "id"],
  make: ["make", "maker", "brand", "manufacturer"],
  model: ["model", "car model", "model name"],
  variant: ["variant", "grade", "trim", "version"],
  model_code: ["model_code", "model code", "chassis model"],
  title: ["title", "name", "car name", "vehicle"],
  body_type: ["body_type", "body type", "body", "body style", "category", "vehicle type"],
  year: ["year", "model year", "manufacture year", "reg year", "registration year"],
  mileage: ["mileage", "km", "odometer", "mileage km"],
  engine_size: ["engine_size", "engine size", "engine", "displacement", "cc"],
  engine_type: ["engine_type", "engine code", "engine type"],
  fuel: ["fuel", "fuel type"],
  transmission: ["transmission", "trans", "gearbox"],
  steering: ["steering", "handle", "steering position"],
  drivetrain: ["drivetrain", "drive", "drive type", "4wd"],
  exterior_color: ["exterior_color", "color", "colour", "exterior colour"],
  doors: ["doors", "door"],
  seats: ["seats", "seat", "capacity"],
  inventory_location: ["inventory_location", "location", "yard", "stock location", "port"],
  price: ["price", "fob", "fob price", "amount"],
  currency: ["currency", "cur"],
  total_price: ["total_price", "total price", "cif", "cif price"],
  source_url: ["source_url", "url", "link", "detail url"],
  features: ["features", "accessories", "equipment", "options"],
};

const CANONICAL = new Map<string, string>();
for (const [field, names] of Object.entries(ALIASES)) {
  for (const name of names) CANONICAL.set(name, field);
}

function normaliseKey(key: string): string | null {
  return CANONICAL.get(key.trim().toLowerCase().replace(/[_-]+/g, " ")) ?? null;
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const out = String(value).trim();
  return out === "" || out === "-" || out.toUpperCase() === "N/A" ? null : out;
}

function number(value: unknown): number | null {
  const raw = text(value);
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Minimal RFC4180-ish CSV parser (quoted fields, embedded commas/newlines). */
export function parseCsv(input: string): FeedRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]!;
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);

  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((cells) => {
    const out: FeedRow = {};
    header.forEach((key, index) => {
      out[key] = cells[index] ?? null;
    });
    return out;
  });
}

export function mapFeedRow(raw: FeedRow): Record<string, unknown> | null {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const field = normaliseKey(key);
    if (field) mapped[field] = value;
  }

  const stockId = text(mapped["stock_id"]);
  const make = text(mapped["make"]);
  const model = text(mapped["model"]);
  if (!stockId || !make || !model) return null;

  const year = number(mapped["year"]);
  const bodyType = text(mapped["body_type"]);
  const featuresRaw = text(mapped["features"]);

  return {
    stock_id: stockId.toUpperCase(),
    make,
    model,
    year,
    body_type: bodyType,
    title: text(mapped["title"]) ?? `${year ?? ""} ${make} ${model}`.trim(),
    variant: text(mapped["variant"]),
    model_code: text(mapped["model_code"]),
    mileage: number(mapped["mileage"]),
    engine_size: number(mapped["engine_size"]),
    engine_type: text(mapped["engine_type"]),
    fuel: text(mapped["fuel"]),
    transmission: text(mapped["transmission"]),
    steering: text(mapped["steering"]),
    drivetrain: text(mapped["drivetrain"]),
    exterior_color: text(mapped["exterior_color"]),
    doors: number(mapped["doors"]),
    seats: number(mapped["seats"]),
    inventory_location: text(mapped["inventory_location"]),
    price: number(mapped["price"]),
    currency: text(mapped["currency"]) ?? "USD",
    total_price: number(mapped["total_price"]),
    source_url: text(mapped["source_url"]),
    features: featuresRaw
      ? featuresRaw
          .split(/[,;|]/)
          .map((part) => part.trim())
          .filter(Boolean)
      : [],
  };
}

function slugify(row: Record<string, unknown>): string {
  return `${row["make"]}-${row["model"]}-${row["year"] ?? "na"}-${row["stock_id"]}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function importFeed({
  sourceName,
  rows,
}: {
  sourceName: string;
  rows: FeedRow[];
}): Promise<FeedReport> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const startedAt = new Date().toISOString();

  const seen = new Set<string>();
  const mapped: Record<string, unknown>[] = [];
  let skipped = 0;
  let duplicates = 0;

  for (const raw of rows) {
    const row = mapFeedRow(raw);
    if (!row) {
      skipped += 1;
      continue;
    }
    const stockId = row["stock_id"] as string;
    if (seen.has(stockId)) {
      duplicates += 1;
      continue;
    }
    seen.add(stockId);
    mapped.push(row);
  }

  const { data: existingRows } = await supabaseAdmin
    .from("vehicles")
    .select("stock_id")
    .eq("source_name", sourceName);
  const existing = new Set((existingRows ?? []).map((r) => r.stock_id));

  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < mapped.length; i += 100) {
    const batch = mapped.slice(i, i + 100);
    const payload = batch.map((row) => ({
      stock_id: row["stock_id"] as string,
      slug: slugify(row),
      make: row["make"] as string,
      brand: row["make"] as string,
      model: row["model"] as string,
      variant: row["variant"] as string | null,
      model_code: row["model_code"] as string | null,
      title: row["title"] as string,
      vehicle_type: (row["body_type"] as string | null) ?? "Sedan",
      body_type: (row["body_type"] as string | null) ?? "Sedan",
      category: (row["body_type"] as string | null) ?? "Sedan",
      year: row["year"] as number | null,
      registration_year: row["year"] as number | null,
      mileage: row["mileage"] as number | null,
      mileage_unit: "km",
      engine_size: row["engine_size"] as number | null,
      engine_type: row["engine_type"] as string | null,
      fuel: row["fuel"] as string | null,
      transmission: row["transmission"] as string | null,
      steering: row["steering"] as string | null,
      drivetrain: row["drivetrain"] as string | null,
      drive_type: row["drivetrain"] as string | null,
      exterior_color: row["exterior_color"] as string | null,
      doors: row["doors"] as number | null,
      seats: row["seats"] as number | null,
      inventory_location: row["inventory_location"] as string | null,
      country: "Japan",
      price: row["price"] as number | null,
      currency: row["currency"] as string,
      status: "Available",
      source_name: sourceName,
      source_url: row["source_url"] as string | null,
      source_updated_at: now,
      last_synced_at: now,
      updated_at: now,
    }));

    const { data, error } = await supabaseAdmin
      .from("vehicles")
      .upsert(payload, { onConflict: "stock_id" })
      .select("id, stock_id");

    if (error || !data) {
      failed += batch.length;
      continue;
    }

    for (const saved of data) {
      if (existing.has(saved.stock_id)) updated += 1;
      else created += 1;
    }

    const idByStock = new Map(data.map((saved) => [saved.stock_id, saved.id]));
    const vehicleIds = data.map((saved) => saved.id);
    await supabaseAdmin.from("vehicle_features").delete().in("vehicle_id", vehicleIds);
    await supabaseAdmin.from("vehicle_pricing").delete().in("vehicle_id", vehicleIds);

    const featureRows = batch.flatMap((row) => {
      const vehicleId = idByStock.get(row["stock_id"] as string);
      if (!vehicleId) return [];
      return (row["features"] as string[]).map((feature) => ({
        vehicle_id: vehicleId,
        feature_name: feature,
        feature_value: "Yes",
      }));
    });
    if (featureRows.length) await supabaseAdmin.from("vehicle_features").insert(featureRows);

    const pricingRows = batch.flatMap((row) => {
      const vehicleId = idByStock.get(row["stock_id"] as string);
      if (!vehicleId) return [];
      const out: { vehicle_id: string; price_type: string; amount: number; currency: string }[] = [];
      const currency = row["currency"] as string;
      if (typeof row["price"] === "number")
        out.push({ vehicle_id: vehicleId, price_type: "FOB", amount: row["price"], currency });
      if (typeof row["total_price"] === "number")
        out.push({ vehicle_id: vehicleId, price_type: "Total", amount: row["total_price"], currency });
      return out;
    });
    if (pricingRows.length) await supabaseAdmin.from("vehicle_pricing").insert(pricingRows);
  }

  const report: FeedReport = {
    source_name: sourceName,
    total_source: rows.length,
    total_imported: created + updated,
    total_new: created,
    total_updated: updated,
    total_duplicates: duplicates,
    total_failed: failed,
    skipped_missing_stock_id: skipped,
  };

  await supabaseAdmin.from("import_runs").insert({
    source_name: sourceName,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    total_source: report.total_source,
    total_imported: report.total_imported,
    total_new: report.total_new,
    total_updated: report.total_updated,
    total_duplicates: report.total_duplicates,
    total_failed: report.total_failed,
    notes: "Authorised supplier feed import (CSV/JSON). Listing imagery remains our own.",
  });

  return report;
}