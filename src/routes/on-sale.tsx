import { createFileRoute } from "@tanstack/react-router";
import { StockBrowser } from "@/components/StockBrowser";

export const Route = createFileRoute("/on-sale")({
  head: () => ({
    meta: [
      { title: "On Sale — Discounted Japanese Used Cars | Kubo Trading" },
      {
        name: "description",
        content:
          "Limited-time discounts on selected Japanese used vehicles. Sale prices are held until the countdown ends or the unit sells.",
      },
      { property: "og:title", content: "On Sale — Kubo Trading Japan" },
      {
        property: "og:description",
        content: "Limited-time discounts on selected export-ready Japanese vehicles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnSale,
});

function OnSale() {
  return (
    <div className="bg-surface py-5">
      <div className="mx-auto max-w-[1560px] px-3 sm:px-4">
        <StockBrowser initial={{ sort: "price-asc" }} />
      </div>
    </div>
  );
}