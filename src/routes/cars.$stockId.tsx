import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import watermark from "@/assets/watermark-logo.png";
import { PageHero } from "@/components/PageHero";
import { VehicleCard } from "@/components/VehicleCard";
import { VehicleInquiryDialog } from "@/components/VehicleInquiryDialog";
import { getVehicleByStockId } from "@/lib/inventory.functions";
import { bodyImage, formatPrice, toCardVehicle } from "@/lib/inventory-view";

const vehicleQuery = (stockId: string) =>
  queryOptions({
    queryKey: ["vehicle", stockId],
    queryFn: () => getVehicleByStockId({ data: { stockId } }),
  });

export const Route = createFileRoute("/cars/$stockId")({
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(vehicleQuery(params.stockId));
  },
  head: ({ params }) => ({
    meta: [
      { title: `Stock ${params.stockId} — Japanese Used Vehicle | Kubo Trading Japan` },
      {
        name: "description",
        content: `Full specification, equipment list and FOB price for stock reference ${params.stockId}, ready for export from Japan with Kubo Trading.`,
      },
      { property: "og:title", content: `Stock ${params.stockId} — Kubo Trading Japan` },
      {
        property: "og:description",
        content: "Specifications, equipment and export pricing for this Japanese used vehicle.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <div className="mx-auto max-w-[900px] px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">This vehicle could not be loaded</h1>
      <Link to="/all-stock" className="mt-4 inline-block font-semibold text-brand">
        Back to all stock
      </Link>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-[900px] px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Vehicle not found</h1>
    </div>
  ),
  component: VehicleDetail,
});

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <>
      <dt className="border-b border-border py-2 text-muted-foreground">{label}</dt>
      <dd className="border-b border-border py-2 text-right font-medium text-foreground">
        {value}
      </dd>
    </>
  );
}

function VehicleDetail() {
  const { stockId } = Route.useParams();
  const { data } = useSuspenseQuery(vehicleQuery(stockId));
  const vehicle = data.vehicle;

  if (!vehicle) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Vehicle not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Stock reference {stockId} is no longer available.
        </p>
        <Link to="/all-stock" className="mt-4 inline-block font-semibold text-brand">
          Browse all stock
        </Link>
      </div>
    );
  }

  const grouped = new Map<string, string[]>();
  for (const feature of data.features) {
    const key = feature.feature_category ?? "Other";
    grouped.set(key, [...(grouped.get(key) ?? []), feature.feature_name]);
  }

  return (
    <div className="bg-surface">
      <PageHero title={vehicle.title} subtitle={`Stock reference ${vehicle.stock_id}`} />
      <div className="mx-auto max-w-[1400px] px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <div className="relative aspect-4/3 bg-surface">
              <img
                src={bodyImage(vehicle.body_type)}
                alt={`${vehicle.title} ${vehicle.body_type ?? ""} for export from Japan`}
                className="size-full object-cover"
                width={1024}
                height={768}
              />
              <img
                src={watermark}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute bottom-3 left-3 w-52 max-w-[55%] opacity-80 drop-shadow-[0_1px_3px_rgba(255,255,255,0.9)]"
              />
              {vehicle.body_type ? (
                <span className="absolute left-3 top-3 rounded-md bg-brand px-2 py-1 text-[11px] font-semibold text-brand-foreground">
                  {vehicle.body_type}
                </span>
              ) : null}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Price
              </p>
              <p className="mt-1 text-3xl font-bold text-brand">
                {formatPrice(vehicle.price, vehicle.currency)}
              </p>
              {data.pricing.length ? (
                <dl className="mt-3 grid grid-cols-2 text-xs">
                  {data.pricing.map((row) => (
                    <Row
                      key={row.price_type}
                      label={row.price_type}
                      value={formatPrice(row.amount, row.currency)}
                    />
                  ))}
                </dl>
              ) : null}
              <VehicleInquiryDialog
                vehicleId={vehicle.id}
                stockId={vehicle.stock_id}
                title={vehicle.title}
              />
            </div>

            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Specifications
              </h2>
              <dl className="grid grid-cols-2 text-xs">
                <Row label="Stock ID" value={vehicle.stock_id} />
                <Row label="Make" value={vehicle.make} />
                <Row label="Model" value={vehicle.model} />
                <Row label="Grade / Variant" value={vehicle.variant} />
                <Row label="Model code" value={vehicle.model_code} />
                <Row label="Year" value={vehicle.year} />
                <Row
                  label="Mileage"
                  value={
                    vehicle.mileage === null
                      ? null
                      : `${Number(vehicle.mileage).toLocaleString("en-US")} ${vehicle.mileage_unit ?? "km"}`
                  }
                />
                <Row
                  label="Engine"
                  value={vehicle.engine_size ? `${vehicle.engine_size} cc` : null}
                />
                <Row label="Engine code" value={vehicle.engine_type} />
                <Row label="Fuel" value={vehicle.fuel} />
                <Row label="Transmission" value={vehicle.transmission} />
                <Row label="Steering" value={vehicle.steering} />
                <Row label="Drive" value={vehicle.drivetrain} />
                <Row label="Body type" value={vehicle.body_type} />
                <Row label="Colour" value={vehicle.exterior_color} />
                <Row label="Doors" value={vehicle.doors} />
                <Row label="Seats" value={vehicle.seats} />
                <Row label="Location" value={vehicle.inventory_location} />
                <Row label="Status" value={vehicle.status} />
              </dl>
            </div>
          </div>
        </div>

        {grouped.size ? (
          <div className="mt-10 rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Features & equipment
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[...grouped.entries()].map(([category, items]) => (
                <div key={category}>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">{category}</h3>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {data.related.length ? (
          <div className="mt-12">
            <h2 className="mb-4 text-lg font-bold text-foreground">More {vehicle.make} stock</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {data.related.map((item) => (
                <VehicleCard key={item.stock_id} vehicle={toCardVehicle(item)} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
