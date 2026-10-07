import { Link } from "@tanstack/react-router";
import { NavLink } from "@/components/NavLink";
import type { ContactSettings } from "@/integrations/supabase/admin-schema";
import type { NavItem } from "@/lib/content.functions";

export function SiteFooter({ contact, nav }: { contact: ContactSettings; nav: NavItem[] }) {
  return (
    <footer className="mt-20 bg-brand-dark text-brand-foreground">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-14 md:grid-cols-4">
        <div className="space-y-3">
          <p className="text-lg font-extrabold uppercase tracking-wide">{contact.name}</p>
          <p className="text-sm text-brand-foreground/70">
            Exporting quality Japanese used vehicles worldwide since 2010. Auction access,
            inspection and door-to-door shipping handled by one team.
          </p>
        </div>
        <div>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide">Quick Links</h2>
          <ul className="space-y-2 text-sm text-brand-foreground/70">
            {nav.slice(1).map((item) => (
              <li key={item.id}>
                <NavLink href={item.href} className="transition-colors hover:text-brand-foreground">
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide">Contact</h2>
          <ul className="space-y-2 text-sm text-brand-foreground/70">
            <li>{contact.address}</li>
            <li>
              <a href={`tel:${contact.phone.replace(/\s/g, "")}`}>{contact.phone}</a>
            </li>
            <li>
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide">Payment & Shipping</h2>
          <p className="text-sm text-brand-foreground/70">
            T/T bank transfer. FOB, C&amp;F and CIF terms available to all major ports. Inspection
            certificates (JEVIC, QISJ, EAA) arranged on request.
          </p>
        </div>
      </div>
      <div className="border-t border-brand-foreground/10 py-5 text-center text-xs text-brand-foreground/60">
        © {new Date().getFullYear()} {contact.name}. All rights reserved.
      </div>
    </footer>
  );
}
