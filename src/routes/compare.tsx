import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Repeat, X } from "lucide-react";

import { getVehiclesByIds, type InventoryVehicle } from "@/lib/inventory.functions";
import { bodyImage, formatPrice } from "@/lib/inventory-view";
import { useCompare, COMPARE_LIMIT } from "@/hooks/use-compare";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare vehicles | Kubo Trading Japan" },
      {
        name: "description",
        content:
          "Put Japanese used vehicles side by side and compare price, mileage, engine, transmission and equipment before you inquire.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Compare,
});

/** The rows of the comparison table, in the order buyers tend to ask about them. */
const SPECS: { label: string; value: (vehicle: InventoryVehicle) => string }[] = [
  { label: "Price", value: (v) => formatPrice(v.price, v.currency) },
  { label: "Stock ID", value: (v) => v.stock_id },
  { label: "Year", value: (v) => (v.year ? String(v.year) : "—") },
  {
    label: "Mileage",
    value: (v) =>
      v.mileage === null ? "—" : `${v.mileage.toLocaleString()} ${v.mileage_unit ?? "km"}`,
  },
  { label: "Engine", value: (v) => (v.engine_size ? `${v.engine_size.toLocaleString()} cc` : "—") },
  { label: "Fuel", value: (v) => v.fuel ?? "—" },
  { label: "Transmission", value: (v) => v.transmission ?? "—" },
  { label: "Steering", value: (v) => v.steering ?? "—" },
  { label: "Drive", value: (v) => v.drivetrain ?? "—" },
  { label: "Body style", value: (v) => v.body_type ?? "—" },
  { label: "Doors", value: (v) => (v.doors === null ? "—" : String(v.doors)) },
  { label: "Seats", value: (v) => (v.seats === null ? "—" : String(v.seats)) },
  { label: "Colour", value: (v) => v.exterior_color ?? "—" },
  { label: "Location", value: (v) => v.inventory_location ?? "—" },
];

function Compare() {
  const { ids, ready, remove, clear } = useCompare();

  const { data, isPending } = useQuery({
    queryKey: ["compare", ids],
    queryFn: () => getVehiclesByIds({ data: { ids } }),
    enabled: ready && ids.length > 0,
  });

  const vehicles = data?.vehicles ?? [];

  return (
    <div className="bg-surface">
      <PageHero
        title="Compare vehicles"
        subtitle={`Put up to ${COMPARE_LIMIT} vehicles side by side before you inquire.`}
      />

      <div className="mx-auto max-w-[1400px] px-4 py-12">
        {!ready || (isPending && ids.length > 0) ? (
          <Skeleton className="h-96 w-full" />
        ) : vehicles.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-card">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
              <Repeat className="size-5 text-muted-foreground" aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg font-bold">Nothing to compare yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Tap the compare arrows on any vehicle to add it here. You can line up {COMPARE_LIMIT}{" "}
              at a time.
            </p>
            <Button asChild className="mt-6">
              <Link to="/all-stock" search={{}}>
                Browse stock
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {vehicles.length} of {COMPARE_LIMIT} slots used
              </p>
              <Button variant="outline" size="sm" onClick={clear}>
                Clear all
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="w-36 border-b border-border p-4 text-left align-bottom text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Vehicle
                    </th>
                    {vehicles.map((vehicle) => (
                      <th
                        key={vehicle.id}
                        className="border-b border-l border-border p-4 text-left align-top"
                      >
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Remove"
                            className="absolute -right-2 -top-2"
                            onClick={() => remove(vehicle.id)}
                          >
                            <X className="size-4" />
                            <span className="sr-only">Remove {vehicle.title}</span>
                          </Button>

                          <Link
                            to="/cars/$stockId"
                            params={{ stockId: vehicle.stock_id }}
                            className="block"
                          >
                            <img
                              src={bodyImage(vehicle.body_type)}
                              alt=""
                              loading="lazy"
                              className="aspect-4/3 w-full rounded-lg object-cover"
                            />
                            <span className="mt-2 block text-sm font-bold hover:text-brand">
                              {vehicle.title}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {[vehicle.make, vehicle.model].filter(Boolean).join(" ")}
                            </span>
                          </Link>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {SPECS.map((spec, index) => (
                    <tr key={spec.label} className={index % 2 === 1 ? "bg-muted/40" : undefined}>
                      <th className="p-4 text-left align-top text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {spec.label}
                      </th>
                      {vehicles.map((vehicle) => (
                        <td
                          key={vehicle.id}
                          className="border-l border-border p-4 align-top font-medium"
                        >
                          {spec.value(vehicle)}
                        </td>
                      ))}
                    </tr>
                  ))}

                  <tr>
                    <th className="p-4" />
                    {vehicles.map((vehicle) => (
                      <td key={vehicle.id} className="border-l border-border p-4">
                        <Button asChild className="w-full">
                          <Link to="/cars/$stockId" params={{ stockId: vehicle.stock_id }}>
                            View & inquire
                          </Link>
                        </Button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
