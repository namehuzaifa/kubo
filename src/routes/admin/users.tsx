import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MailCheck, MailWarning, Pencil, Search } from "lucide-react";
import { toast } from "sonner";

import { listUsers, updateUserAccount, type AdminUserRow } from "@/lib/admin.functions";
import { useAdminSession } from "@/hooks/use-admin-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UsersSearch = {
  q?: string | undefined;
  page?: number | undefined;
};

export const Route = createFileRoute("/admin/users")({
  validateSearch: (search: Record<string, unknown>): UsersSearch => {
    const page = Number(search["page"]);
    return {
      q: typeof search["q"] === "string" && search["q"] ? search["q"] : undefined,
      page: Number.isFinite(page) && page > 1 ? page : undefined,
    };
  },
  component: Users,
});

const PER_PAGE = 25;

function Users() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { loading, session } = useAdminSession();
  const [term, setTerm] = useState(search.q ?? "");
  const [editing, setEditing] = useState<AdminUserRow | null>(null);

  const { data, isPending } = useQuery({
    queryKey: ["admin", "users", search.q ?? "", search.page ?? 1],
    queryFn: () => listUsers({ data: { q: search.q, page: search.page ?? 1, perPage: PER_PAGE } }),
    placeholderData: keepPreviousData,
    enabled: Boolean(session?.isAdmin),
  });

  if (loading) return <Skeleton className="h-96 w-full" />;

  // Staff can reach the dashboard but not other people's accounts. The server
  // function refuses them too; this is just so they see why.
  if (!session?.isAdmin) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <h1 className="text-lg font-bold">Administrators only</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Managing other people's accounts needs an administrator. Ask one of them if you need a
            change made here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const total = data?.total ?? 0;
  const page = search.page ?? 1;
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <span className="text-sm text-muted-foreground">{total.toLocaleString()} total</span>
      </div>

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
            placeholder="Name or email"
            className="w-64 pl-8"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {data?.error ? <p className="text-sm text-destructive">{data.error}</p> : null}

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="hidden sm:table-cell">Roles</TableHead>
              <TableHead className="hidden md:table-cell">Last sign-in</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : (data?.rows.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No accounts match that search.
                </TableCell>
              </TableRow>
            ) : (
              data?.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.name ?? <span className="text-muted-foreground">—</span>}
                    {row.id === session.userId ? (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      {row.emailConfirmed ? (
                        <MailCheck className="size-4 shrink-0 text-brand" aria-label="Confirmed" />
                      ) : (
                        <MailWarning
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-label="Not confirmed"
                        />
                      )}
                      <span className="truncate">{row.email}</span>
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="flex flex-wrap gap-1">
                      {row.roles.length === 0 ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        row.roles.map((role) => (
                          <span
                            key={role}
                            className="rounded-full border border-border px-2 py-0.5 text-xs capitalize"
                          >
                            {role}
                          </span>
                        ))
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {row.lastSignInAt ? new Date(row.lastSignInAt).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={`Edit ${row.email}`}
                      onClick={() => setEditing(row)}
                    >
                      <Pencil className="size-4" />
                      <span className="sr-only">Edit {row.email}</span>
                    </Button>
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

      <EditUserDialog user={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditUserDialog({ user, onClose }: { user: AdminUserRow | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit account</DialogTitle>
          <DialogDescription>
            The new address works straight away — no confirmation email is sent, because you are
            making the change on their behalf.
          </DialogDescription>
        </DialogHeader>

        {user ? (
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const name = String(form.get("name") ?? "").trim();
              const email = String(form.get("email") ?? "").trim();

              setBusy(true);
              const result = await updateUserAccount({
                data: {
                  userId: user.id,
                  ...(name === (user.name ?? "") ? {} : { name }),
                  ...(email.toLowerCase() === user.email.toLowerCase() ? {} : { email }),
                },
              });
              setBusy(false);

              if (!result.ok) {
                toast.error(result.error ?? "Could not save the account.");
                return;
              }
              toast.success("Account updated");
              await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
              onClose();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Display name</Label>
              <Input id="edit-name" name="name" defaultValue={user.name ?? ""} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" name="email" type="email" defaultValue={user.email} required />
              <p className="text-xs text-muted-foreground">
                This is what they sign in with. Their inquiries and documents stay attached.
              </p>
            </div>

            <DialogFooter className="sm:justify-start">
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
