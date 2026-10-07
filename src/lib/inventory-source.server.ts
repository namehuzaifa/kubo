/**
 * BE FORWARD stocklist reader.
 *
 * Only factual vehicle data (stock reference, make, model, year, mileage,
 * engine, transmission, steering, colour, equipment list, displayed price)
 * is read. Source photography and marketing copy are NOT copied — listings
 * use our own imagery.
 *
 * robots.txt for www.beforward.jp permits /stocklist/. No login, CAPTCHA,
 * or rate-limit control is bypassed: requests are sequential and throttled.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

export const SOURCE_NAME = "beforward.jp";

export const BODY_TYPES: Record<number, string> = {
  1: "Coupe",
  2: "Convertible",
  3: "Hatchback",
  4: "Sedan",
  5: "Wagon",
  6: "SUV",
  7: "Pick up",
  8: "Van",
  9: "Truck",
  10: "Mini Bus",
  15: "Mini Van",
  17: "Bus",
};

export type SourceVehicle = {
  stock_id: string;
  source_url: string;
  title: string;
  make: string;
  model: string;
  variant: string | null;
  model_code: string | null;
  body_type: string;
  year: number | null;
  registration_year: number | null;
  mileage: number | null;
  engine_size: number | null;
  engine_type: string | null;
  fuel: string | null;
  transmission: string | null;
  steering: string | null;
  drivetrain: string | null;
  exterior_color: string | null;
  seats: number | null;
  doors: number | null;
  inventory_location: string | null;
  price: number | null;
  currency: string;
  total_price: number | null;
  features: string[];
};

function stripTags(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function num(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function nullable(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  return value === "" || value === "-" || value === "N/A" ? null : value;
}

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((part) => (part.length <= 2 ? part.toUpperCase() : part[0]!.toUpperCase() + part.slice(1)))
    .join(" ");
}

function cellPairs(table: string): Record<string, string> {
  const headers = [...table.matchAll(/<td class="th th-[^"]*">([\s\S]*?)<\/td>/g)].map((m) =>
    stripTags(m[1]!),
  );
  const values = [...table.matchAll(/<td class="td-[^"]*">([\s\S]*?)<\/td>/g)].map((m) =>
    stripTags(m[1]!),
  );
  const out: Record<string, string> = {};
  headers.forEach((key, i) => {
    if (key) out[key] = values[i] ?? "";
  });
  return out;
}

export function parseStockListPage(html: string, bodyType: string): SourceVehicle[] {
  const blocks = html.split('<tr class="stocklist-row">').slice(1);
  const rows: SourceVehicle[] = [];

  for (const block of blocks) {
    const link = /href="(\/([^/"]+)\/([^/"]+)\/([a-z0-9]+)\/id\/(\d+)\/)"/.exec(block);
    if (!link) continue;

    const ref = /Ref No\.\s*([A-Z0-9]+)/.exec(block);
    const stockId = (ref?.[1] ?? link[4]!).toUpperCase();

    const titleMatch = /class="make-model">([\s\S]*?)<\/p>/.exec(block);
    const title = titleMatch ? stripTags(titleMatch[1]!) : "";

    const spec: Record<string, string | null> = {};
    for (const key of ["mileage", "year", "engine", "trans"]) {
      const cell = new RegExp(`${key}">([\\s\\S]*?)<\\/td>`).exec(block);
      const value = cell ? /class="val">([\s\S]*?)<\/p>/.exec(cell[1]!) : null;
      spec[key] = value ? stripTags(value[1]!) : null;
    }

    const locationMatch = /class="val stock-area">([\s\S]*?)<\/p>/.exec(block);
    const detailTable = /<table class="table-detailed-spec">([\s\S]*?)<\/table>/.exec(block);
    const detail = detailTable ? cellPairs(detailTable[1]!) : {};

    const accessories = /<div class="accessories">([\s\S]*?)<\/div>/.exec(block);
    const features = accessories
      ? [...accessories[1]!.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => stripTags(m[1]!)).filter(Boolean)
      : [];

    const priceMatch = /class="vehicle-price">[\s\S]*?<span class="price ?">([^<]+)<\/span>/.exec(block);
    const totalMatch = /class="total-price">[\s\S]*?<span class="price ?">([^<]+)<\/span>/.exec(block);

    const make = titleCase(link[2]!);
    const model = titleCase(link[3]!);
    const yearRaw = spec["year"];
    const year = yearRaw ? num(yearRaw.split("/")[0]!) : null;

    // The listing title is "<year> <MAKE> <MODEL> <variant>" — the tail is the grade/variant.
    const upperMakeModel = `${link[2]!.replace(/-/g, " ")} ${link[3]!.replace(/-/g, " ")}`.toUpperCase();
    let variant: string | null = null;
    const withoutYear = title.replace(/^\d{4}\s*/, "");
    const idx = withoutYear.toUpperCase().indexOf(upperMakeModel);
    if (idx === 0) variant = nullable(withoutYear.slice(upperMakeModel.length));
    if (!variant) {
      const tail = withoutYear.split(" ").slice(2).join(" ");
      variant = nullable(tail);
    }

    rows.push({
      stock_id: stockId,
      source_url: `https://www.beforward.jp${link[1]!}`,
      title: title || `${year ?? ""} ${make} ${model}`.trim(),
      make,
      model,
      variant,
      model_code: nullable(detail["Model code"]),
      body_type: bodyType,
      year,
      registration_year: year,
      mileage: num(spec["mileage"]),
      engine_size: num(spec["engine"]),
      engine_type: nullable(detail["Engine code"]),
      fuel: nullable(detail["Fuel"]),
      transmission: nullable(spec["trans"]),
      steering: nullable(detail["Steering"]),
      drivetrain: nullable(detail["Drive"]),
      exterior_color: nullable(detail["Color"]),
      seats: num(detail["Seats"]),
      doors: num(detail["Doors"]),
      inventory_location: locationMatch ? nullable(stripTags(locationMatch[1]!)) : null,
      price: num(priceMatch?.[1]),
      currency: "USD",
      total_price: num(totalMatch?.[1]),
      features,
    });
  }

  return rows;
}

async function fetchPage(url: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "en" },
      });
      if (response.status === 429 || response.status >= 500) throw new Error(`status ${response.status}`);
      if (!response.ok) return "";
      return await response.text();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  return "";
}

export async function crawlSource({
  pagesPerBodyType = 2,
  bodyTypeIds,
}: {
  pagesPerBodyType?: number;
  bodyTypeIds?: number[];
}): Promise<{ vehicles: SourceVehicle[]; pagesRead: number }> {
  const ids = bodyTypeIds?.length ? bodyTypeIds : Object.keys(BODY_TYPES).map(Number);
  const byStockId = new Map<string, SourceVehicle>();
  let pagesRead = 0;

  for (const id of ids) {
    const bodyType = BODY_TYPES[id];
    if (!bodyType) continue;
    for (let page = 1; page <= pagesPerBodyType; page += 1) {
      const html = await fetchPage(`https://www.beforward.jp/stocklist/veh_type=${id}/page=${page}`);
      pagesRead += 1;
      const parsed = parseStockListPage(html, bodyType);
      if (parsed.length === 0) break;
      for (const vehicle of parsed) {
        if (!byStockId.has(vehicle.stock_id)) byStockId.set(vehicle.stock_id, vehicle);
      }
      // Politeness delay between requests.
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }

  return { vehicles: [...byStockId.values()], pagesRead };
}