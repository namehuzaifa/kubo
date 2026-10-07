import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CarFront, Search, X } from "lucide-react";
import { VehicleCard } from "@/components/VehicleCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getFacets, listVehicles, type InventoryFilters } from "@/lib/inventory.functions";
import { listAllTaxonomies } from "@/lib/taxonomy.functions";
import { toCardVehicle } from "@/lib/inventory-view";
import { getMakerInitials, getMakerLogoUrl } from "@/lib/maker-logos";

export type StockFilters = {
  maker?: string | undefined;
  body?: string | undefined;
  fuel?: string | undefined;
  transmission?: string | undefined;
  steering?: string | undefined;
  /** Destination market slug. */
  country?: string | undefined;
  sort?: string | undefined;
};

function MakerButton({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logoKey = import.meta.env["VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY"];
  const initials = getMakerInitials(label);
  const logoUrl = getMakerLogoUrl(label, logoKey);

  return (
    <Button
      variant={active ? "default" : "outline"}
      onClick={onClick}
      aria-pressed={active}
      className="h-12 w-full justify-start rounded-full px-4 text-sm shadow-none"
    >
      <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-background text-[10px] font-bold text-secondary-foreground">
        {label === "All makes" ? (
          <CarFront className="size-4" aria-hidden="true" />
        ) : logoUrl && !logoFailed ? (
          <img
            src={logoUrl}
            alt=""
            loading="lazy"
            className="size-6 object-contain"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          initials
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {count !== undefined ? (
        <span className={active ? "opacity-80" : "text-muted-foreground"}>{count}</span>
      ) : null}
    </Button>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; count: number }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-xs font-semibold text-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="h-12 bg-background px-4 shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="All">All</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.value} ({option.count})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Facet counts come from the live catalogue, but which options are offered and
 * in what order is a staff decision. The managed list therefore leads: anything
 * switched off in the dashboard disappears from the filter even if stock still
 * carries it, and the ordering is the one set there rather than by count.
 */
function applyManagedOrder(
  facetOptions: { value: string; count: number }[] | undefined,
  managed: { name: string }[] | undefined,
): { value: string; count: number }[] {
  const options = facetOptions ?? [];
  if (!managed || managed.length === 0) return options;

  const counts = new Map(options.map((option) => [option.value, option.count]));
  return managed
    .filter((item) => counts.has(item.name))
    .map((item) => ({ value: item.name, count: counts.get(item.name) ?? 0 }));
}

export function StockBrowser({ initial }: { initial?: StockFilters }) {
  const [maker, setMaker] = useState(initial?.maker ?? "All");
  const [body, setBody] = useState(initial?.body ?? "All");
  const [fuel, setFuel] = useState(initial?.fuel ?? "All");
  const [transmission, setTransmission] = useState(initial?.transmission ?? "All");
  const [steering, setSteering] = useState(initial?.steering ?? "All");
  const [country, setCountry] = useState(initial?.country ?? "All");
  const [sort, setSort] = useState(initial?.sort ?? "newest");
  const [query, setQuery] = useState("");
  const [model, setModel] = useState("All");
  const [drivetrain, setDrivetrain] = useState("All");
  const [color, setColor] = useState("All");
  const [feature, setFeature] = useState("All");
  const [page, setPage] = useState(1);

  const filters: InventoryFilters = {
    make: maker === "All" ? undefined : maker,
    model: model === "All" ? undefined : model,
    body: body === "All" ? undefined : body,
    fuel: fuel === "All" ? undefined : fuel,
    transmission: transmission === "All" ? undefined : transmission,
    steering: steering === "All" ? undefined : steering,
    country: country === "All" ? undefined : country,
    drivetrain: drivetrain === "All" ? undefined : drivetrain,
    color: color === "All" ? undefined : color,
    feature: feature === "All" ? undefined : feature,
    q: query.trim() === "" ? undefined : query.trim(),
    sort,
  };

  const listQuery = useQuery({
    queryKey: ["vehicles", filters, page],
    queryFn: () => listVehicles({ data: { ...filters, page, perPage: 24 } }),
  });
  const facetQuery = useQuery({
    queryKey: ["facets", filters],
    queryFn: () => getFacets({ data: filters }),
  });
  const taxonomyQuery = useQuery({
    queryKey: ["taxonomies"],
    queryFn: () => listAllTaxonomies(),
  });

  const results = listQuery.data?.vehicles ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 24));
  const facets = facetQuery.data;
  const taxonomies = taxonomyQuery.data;
  const makeOptions = applyManagedOrder(facets?.makes, taxonomies?.makes);
  const bodyOptions = applyManagedOrder(facets?.bodyTypes, taxonomies?.body_styles);
  const set =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  const reset = () => {
    setMaker("All");
    setBody("All");
    setFuel("All");
    setTransmission("All");
    setSteering("All");
    setModel("All");
    setDrivetrain("All");
    setColor("All");
    setFeature("All");
    setCountry("All");
    setQuery("");
    setPage(1);
  };
  const hasFilters =
    [maker, body, fuel, transmission, steering, model, drivetrain, color, feature, country].some(
      (value) => value !== "All",
    ) || query !== "";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
      <div className="grid lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="border-b border-border p-4 lg:border-b-0 lg:border-r lg:p-5">
          <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <h1 className="truncate text-base font-bold text-foreground">Make</h1>
            <span className="text-sm text-muted-foreground">{makeOptions.length}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 lg:max-h-[610px] lg:flex-col lg:overflow-y-auto lg:pr-2">
            <div className="w-52 shrink-0 lg:w-full">
              <MakerButton
                label="All makes"
                active={maker === "All"}
                onClick={() => {
                  set(setMaker)("All");
                  setModel("All");
                }}
              />
            </div>
            {makeOptions.map((make) => (
              <div key={make.value} className="w-52 shrink-0 lg:w-full">
                <MakerButton
                  label={make.value}
                  count={make.count}
                  active={maker === make.value}
                  onClick={() => {
                    set(setMaker)(make.value);
                    setModel("All");
                  }}
                />
              </div>
            ))}
          </div>
        </aside>

        <div className="min-w-0 p-4 lg:p-5">
          <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px_auto]">
            <label className="relative min-w-0">
              <span className="sr-only">Search stock</span>
              <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => set(setQuery)(event.target.value)}
                placeholder="Search by stock ID, maker or model"
                className="h-11 w-full rounded-md border border-border bg-background pl-11 pr-4 text-sm outline-none focus:border-brand"
              />
            </label>
            <Select value={sort} onValueChange={set(setSort)}>
              <SelectTrigger aria-label="Sort results" className="h-11 bg-background shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest year</SelectItem>
                <SelectItem value="year-asc">Oldest year</SelectItem>
                <SelectItem value="recent">Recently added</SelectItem>
                <SelectItem value="price-asc">Price: low to high</SelectItem>
                <SelectItem value="price-desc">Price: high to low</SelectItem>
                <SelectItem value="mileage">Lowest mileage</SelectItem>
                <SelectItem value="mileage-desc">Highest mileage</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters ? (
              <Button variant="outline" className="h-11" onClick={reset}>
                <X /> Clear
              </Button>
            ) : null}
          </div>

          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
            <FilterSelect
              label="Model"
              value={model}
              options={facets?.models ?? []}
              onChange={set(setModel)}
            />
            <FilterSelect
              label="Fuel"
              value={fuel}
              options={facets?.fuels ?? []}
              onChange={set(setFuel)}
            />
            <FilterSelect
              label="Transmission"
              value={transmission}
              options={facets?.transmissions ?? []}
              onChange={set(setTransmission)}
            />
            <div className="min-w-0">
              <label className="mb-2 block text-xs font-semibold text-foreground">
                Destination
              </label>
              <Select value={country} onValueChange={set(setCountry)}>
                <SelectTrigger
                  aria-label="Destination"
                  className="h-12 bg-background px-4 shadow-none"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All destinations</SelectItem>
                  {(taxonomies?.countries ?? []).map((option) => (
                    <SelectItem key={option.slug} value={option.slug}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FilterSelect
              label="Body style"
              value={body}
              options={bodyOptions}
              onChange={set(setBody)}
            />
            <FilterSelect
              label="Steering"
              value={steering}
              options={facets?.steerings ?? []}
              onChange={set(setSteering)}
            />
            <FilterSelect
              label="Drive"
              value={drivetrain}
              options={facets?.drivetrains ?? []}
              onChange={set(setDrivetrain)}
            />
            <FilterSelect
              label="Feature"
              value={feature}
              options={facets?.features ?? []}
              onChange={set(setFeature)}
            />
            <FilterSelect
              label="Colour"
              value={color}
              options={facets?.colors ?? []}
              onChange={set(setColor)}
            />
          </div>

          <div className="my-5 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{results.length}</span> of{" "}
              {total.toLocaleString("en-US")} vehicles
            </p>
          </div>

          {results.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <p className="text-sm text-muted-foreground">
                {listQuery.isLoading
                  ? "Loading stock…"
                  : "No vehicles match these filters. Try clearing one of them."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((vehicle) => (
                  <VehicleCard key={vehicle.stock_id} vehicle={toCardVehicle(vehicle)} compact />
                ))}
              </div>
              {totalPages > 1 ? (
                <div className="flex items-center justify-center gap-3 pt-6">
                  <Button
                    variant="outline"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
