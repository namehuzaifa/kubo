import { createFileRoute } from "@tanstack/react-router";

import { PageHero } from "@/components/PageHero";
import { getPageContent } from "@/lib/content.functions";

const SLUG = "how-to-buy" as const;

// Used if the content row has not loaded — the page still renders something
// sensible rather than an empty hero.
const FALLBACK = {
  heroTitle: "How To Buy",
  heroSubtitle:
    "From first enquiry to documents in your hand, usually two to four weeks depending on sailing schedule.",
  metaTitle: "How To Buy a Japanese Used Car | Kubo Trading Japan",
  metaDescription:
    "Step by step: choosing a vehicle, quotation, payment, inspection, shipping and export documents.",
};

export const Route = createFileRoute("/how-to-buy")({
  loader: () => getPageContent({ data: { slug: SLUG } }),
  head: ({ loaderData }) => {
    const page = loaderData?.page;
    const title = page?.meta_title ?? FALLBACK.metaTitle;
    const description = page?.meta_description ?? FALLBACK.metaDescription;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: HowToBuy,
});

function HowToBuy() {
  const { page, blocks } = Route.useLoaderData();

  return (
    <div className="bg-surface">
      <PageHero
        title={page?.hero_title ?? FALLBACK.heroTitle}
        subtitle={page?.hero_subtitle ?? FALLBACK.heroSubtitle}
      />
      <div className="mx-auto max-w-[1400px] px-4 py-12">
        <ol className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {blocks.map((step) => (
            <li key={step.id} className="rounded-xl border border-border bg-card p-6 shadow-card">
              <h2 className="text-sm font-bold text-brand">{step.title}</h2>
              {step.body ? <p className="mt-2 text-sm text-muted-foreground">{step.body}</p> : null}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
