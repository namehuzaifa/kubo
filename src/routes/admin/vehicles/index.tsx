import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Car, ExternalLink, Lock, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  deleteVehicle,
  getVehicleFilterOptions,
  listAdminVehicles,
} from "@/lib/vehicles-admin.functions";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
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

type VehiclesSearch = {
  q?: string | undefined;
  make?: string | undefined;
  bodyType?: string | undefined;
  status?: string | undefined;
  page?: number | undefined;
};

const ALL = "__all__";

export const Route = createFileRoute("/admin/vehicles/")({
  validateSearch: (search: Record<string, unknown>): VehiclesSearch => {
    const str = (key: string) => {
      const value = search[key];
      return typeof value === "string" && value.trim() !== "" ? value : undefined;
    };
    const page = Number(search["page"]);
    return {
      q: str("q"),
      make: str("make"),
      bodyType: str("bodyType"),
      status: str("status"),
      page: Number.isFinite(page) && page > 1 ? page : undefined,
    };
  },
  component: VehiclesList,
});

function money(amount: number | null, currency: string | null): string {
  if (amount === null) return "—";
  return `${currency ?? "USD"} ${amount.toLocaleString()}`;
}

function VehiclesList() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [term, setTerm] = useState(search.q ?? "");

  const { data, isPending } = useQuery({
    queryKey: ["admin", "vehicles", search],
    queryFn: () =>
      listAdminVehicles({
        data: {
          q: search.q,
          make: search.make,
          bodyType: search.bodyType,
          status: search.status,
          page: search.page ?? 1,
          perPage: 25,
        },
      }),
    placeholderData: keepPreviousData,
  });

  const { data: options } = useQuery({
    queryKey: ["admin", "vehicle-filter-options"],
    queryFn: () => getVehicleFilterOptions(),
  });

  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteVehicle({ data: { id } });
      if (result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      toast.success("Listing deleted");
      void queryClient.invalidateQueries({ queryKey: ["admin", "vehicles"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const perPage = data?.perPage ?? 25;
  const page = data?.page ?? 1;
  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / perPage));

  const filter = (key: keyof VehiclesSearch) => (value: string) =>
    void navigate({
      search: (prev) => ({ ...prev, [key]: value === ALL ? undefined : value, page: undefined }),
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Listings</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total.toLocaleString()} vehicles</p>
        </div>
        <Button asChild>
          <Link to="/admin/vehicles/$id" params={{ id: "new" }}>
            <Plus className="size-4" />
            Add listing
          </Link>
        </Button>
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
              placeholder="Stock ID, title, make, model"
              className="w-64 pl-8"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        <FilterSelect
          value={search.make}
          onChange={filter("make")}
          options={options?.makes ?? []}
          placeholder="All makes"
        />
        <FilterSelect
          value={search.bodyType}
          onChange={filter("bodyType")}
          options={options?.bodyTypes ?? []}
          placeholder="All body styles"
        />
        <FilterSelect
          value={search.status}
          onChange={filter("status")}
          options={options?.statuses ?? []}
          placeholder="All statuses"
        />
      </div>

      {data?.error ? <p className="text-sm text-destructive">{data.error}</p> : null}

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16" />
              <TableHead className="hidden w-32 sm:table-cell">Stock ID</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead className="hidden w-28 lg:table-cell">Body</TableHead>
              <TableHead className="w-32">Price</TableHead>
              <TableHead className="hidden w-28 md:table-cell">Status</TableHead>
              <TableHead className="w-20">Flags</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              [0, 1, 2, 3, 4].map((key) => (
                <TableRow key={key}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-10 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : (data?.vehicles.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  No vehicles match this filter.
                </TableCell>
              </TableRow>
            ) : (
              data?.vehicles.map((vehicle) => (
                <TableRow key={vehicle.id}>
                  <TableCell>
                    <Thumbnail url={vehicle.thumbnail_url} alt={vehicle.title} />
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs sm:table-cell">
                    <Link
                      to="/admin/vehicles/$id"
                      params={{ id: vehicle.id }}
                      className="hover:underline"
                    >
                      {vehicle.stock_id}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link to="/admin/vehicles/$id" params={{ id: vehicle.id }} className="block">
                      <span className="font-medium">{vehicle.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" · ")}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{vehicle.body_type ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">
                    {money(vehicle.price, vehicle.currency)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{vehicle.status}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      {vehicle.is_featured ? (
                        <Star
                          className="size-4 fill-amber-400 text-amber-500"
                          aria-label="Featured"
                        />
                      ) : null}
                      {vehicle.is_manual || vehicle.locked_fields.length > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs"
                          title={
                            vehicle.is_manual
                              ? "Created by hand — the inventory sync never touches this listing"
                              : `${vehicle.locked_fields.length} field(s) protected from the inventory sync`
                          }
                        >
                          <Lock className="size-3.5" />
                          {vehicle.is_manual ? "manual" : vehicle.locked_fields.length}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" title="View on the website" asChild>
                        <a
                          href={`/cars/${vehicle.stock_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="size-4" />
                          <span className="sr-only">View {vehicle.title} on the website</span>
                        </a>
                      </Button>

                      <Button variant="ghost" size="icon" title="Edit" asChild>
                        <Link to="/admin/vehicles/$id" params={{ id: vehicle.id }}>
                          <Pencil className="size-4" />
                          <span className="sr-only">Edit {vehicle.title}</span>
                        </Link>
                      </Button>

                      <ConfirmDialog
                        title="Delete this listing?"
                        description={
                          <>
                            <span className="font-medium text-foreground">{vehicle.title}</span> (
                            {vehicle.stock_id}) will be removed, along with its photos, features and
                            pricing. This cannot be undone.
                            {!vehicle.is_manual ? (
                              <span className="mt-2 block">
                                This listing comes from the inventory feed, so a later sync may
                                bring it back. To take it off the site permanently, set its status
                                to Removed instead.
                              </span>
                            ) : null}
                          </>
                        }
                        onConfirm={() => remove.mutateAsync(vehicle.id)}
                        trigger={
                          <Button variant="ghost" size="icon" title="Delete">
                            <Trash2 className="size-4 text-destructive" />
                            <span className="sr-only">Delete {vehicle.title}</span>
                          </Button>
                        }
                      />
                    </div>
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

/**
 * The picture the public site shows for this vehicle: its own photography if it
 * has any, otherwise the stock tile for its body style.
 */
function Thumbnail({ url, alt }: { url: string | null; alt: string }) {
  const [broken, setBroken] = useState(false);

  if (!url || broken) {
    return (
      <span className="flex size-11 items-center justify-center rounded-md border border-border bg-muted">
        <Car className="size-4 text-muted-foreground/50" aria-hidden="true" />
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
      className="size-11 rounded-md border border-border object-cover"
    />
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string | undefined;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={onChange}>
      <SelectTrigger className="w-44">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
