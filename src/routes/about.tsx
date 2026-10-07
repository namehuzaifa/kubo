import { createFileRoute } from "@tanstack/react-router";

import { PageHero } from "@/components/PageHero";
import { getPageContent, getSiteSettings } from "@/lib/content.functions";

const SLUG = "about" as const;

const FALLBACK = {
  heroTitle: "About Kubo Trading Japan",
  heroSubtitle:
    "A small Osaka team handling sourcing, inspection, documentation and shipping under one roof.",
  metaTitle: "About Us | Kubo Trading Japan",
  metaDescription:
    "Kubo Trading Japan is an Osaka-based used vehicle exporter with direct auction access, in-house inspection and shipping to over 40 countries.",
};

export const Route = createFileRoute("/about")({
  loader: async () => {
    const [content, settings] = await Promise.all([
      getPageContent({ data: { slug: SLUG } }),
      getSiteSettings(),
    ]);
    return { ...content, address: settings.contact.address };
  },
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
        { property: "og:type", content: "website" },
      ],
    };
  },
  component: About,
});

function About() {
  const { page, blocks, address } = Route.useLoaderData();

  // Editors separate paragraphs with a blank line.
  const paragraphs = (page?.body ?? "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div className="bg-surface">
      <PageHero
        title={page?.hero_title ?? FALLBACK.heroTitle}
        subtitle={page?.hero_subtitle ?? FALLBACK.heroSubtitle}
      />
      <div className="mx-auto max-w-[1400px] px-4 py-12">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            {paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
            {address ? <p className="text-foreground">{address}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {blocks.map((stat) => (
              <div
                key={stat.id}
                className="rounded-xl border border-border bg-card p-6 shadow-card"
              >
                <p className="text-2xl font-extrabold text-brand">{stat.title}</p>
                {stat.body ? (
                  <p className="mt-1 text-sm text-muted-foreground">{stat.body}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
