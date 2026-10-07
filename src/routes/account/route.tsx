import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { FileText, Heart, LayoutDashboard, LogOut, UserCog } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAdminSession } from "@/hooks/use-admin-session";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My Account — Kubo Trading Japan" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AccountLayout,
});

const NAV = [
  { to: "/account", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/account/inquiries", label: "My inquiries", icon: FileText, exact: false },
  { to: "/account/saved", label: "Saved vehicles", icon: Heart, exact: false },
  { to: "/account/profile", label: "Profile", icon: UserCog, exact: false },
] as const;

function AccountLayout() {
  const { loading, session } = useAdminSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (!loading && !session) {
      void navigate({ to: "/login", search: { redirect: pathname } });
    }
  }, [loading, session, navigate, pathname]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-8">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!session) return null;

  const initial = (session.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="bg-surface">
      <div className="mx-auto max-w-[1200px] px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
          {/* ------------------------------------------------------ Sidebar */}
          <aside className="space-y-4">
            <div className="rounded-xl bg-brand-dark p-5 text-brand-foreground">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-base font-bold">
                  {initial}
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block text-xs text-brand-foreground/70">Signed in as</span>
                  <span className="block truncate text-sm font-semibold">{session.email}</span>
                </span>
              </div>
            </div>

            <nav className="space-y-1 rounded-xl border border-border bg-card p-2 shadow-card">
              {NAV.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-brand/10 text-brand"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}

              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={async () => {
                  await supabase.auth.signOut();
                  void navigate({ to: "/" });
                }}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </nav>
          </aside>

          <div className="min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
