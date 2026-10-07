import { createFileRoute } from "@tanstack/react-router";

/**
 * Inventory sync endpoint. Called manually or by a scheduler.
 * Requires the x-sync-secret header, so it is not publicly triggerable.
 */
export const Route = createFileRoute("/api/public/sync-inventory")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["INVENTORY_SYNC_SECRET"];
        if (!secret || request.headers.get("x-sync-secret") !== secret) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        let body: { pagesPerBodyType?: number; markRemoved?: boolean } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          body = {};
        }

        const pages = Math.min(Math.max(Number(body.pagesPerBodyType ?? 2), 1), 12);
        const { runInventorySync } = await import("@/lib/inventory-sync.server");

        try {
          const report = await runInventorySync({
            pagesPerBodyType: pages,
            markRemoved: body.markRemoved === true,
          });
          return new Response(JSON.stringify(report, null, 2), {
            headers: { "content-type": "application/json" },
          });
        } catch (error) {
          console.error("inventory sync failed", error);
          return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "sync failed" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});