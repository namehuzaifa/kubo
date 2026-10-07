import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileText, FolderOpen, Heart, Inbox } from "lucide-react";

import { getAccountOverview } from "@/lib/account.functions";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/account/")({
  component: AccountOverview,
});

function AccountOverview() {
  const { data, isPending } = useQuery({
    queryKey: ["account", "overview"],
    queryFn: () => getAccountOverview(),
  });

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { profile, counts, recent } = data!;
  const greeting = profile?.name?.trim() || profile?.email || "there";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Welcome back, {greeting}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {counts.open > 0
            ? `You have ${counts.open} inquiry${counts.open === 1 ? "" : " requests"} in progress.`
            : "Everything here stays in one place — quotations, invoices and shipping documents."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Inquiries" value={counts.inquiries} icon={Inbox} />
        <Stat label="In progress" value={counts.open} icon={FileText} />
        <Stat label="Documents shared" value={counts.documents} icon={FolderOpen} />
        <Stat label="Saved vehicles" value={counts.saved} icon={Heart} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent inquiries</CardTitle>
          {recent.length > 0 ? (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/account/inquiries">
                View all
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Inbox className="size-5 text-muted-foreground" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium">You have not sent an inquiry yet</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Tell us the model, year and destination port and we will reply with a full
                quotation, usually within one business day.
              </p>
              <Button asChild className="mt-2">
                <Link to="/inquiry">Send an inquiry</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((inquiry) => (
                <li key={inquiry.id}>
                  <Link
                    to="/account/inquiries/$id"
                    params={{ id: inquiry.id }}
                    className="-mx-2 flex flex-wrap items-center gap-3 rounded-md px-2 py-3 transition-colors hover:bg-muted"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {inquiry.ref_no}
                    </span>
                    <span className="ml-auto flex items-center gap-3">
                      <StatusBadge status={inquiry.status} />
                      <span className="text-xs text-muted-foreground">
                        {new Date(inquiry.created_at).toLocaleDateString()}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <ActionCard
          title="Browse stock"
          body="Filter by make, body style or destination market."
          to="/all-stock"
          label="View all stock"
        />
        <ActionCard
          title="Your details"
          body="Keep your phone and destination port up to date so quotations are accurate."
          to="/account/profile"
          label="Edit profile"
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 pt-6">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{value.toLocaleString()}</p>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function ActionCard({
  title,
  body,
  to,
  label,
}: {
  title: string;
  body: string;
  to: "/all-stock" | "/account/profile";
  label: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-sm font-bold">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{body}</p>
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link to={to} search={{} as never}>
            {label}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
