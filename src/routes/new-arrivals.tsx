import { createFileRoute } from "@tanstack/react-router";
import { StockBrowser } from "@/components/StockBrowser";

export const Route = createFileRoute("/new-arrivals")({
  head: () => ({
    meta: [
      { title: "New Arrivals — Fresh Japanese Stock | Kubo Trading" },
      {
        name: "description",
        content:
          "The newest vehicles added to Kubo Trading Japan's export stock, updated as units clear auction and inspection.",
      },
      { property: "og:title", content: "New Arrivals — Kubo Trading Japan" },
      {
        property: "og:description",
        content: "Newest Japanese used cars added to our export stock this week.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewArrivals,
});

function NewArrivals() {
  return (
    <div className="bg-surface py-5">
      <div className="mx-auto max-w-[1560px] px-3 sm:px-4">
        <StockBrowser initial={{ sort: "recent" }} />
      </div>
    </div>
  );
}