import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { updateUserAccount } from "@/lib/admin.functions";
import { useAdminSession } from "@/hooks/use-admin-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin/profile")({
  component: AdminProfile,
});

/**
 * The staff member's own account.
 *
 * Deliberately separate from the customer page at /account/profile: that one
 * edits a `customers` row — country, destination port — which a staff member
 * may not even have, and whose fields mean nothing to someone working the
 * dashboard. Everything here lives on the Supabase auth user instead, so it
 * works for any staff account.
 */
function AdminProfile() {
  const { loading, session } = useAdminSession();

  if (loading) return <Skeleton className="h-96 w-full" />;
  // The layout is already redirecting anyone who should not be here.
  if (!session) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your own sign-in details. Changing these affects nobody else.
        </p>
      </div>

      <DetailsForm
        // Remounts once the session carries the saved values, so the fields show
        // them rather than what they were first rendered with.
        key={`${session.name ?? ""}:${session.email ?? ""}`}
        userId={session.userId}
        email={session.email}
        name={session.name ?? ""}
        isAdmin={session.isAdmin}
      />
      <PasswordForm />
    </div>
  );
}

function DetailsForm({
  userId,
  email,
  name,
  isAdmin,
}: {
  userId: string;
  email: string | null;
  name: string;
  isAdmin: boolean;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your details</CardTitle>
        <CardDescription>The name shown beside your account in the dashboard.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const nextName = String(form.get("name") ?? "").trim();
            const nextEmail = String(form.get("email") ?? "").trim();

            setBusy(true);

            // An admin may already edit any account, so changing their own
            // address goes the same way: applied at once, rather than waiting on
            // a confirmation link. Staff cannot, so for them only the name moves.
            const result = isAdmin
              ? await updateUserAccount({
                  data: {
                    userId,
                    ...(nextName === name ? {} : { name: nextName }),
                    ...(nextEmail.toLowerCase() === (email ?? "").toLowerCase()
                      ? {}
                      : { email: nextEmail }),
                  },
                })
              : await supabase.auth
                  .updateUser({ data: { full_name: nextName } })
                  .then(({ error }) => ({ ok: !error, error: error?.message ?? null }));

            // Both name and email are read from the access token's claims, so
            // the session has to be re-issued before the sidebar catches up.
            if (result.ok) await supabase.auth.refreshSession();
            setBusy(false);

            if (!result.ok) toast.error(result.error ?? "Could not save your profile.");
            else toast.success("Profile saved");
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" name="name" defaultValue={name} placeholder="Your name" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={email ?? ""}
              readOnly={!isAdmin}
              disabled={!isAdmin}
              required={isAdmin}
            />
            <p className="text-xs text-muted-foreground">
              {isAdmin
                ? "What you sign in with. The change takes effect immediately."
                : "Your sign-in address. Ask an administrator to change it."}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 sm:col-span-2">
            <ShieldCheck className="size-4 text-brand" aria-hidden="true" />
            <span className="text-sm font-medium">{isAdmin ? "Administrator" : "Staff"}</span>
            <span className="text-xs text-muted-foreground">
              {isAdmin
                ? "Full access, including staff roles and site content."
                : "Can manage listings and inquiries."}
            </span>
          </div>

          <Button type="submit" disabled={busy} className="justify-self-start sm:col-span-2">
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordForm() {
  const [busy, setBusy] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Password</CardTitle>
        <CardDescription>Use at least 8 characters.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            const password = String(data.get("password") ?? "");
            const confirm = String(data.get("confirm") ?? "");

            if (password.length < 8) {
              toast.error("Use at least 8 characters.");
              return;
            }
            if (password !== confirm) {
              toast.error("The two passwords do not match.");
              return;
            }

            setBusy(true);
            const { error } = await supabase.auth.updateUser({ password });
            setBusy(false);

            if (error) toast.error(error.message);
            else {
              toast.success("Password changed");
              form.reset();
            }
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
          <Button type="submit" disabled={busy} className="justify-self-start sm:col-span-2">
            {busy ? "Changing…" : "Change password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
