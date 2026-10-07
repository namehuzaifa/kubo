import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CarFront } from "lucide-react";

import { VehicleCard } from "@/components/VehicleCard";
import { getHomeData, type BrowseTile, type HomePanel } from "@/lib/home.functions";
import { toCardVehicle } from "@/lib/inventory-view";

export const Route = createFileRoute("/")({
  loader: () => getHomeData(),
  head: ({ loaderData }) => {
    const page = loaderData?.page;
    const title = page?.meta_title ?? "Kubo Trading Japan — Japanese Used Car Exporter";
    const description =
      page?.meta_description ??
      "Kubo Trading Japan exports quality Japanese used cars, vans and trucks worldwide from Osaka.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
      ],
    };
  },
  component: Index,
});

function Index() {
  const { panels, makes, bodyStyles, countries, featured, latest, totalVehicles } =
    Route.useLoaderData();

  const hero = panels.find((panel) => panel.variant === "hero");
  const sale = panels.find((panel) => panel.variant === "sale");
  const tiles = panels.filter((panel) => panel.variant === "tile");

  return (
    <div className="bg-surface">
      {/* ---------------------------------------------------------- Hero grid */}
      <section className="mx-auto grid max-w-[1400px] gap-4 px-4 py-8 lg:grid-cols-2">
        <PanelShell panel={hero} className="min-h-[420px] justify-center p-10">
          <h1 className="max-w-md text-4xl font-extrabold leading-tight sm:text-5xl">
            {hero?.title ?? "Car Shopping Event"}
          </h1>
          {hero?.body ? (
            <p className="mt-3 max-w-sm text-sm text-brand-foreground/80">{hero.body}</p>
          ) : null}
          <PanelButton panel={hero} className="mt-6 bg-brand text-brand-foreground" />
        </PanelShell>

        <div className="grid gap-4">
          <PanelShell panel={sale} className="p-8">
            <h2 className="text-2xl font-extrabold">{sale?.title ?? "Vehicles on sales"}</h2>
            <Countdown endsAt={sale?.ends_at ?? null} />
            <PanelButton panel={sale} className="mt-4 bg-brand text-brand-foreground" />
          </PanelShell>

          {tiles.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {tiles.map((tile) => (
                <PanelShell key={tile.id} panel={tile} className="min-h-[150px] p-6">
                  <h2 className="text-lg font-extrabold">{tile.title}</h2>
                  {tile.body ? (
                    <p className="mt-1 text-xs text-brand-foreground/75">{tile.body}</p>
                  ) : null}
                  <PanelButton
                    panel={tile}
                    className="mt-4 bg-background text-foreground hover:opacity-90"
                  />
                </PanelShell>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------------------------ Search tiles */}
      {countries.length > 0 ? (
        <Section title="Search By Country">
          <div className="flex flex-wrap justify-center gap-6 sm:justify-start">
            <CountryTile
              tile={{ slug: "all", name: "All", image_url: null, count: totalVehicles }}
            />
            {countries.map((country) => (
              <CountryTile key={country.slug} tile={country} />
            ))}
          </div>
        </Section>
      ) : null}

      {makes.length > 0 ? (
        <Section title="Filter by Make">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
            {makes.map((make) => (
              <Link
                key={make.slug}
                to="/all-stock"
                search={{ maker: make.name }}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center shadow-card transition-colors hover:border-brand"
              >
                <MakeMark name={make.name} logoUrl={make.image_url} />
                <span className="text-sm font-bold leading-tight">{make.name}</span>
                <span className="text-xs text-brand">{make.count} in stock</span>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      {bodyStyles.length > 0 ? (
        <Section title="Search By Body Style">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {bodyStyles.map((style) => (
              <Link
                key={style.slug}
                to="/all-stock"
                search={{ body: style.name }}
                className="rounded-xl border border-border bg-card p-6 text-center shadow-card transition-colors hover:border-brand"
              >
                <span className="block text-sm font-bold">{style.name}</span>
                <span className="mt-1 block text-xs text-brand">{style.count} in stock</span>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      {/* ------------------------------------------------------------- Stock */}
      {featured.length > 0 ? (
        <Section title="All Stocks" action={{ label: "More Products", to: "/all-stock" }}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((vehicle) => (
              <VehicleCard key={vehicle.slug} vehicle={toCardVehicle(vehicle)} />
            ))}
          </div>
        </Section>
      ) : null}

      {latest.length > 0 ? (
        <Section title="Latest Inventory" action={{ label: "More Products", to: "/new-arrivals" }}>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {latest.map((vehicle) => (
              <VehicleCard key={vehicle.slug} vehicle={toCardVehicle(vehicle)} />
            ))}
          </div>
        </Section>
      ) : null}

      {featured.length === 0 && latest.length === 0 ? (
        <section className="mx-auto max-w-[1400px] px-4 py-16 text-center">
          <CarFront className="mx-auto size-10 text-muted-foreground/40" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            No vehicles are listed yet. Stock will appear here once the inventory is imported.
          </p>
        </section>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** The dark card every promo panel sits in, with its artwork behind the copy. */
function PanelShell({
  panel,
  className,
  children,
}: {
  panel: HomePanel | undefined;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-xl bg-brand-dark text-brand-foreground ${className ?? ""}`}
    >
      {panel?.image_url ? (
        <img
          src={panel.image_url}
          alt=""
          className="absolute inset-0 size-full object-cover opacity-40"
        />
      ) : null}
      <div className="relative">{children}</div>
    </div>
  );
}

function PanelButton({ panel, className }: { panel: HomePanel | undefined; className?: string }) {
  if (!panel?.cta_label) return null;
  const href = panel.cta_href ?? "/all-stock";
  const base = `inline-flex rounded-md px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-90 ${className ?? ""}`;

  // Panel links are typed in by staff, so the internal case is cast and
  // anything else falls back to a plain anchor.
  if (!href.startsWith("/")) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={base}>
        {panel.cta_label}
      </a>
    );
  }
  return (
    <Link to={href as "/all-stock"} search={{} as never} className={base}>
      {panel.cta_label}
    </Link>
  );
}

/**
 * Counts down to the sale's end date.
 *
 * The figures are resolved after mount rather than during render: the server
 * and the browser would compute different remainders from the same deadline,
 * which React would report as a hydration mismatch.
 */
function Countdown({ endsAt }: { endsAt: string | null }) {
  const [parts, setParts] = useState<{ value: string; unit: string }[] | null>(null);

  useEffect(() => {
    if (!endsAt) return;
    const deadline = new Date(endsAt).getTime();

    const tick = () => {
      const remaining = Math.max(0, deadline - Date.now());
      const seconds = Math.floor(remaining / 1000);
      const pad = (value: number) => String(value).padStart(2, "0");
      setParts([
        { value: pad(Math.floor(seconds / 86400)), unit: "DAYS" },
        { value: pad(Math.floor((seconds % 86400) / 3600)), unit: "HR" },
        { value: pad(Math.floor((seconds % 3600) / 60)), unit: "MIN" },
        { value: pad(seconds % 60), unit: "SC" },
      ]);
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  if (!endsAt) return null;

  const shown = parts ?? [
    { value: "--", unit: "DAYS" },
    { value: "--", unit: "HR" },
    { value: "--", unit: "MIN" },
    { value: "--", unit: "SC" },
  ];

  return (
    <div className="mt-4 flex gap-2">
      {shown.map((part) => (
        <span
          key={part.unit}
          className="flex min-w-[52px] flex-col items-center rounded-md bg-background px-3 py-2 text-foreground"
        >
          <span className="text-lg font-extrabold leading-none tabular-nums">{part.value}</span>
          <span className="mt-1 text-[10px] font-semibold text-muted-foreground">{part.unit}</span>
        </span>
      ))}
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; to: "/all-stock" | "/new-arrivals" };
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-[1400px] px-4 py-10">
      <div className="mb-5 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
        {action ? (
          <Link
            to={action.to}
            search={{}}
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
          >
            {action.label}
            <ArrowRight className="size-4" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/**
 * A circular destination tile. Clicking it opens the stock list filtered to the
 * vehicles that market takes — the "All" tile opens it unfiltered.
 */
function CountryTile({ tile }: { tile: BrowseTile }) {
  const [broken, setBroken] = useState(false);

  return (
    <Link
      to="/all-stock"
      search={tile.slug === "all" ? {} : { country: tile.slug }}
      className="group flex w-24 flex-col items-center text-center sm:w-28"
    >
      <span className="relative grid size-20 place-items-center overflow-hidden rounded-full border border-border bg-muted transition-colors group-hover:border-brand sm:size-24">
        {tile.image_url && !broken ? (
          <img
            src={tile.image_url}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <CarFront className="size-6 text-muted-foreground/40" aria-hidden="true" />
        )}
        <span className="relative max-w-[92%] rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-bold leading-tight text-foreground">
          {tile.name}
        </span>
      </span>
      <span className="mt-2 text-xs text-muted-foreground">{tile.count} products</span>
    </Link>
  );
}

function MakeMark({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-background text-[11px] font-bold">
      {logoUrl && !broken ? (
        <img
          src={logoUrl}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="size-8 object-contain"
        />
      ) : (
        initials
      )}
    </span>
  );
}
