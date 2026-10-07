import { createFileRoute } from "@tanstack/react-router";
import { Mail, MapPin, Phone } from "lucide-react";

import { PageHero } from "@/components/PageHero";
import { getPageContent, getSiteSettings } from "@/lib/content.functions";

const SLUG = "contact" as const;

const FALLBACK = {
  heroTitle: "Contact Us",
  heroSubtitle:
    "Our Osaka office answers enquiries in English and Japanese, Monday to Saturday, 9:00–18:00 JST.",
  metaTitle: "Contact Kubo Trading Japan | Osaka Used Car Exporter",
  metaDescription:
    "Contact Kubo Trading Japan in Osaka by phone or email for vehicle quotations, shipping schedules and export documentation.",
};

export const Route = createFileRoute("/contact")({
  loader: async () => {
    const [content, settings] = await Promise.all([
      getPageContent({ data: { slug: SLUG } }),
      getSiteSettings(),
    ]);
    return { ...content, contact: settings.contact };
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
      ],
    };
  },
  component: Contact,
});

function Contact() {
  const { page, contact } = Route.useLoaderData();

  const cards = [
    contact.phone
      ? {
          Icon: Phone,
          title: "Phone",
          value: contact.phone,
          href: `tel:${contact.phone.replace(/\s/g, "")}`,
        }
      : null,
    contact.email
      ? { Icon: Mail, title: "Email", value: contact.email, href: `mailto:${contact.email}` }
      : null,
    contact.address
      ? { Icon: MapPin, title: "Office", value: contact.address, href: undefined }
      : null,
  ].filter((card) => card !== null);

  return (
    <div className="bg-surface">
      <PageHero
        title={page?.hero_title ?? FALLBACK.heroTitle}
        subtitle={page?.hero_subtitle ?? FALLBACK.heroSubtitle}
      />
      <div className="mx-auto grid max-w-[1400px] gap-5 px-4 py-12 md:grid-cols-3">
        {cards.map(({ Icon, title, value, href }) => (
          <div key={title} className="rounded-xl border border-border bg-card p-6 shadow-card">
            <Icon className="size-6 text-brand" />
            <h2 className="mt-3 text-sm font-bold text-foreground">{title}</h2>
            {href ? (
              <a href={href} className="mt-1 block text-sm text-muted-foreground hover:text-brand">
                {value}
              </a>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">{value}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
