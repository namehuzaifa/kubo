import { createFileRoute } from "@tanstack/react-router";

/**
 * Authorised supplier-feed import endpoint.
 *
 * POST a CSV body (content-type: text/csv) or JSON ({ source, rows: [...] }).
 * Requires the x-import-token header, so it is not publicly triggerable.
 */
export const Route = createFileRoute("/api/public/import-feed")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["INVENTORY_IMPORT_TOKEN"];
        if (!token || request.headers.get("x-import-token") !== token) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        const contentType = request.headers.get("content-type") ?? "";
        const sourceHeader = request.headers.get("x-import-source");
        const { importFeed, parseCsv } = await import("@/lib/feed-import.server");
        type FeedRow = Record<string, string | number | null | undefined>;

        try {
          let sourceName = sourceHeader?.trim() || "supplier-feed";
          let rows: FeedRow[] = [];

          if (contentType.includes("json")) {
            const body = (await request.json()) as {
              source?: string;
              rows?: FeedRow[];
              csv?: string;
            };
            if (body.source) sourceName = body.source;
            rows = body.csv ? parseCsv(body.csv) : (body.rows ?? []);
          } else {
            rows = parseCsv(await request.text());
          }

          if (rows.length === 0) {
            return new Response(JSON.stringify({ error: "Feed contained no rows" }), {
              status: 400,
              headers: { "content-type": "application/json" },
            });
          }

          const report = await importFeed({ sourceName, rows });
          return new Response(JSON.stringify(report, null, 2), {
            headers: { "content-type": "application/json" },
          });
        } catch (error) {
          console.error("feed import failed", error);
          return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : "import failed" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});