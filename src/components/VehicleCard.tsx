import { Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { SaveVehicleButton } from "@/components/SaveVehicleButton";
import { CompareVehicleButton } from "@/components/CompareVehicleButton";
import watermark from "@/assets/watermark-logo.png";
import type { Vehicle } from "@/data/site";
import type { CardVehicle } from "@/lib/inventory-view";

export function VehicleCard({
  vehicle,
  compact = false,
}: {
  vehicle: Vehicle | CardVehicle;
  compact?: boolean;
}) {
  const stockId = "stockId" in vehicle ? vehicle.stockId : undefined;
  // The demo `Vehicle` shape has no id; only catalogue cards can be saved.
  const vehicleId = "id" in vehicle ? vehicle.id : undefined;
  const card = (
    <article
      className={`group h-full overflow-hidden border border-border bg-card shadow-card transition-shadow hover:shadow-hover ${compact ? "rounded-lg" : "rounded-xl"}`}
    >
      <div
        className={`relative overflow-hidden bg-surface ${compact ? "aspect-[16/10]" : "aspect-4/3"}`}
      >
        <img
          src={vehicle.image}
          alt={`${vehicle.name} ${vehicle.bodyType} for export`}
          loading="lazy"
          width={1024}
          height={768}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Company logo watermark on every stock photo */}
        <img
          src={watermark}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="pointer-events-none absolute bottom-2 left-2 w-40 max-w-[60%] opacity-80 drop-shadow-sm"
        />
        <span className="absolute left-2 top-2 rounded-md bg-brand px-2 py-1 text-[11px] font-semibold text-brand-foreground">
          {vehicle.bodyType}
        </span>
        <div className="absolute right-2 top-2 flex flex-col gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          {vehicleId ? <CompareVehicleButton vehicleId={vehicleId} title={vehicle.name} /> : null}
          <span className="flex size-8 items-center justify-center rounded-full bg-background text-foreground/80 shadow-card">
            <Eye className="size-4" />
          </span>
          {vehicleId ? <SaveVehicleButton vehicleId={vehicleId} title={vehicle.name} /> : null}
        </div>
      </div>
      <div className={compact ? "space-y-1.5 p-3" : "space-y-2 p-4"}>
        <p className="text-xs text-muted-foreground">
          {vehicle.countries.filter((c) => c !== "All").join(", ")}
        </p>
        <h3 className="text-sm font-semibold leading-snug text-foreground">{vehicle.name}</h3>
        <dl className="grid grid-cols-2 gap-x-2 text-xs text-muted-foreground">
          <dt>Maker</dt>
          <dd className="text-right text-foreground">{vehicle.maker}</dd>
          <dt>Model</dt>
          <dd className="text-right text-foreground">{vehicle.model}</dd>
          <dt>Mileage</dt>
          <dd className="text-right text-foreground">
            {vehicle.mileageKm.toLocaleString("en-US")} km
          </dd>
          <dt>Trans / Fuel</dt>
          <dd className="text-right text-foreground">
            {vehicle.transmission} / {vehicle.fuel}
          </dd>
          <dt>Steering</dt>
          <dd className="text-right text-foreground">{vehicle.steering} hand</dd>
        </dl>
        <div className="flex items-center justify-between pt-1">
          <span className="text-base font-bold text-brand">{vehicle.price}</span>
          <span className="rounded-full bg-secondary px-2 py-1 text-[11px] font-medium text-secondary-foreground">
            {vehicle.stock}
          </span>
        </div>
      </div>
    </article>
  );

  if (!stockId) return card;
  return (
    <Link to="/cars/$stockId" params={{ stockId }} className="block h-full">
      {card}
    </Link>
  );
}
