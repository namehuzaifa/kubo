import { Link } from "@tanstack/react-router";
import { Search, Repeat, Heart, ShoppingCart, Phone, Globe, AlertTriangle } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { HeaderAccountMenu } from "@/components/HeaderAccountMenu";
import { HeaderCompareLink } from "@/components/HeaderCompareLink";
import type { ContactSettings } from "@/integrations/supabase/admin-schema";
import type { NavItem } from "@/lib/content.functions";

export function SiteHeader({ contact, nav }: { contact: ContactSettings; nav: NavItem[] }) {
  return (
    <header className="sticky top-0 z-50">
      <div className="bg-brand text-brand-foreground">
        <div className="mx-auto flex max-w-[1400px] items-center justify-center gap-2 px-4 py-2 text-center text-xs font-medium sm:text-sm">
          <span>Beware of Fake, Scam and Phishing Emails</span>
          <AlertTriangle className="size-4" aria-hidden />
        </div>
      </div>

      <div className="bg-background">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            {contact.logo_url ? (
              <img
                src={contact.logo_url}
                alt={contact.name}
                className="size-12 shrink-0 rounded-md object-contain"
              />
            ) : (
              // No logo set — fall back to a lettermark from the company name.
              <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-brand-dark text-brand-foreground">
                <span className="text-lg font-black tracking-tight">
                  {contact.name
                    .split(/\s+/)
                    .map((word) => word[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              </span>
            )}
            <span className="leading-tight">
              <span className="block text-sm font-extrabold uppercase tracking-wide text-foreground">
                {contact.name}
              </span>
              <span className="block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {contact.tagline}
              </span>
            </span>
          </Link>

          <form
            className="order-3 flex min-w-0 flex-1 items-center rounded-full border border-border bg-background pl-4 pr-1 py-1 md:order-none"
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              type="search"
              aria-label="Search for products"
              placeholder="Search for products"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              aria-label="Search"
              className="flex size-9 items-center justify-center rounded-full bg-brand text-brand-foreground transition-opacity hover:opacity-90"
            >
              <Search className="size-4" />
            </button>
          </form>

          <div className="ml-auto hidden items-center gap-8 lg:flex">
            <div className="flex items-center gap-3">
              <Phone className="size-6 text-brand" />
              <span className="text-sm leading-tight">
                <span className="block font-semibold">24 Support</span>
                <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="block text-brand">
                  {contact.phone}
                </a>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Globe className="size-6 text-brand" />
              <span className="text-sm leading-tight">
                <span className="block font-semibold">Worldwide</span>
                <span className="block text-brand">Free Shipping</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-y border-border bg-surface">
        <div className="mx-auto flex max-w-[1400px] items-center gap-2 overflow-x-auto px-4 py-2">
          <nav className="flex items-center gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.id}
                href={item.href}
                activeClassName="bg-brand/10 text-brand"
                className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:text-brand"
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            <span className="rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold">
              {contact.currency_label}
            </span>

            <HeaderAccountMenu />

            <HeaderCompareLink />

            <Link
              to="/account/saved"
              aria-label="Saved vehicles"
              className="flex size-9 items-center justify-center rounded-full bg-background text-foreground/80 shadow-card transition-colors hover:text-brand"
            >
              <Heart className="size-4" />
            </Link>
            <span className="flex items-center gap-2 rounded-full bg-brand px-3 py-2 text-brand-foreground">
              <ShoppingCart className="size-4" />
              <span className="text-xs font-semibold">¥0</span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
