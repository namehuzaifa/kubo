import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Car, ExternalLink, FileText, Inbox, LayoutDashboard, LogOut, Tags } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAdminSession } from "@/hooks/use-admin-session";
import { getSiteSettings } from "@/lib/content.functions";
import { ThemeToggle } from "@/components/admin/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Kubo Trading Japan" },
      // Nothing under /admin should ever reach a search index.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/inquiries", label: "Inquiries", icon: Inbox, exact: false },
  { to: "/admin/vehicles", label: "Listings", icon: Car, exact: false },
  { to: "/admin/taxonomy", label: "Browse Lists", icon: Tags, exact: false },
  { to: "/admin/content", label: "Content", icon: FileText, exact: false },
] as const;

function AdminLayout() {
  const { loading, session } = useAdminSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const { data: settings } = useQuery({
    queryKey: ["admin", "site-settings"],
    queryFn: () => getSiteSettings(),
  });

  // Also on <html>, so portalled dialogs and toasts get the dashboard palette.
  useEffect(() => {
    document.documentElement.classList.add("admin-shell");
    return () => document.documentElement.classList.remove("admin-shell");
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      void navigate({ to: "/login", search: { redirect: pathname } });
      return;
    }
    if (!session.isStaff) {
      void navigate({ to: "/account/inquiries" });
    }
  }, [loading, session, navigate, pathname]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // The effect above is already redirecting; render nothing rather than a
  // flash of dashboard chrome the visitor is not entitled to.
  if (!session?.isStaff) return null;

  const brandName = settings?.contact.name ?? "Kubo Trading";
  const logoUrl = settings?.contact.logo_url ?? "";
  const current = NAV.find((item) =>
    item.exact ? pathname === item.to : pathname.startsWith(item.to),
  );

  return (
    // admin-shell swaps the colour tokens for the warmer dashboard palette; see
    // the comment above .admin-shell in styles.css.
    <div className="admin-shell flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <Link
          to="/"
          className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5 transition-opacity hover:opacity-90"
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="size-9 shrink-0 rounded-lg bg-white/90 object-contain p-1"
            />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-black tracking-tight text-sidebar-primary-foreground">
              {brandName.slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-bold">{brandName}</span>
            <span className="block text-xs text-sidebar-foreground/60">Dashboard</span>
          </span>
        </Link>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className={cn("size-4", active && "text-sidebar-primary")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold uppercase">
              {session.email?.slice(0, 1) ?? "?"}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-medium">{session.email}</span>
              <span className="block text-xs text-sidebar-foreground/60">
                {session.isAdmin ? "Administrator" : "Staff"}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              void navigate({ to: "/login" });
            }}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-1 md:hidden">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={item.label}
                  className={cn(
                    "rounded-lg p-2 transition-colors",
                    active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                  )}
                >
                  <item.icon className="size-4" />
                </Link>
              );
            })}
          </div>

          <span className="hidden text-sm font-semibold md:inline">{current?.label}</span>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <a href="/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                <span className="hidden sm:inline">View site</span>
              </a>
            </Button>
            <ThemeToggle />
            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              title="Sign out"
              onClick={async () => {
                await supabase.auth.signOut();
                void navigate({ to: "/login" });
              }}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        <div className="min-w-0 flex-1 p-4 md:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
