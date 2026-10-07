import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Car,
  FileText,
  Handshake,
  Inbox,
  Minus,
  Plus,
  Tags,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

import { getDashboardStats } from "@/lib/admin.functions";
import { INQUIRY_STATUS_LABELS } from "@/integrations/supabase/admin-schema";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const { data, isPending } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => getDashboardStats(),
  });

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (data?.error) return <p className="text-sm text-destructive">{data.error}</p>;

  const stats = data!.stats;
  const pipeline = stats.byStatus.filter((row) => row.count > 0);
  const peak = Math.max(1, ...pipeline.map((row) => row.count));
  const makePeak = Math.max(1, ...stats.topMakes.map((row) => row.count));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.needsAttention > 0
              ? `${stats.needsAttention} inquiry${stats.needsAttention === 1 ? "" : "s"} waiting on a reply.`
              : "Every inquiry has been picked up."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/taxonomy">
              <Tags className="size-4" />
              Browse lists
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/admin/vehicles/$id" params={{ id: "new" }}>
              <Plus className="size-4" />
              Add listing
            </Link>
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------ KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Inquiries"
          value={stats.totalInquiries}
          icon={Inbox}
          footer={<Delta now={stats.newThisWeek} before={stats.previousWeek} />}
        />
        <StatTile
          label="Deals in flight"
          value={stats.openDeals}
          icon={Handshake}
          footer={<span className="text-muted-foreground">Won, not yet delivered</span>}
        />
        <StatTile
          label="Vehicles in stock"
          value={stats.totalVehicles}
          icon={Car}
          footer={
            <span className="text-muted-foreground">
              {stats.availableVehicles.toLocaleString()} available · {stats.featuredVehicles}{" "}
              featured
            </span>
          }
        />
        <StatTile
          label="Customers"
          value={stats.customers}
          icon={Users}
          footer={
            <span className="text-muted-foreground">
              {stats.documents.toLocaleString()} document{stats.documents === 1 ? "" : "s"} shared
            </span>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* -------------------------------------------------------- Pipeline */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Inquiry pipeline</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/inquiries">
                View all
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {pipeline.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No inquiries yet"
                body="Once a customer sends one from the website it will appear here."
              />
            ) : (
              <div className="space-y-1">
                {pipeline.map((row) => (
                  <Link
                    key={row.status}
                    to="/admin/inquiries"
                    search={{ status: row.status }}
                    className="grid grid-cols-[9.5rem_1fr_2.5rem] items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted"
                  >
                    <span className="truncate text-sm font-medium">
                      {INQUIRY_STATUS_LABELS[row.status]}
                    </span>
                    <span className="h-2 rounded-full bg-muted" aria-hidden="true">
                      <span
                        className="block h-2 rounded-full bg-primary transition-[width]"
                        style={{ width: `${Math.round((row.count / peak) * 100)}%` }}
                      />
                    </span>
                    <span className="text-right text-sm font-medium tabular-nums">{row.count}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ----------------------------------------------------- Stock by make */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Stock by make</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/vehicles">
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats.topMakes.length === 0 ? (
              <EmptyState icon={Car} title="No vehicles" body="Add a listing to get started." />
            ) : (
              <div className="space-y-1">
                {stats.topMakes.map((make) => (
                  <Link
                    key={make.name}
                    to="/admin/vehicles"
                    search={{ make: make.name }}
                    className="grid grid-cols-[6rem_1fr_2.5rem] items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted"
                  >
                    <span className="truncate text-sm font-medium">{make.name}</span>
                    <span className="h-2 rounded-full bg-muted" aria-hidden="true">
                      <span
                        className="block h-2 rounded-full bg-primary/70"
                        style={{ width: `${Math.round((make.count / makePeak) * 100)}%` }}
                      />
                    </span>
                    <span className="text-right text-sm tabular-nums text-muted-foreground">
                      {make.count}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------ Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Latest inquiries</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recent.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nothing yet"
              body="New inquiries will show up here as they arrive."
            />
          ) : (
            <ul className="divide-y divide-border">
              {stats.recent.map((inquiry) => (
                <li key={inquiry.id}>
                  <Link
                    to="/admin/inquiries/$id"
                    params={{ id: inquiry.id }}
                    className="-mx-2 flex flex-wrap items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-muted"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {inquiry.ref_no}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {inquiry.name ?? "—"}
                    </span>
                    <StatusBadge status={inquiry.status} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(inquiry.created_at).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  footer,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  footer: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{value.toLocaleString()}</p>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
        </div>
        <div className="mt-3 text-xs">{footer}</div>
      </CardContent>
    </Card>
  );
}

/**
 * Week-on-week movement. The arrow carries the direction, so the colour is a
 * reinforcement rather than the only signal.
 */
function Delta({ now, before }: { now: number; before: number }) {
  const change = now - before;
  const percent = before === 0 ? null : Math.round((change / before) * 100);

  const Icon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  const tone =
    change > 0
      ? "text-emerald-700 dark:text-emerald-400"
      : change < 0
        ? "text-rose-700 dark:text-rose-400"
        : "text-muted-foreground";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-1 font-medium ${tone}`}>
        <Icon className="size-3.5" aria-hidden="true" />
        {change === 0 ? "level" : `${change > 0 ? "+" : ""}${change}`}
        {percent === null ? "" : ` (${percent > 0 ? "+" : ""}${percent}%)`}
      </span>
      <span className="text-muted-foreground">
        {now} this week vs {before} last
      </span>
    </span>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{body}</p>
    </div>
  );
}
