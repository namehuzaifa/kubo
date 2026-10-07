import { createFileRoute } from "@tanstack/react-router";
import { StockBrowser } from "@/components/StockBrowser";

type StockSearch = {
  maker?: string | undefined;
  body?: string | undefined;
  fuel?: string | undefined;
  transmission?: string | undefined;
  steering?: string | undefined;
  country?: string | undefined;
};

export const Route = createFileRoute("/all-stock")({
  validateSearch: (search: Record<string, unknown>): StockSearch => {
    const str = (key: string) =>
      typeof search[key] === "string" ? (search[key] as string) : undefined;
    return {
      maker: str("maker"),
      body: str("body"),
      fuel: str("fuel"),
      transmission: str("transmission"),
      steering: str("steering"),
      country: str("country"),
    };
  },
  head: () => ({
    meta: [
      { title: "All Stock — Japanese Used Cars, Vans & Trucks | Kubo Trading" },
      {
        name: "description",
        content:
          "Filter our full Japanese used vehicle stock by make, body style, fuel, transmission and steering. Sedans, hatchbacks, SUVs, vans, trucks, buses and kei cars ready for export.",
      },
      { property: "og:title", content: "All Stock — Kubo Trading Japan" },
      {
        property: "og:description",
        content: "Filter Japanese used cars by make and body style, ready for worldwide export.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AllStock,
});

function AllStock() {
  const search = Route.useSearch();
  return (
    <div className="bg-surface py-5">
      <div className="mx-auto max-w-[1560px] px-3 sm:px-4">
        <StockBrowser
          key={`${search.maker ?? ""}-${search.body ?? ""}-${search.country ?? ""}`}
          initial={search}
        />
      </div>
    </div>
  );
}
