import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";

import { listInquiries } from "@/lib/admin.functions";
import {
  INQUIRY_STATUSES,
  INQUIRY_STATUS_LABELS,
  type InquiryStatus,
} from "@/integrations/supabase/admin-schema";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type InquiriesSearch = {
  status?: InquiryStatus | undefined;
  q?: string | undefined;
  page?: number | undefined;
};

const ALL = "__all__";

export const Route = createFileRoute("/admin/inquiries/")({
  validateSearch: (search: Record<string, unknown>): InquiriesSearch => {
    const status = search["status"];
    const q = search["q"];
    const page = Number(search["page"]);
    return {
      status: INQUIRY_STATUSES.includes(status as InquiryStatus)
        ? (status as InquiryStatus)
        : undefined,
      q: typeof q === "string" && q.trim() !== "" ? q : undefined,
      page: Number.isFinite(page) && page > 1 ? page : undefined,
    };
  },
  component: InquiriesList,
});

function InquiriesList() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [term, setTerm] = useState(search.q ?? "");

  const { data, isPending } = useQuery({
    queryKey: ["admin", "inquiries", search],
    queryFn: () =>
      listInquiries({
        data: { status: search.status, q: search.q, page: search.page ?? 1, perPage: 25 },
      }),
    placeholderData: keepPreviousData,
  });

  const perPage = data?.perPage ?? 25;
  const page = data?.page ?? 1;
  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Inquiries</h1>
        <span className="text-sm text-muted-foreground">{total.toLocaleString()} total</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void navigate({
              search: (prev) => ({ ...prev, q: term.trim() || undefined, page: undefined }),
            });
          }}
        >
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Ref, name, email, vehicle"
              className="w-64 pl-8"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <Select
          value={search.status ?? ALL}
          onValueChange={(value) =>
            void navigate({
              search: (prev) => ({
                ...prev,
                status: value === ALL ? undefined : (value as InquiryStatus),
                page: undefined,
              }),
            })
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {INQUIRY_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {INQUIRY_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {data?.error ? <p className="text-sm text-destructive">{data.error}</p> : null}

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Ref</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="hidden lg:table-cell">Vehicle</TableHead>
              <TableHead className="hidden sm:table-cell">Country</TableHead>
              <TableHead className="w-40">Status</TableHead>
              <TableHead className="hidden w-32 md:table-cell">Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              [0, 1, 2, 3, 4].map((key) => (
                <TableRow key={key}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : (data?.inquiries.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No inquiries match this filter.
                </TableCell>
              </TableRow>
            ) : (
              data?.inquiries.map((row) => (
                <TableRow key={row.id} className="cursor-pointer">
                  <TableCell className="font-mono text-xs">
                    <Link
                      to="/admin/inquiries/$id"
                      params={{ id: row.id }}
                      className="hover:underline"
                    >
                      {row.ref_no}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link to="/admin/inquiries/$id" params={{ id: row.id }} className="block">
                      <span className="font-medium">{row.name ?? "—"}</span>
                      <span className="block text-xs text-muted-foreground">{row.email}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden max-w-xs truncate lg:table-cell">
                    {row.vehicle_text ?? "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{row.country ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {new Date(row.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {lastPage > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => void navigate({ search: (prev) => ({ ...prev, page: page - 1 }) })}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {lastPage}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => void navigate({ search: (prev) => ({ ...prev, page: page + 1 }) })}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
