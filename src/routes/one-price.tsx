import { createFileRoute } from "@tanstack/react-router";
import { StockBrowser } from "@/components/StockBrowser";

export const Route = createFileRoute("/one-price")({
  head: () => ({
    meta: [
      { title: "One Price Stock — Fixed Price Japanese Cars | Kubo Trading" },
      {
        name: "description",
        content:
          "Fixed-price Japanese used vehicles with no bidding and no negotiation. Pay the listed FOB price and we start documentation the same day.",
      },
      { property: "og:title", content: "One Price Stock — Kubo Trading Japan" },
      {
        property: "og:description",
        content: "Fixed-price Japanese used cars — no auction, no bidding, no haggling.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnePrice,
});

function OnePrice() {
  return (
    <div className="bg-surface py-5">
      <div className="mx-auto max-w-[1560px] px-3 sm:px-4">
        <StockBrowser initial={{ sort: "price-asc" }} />
      </div>
    </div>
  );
}