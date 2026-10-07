import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getAccountOverview, updateProfile, type AccountProfile } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/account/profile")({
  component: Profile,
});

function Profile() {
  const { data, isPending } = useQuery({
    queryKey: ["account", "overview"],
    queryFn: () => getAccountOverview(),
  });

  if (isPending) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          These details are used on your quotations and shipping paperwork.
        </p>
      </div>

      <DetailsForm profile={data!.profile} />
      <PasswordForm />
      <SignOutCard />
    </div>
  );
}

function DetailsForm({ profile }: { profile: AccountProfile | null }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  if (!profile) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          We could not load your details. Please refresh the page.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your details</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setBusy(true);
            const result = await updateProfile({
              data: {
                name: String(form.get("name") ?? ""),
                phone: String(form.get("phone") ?? ""),
                country: String(form.get("country") ?? ""),
                port: String(form.get("port") ?? ""),
              },
            });
            setBusy(false);
            if (result.error) toast.error(result.error);
            else {
              toast.success("Details saved");
              void queryClient.invalidateQueries({ queryKey: ["account", "overview"] });
            }
          }}
        >
          <Field name="name" label="Full name" defaultValue={profile.name ?? ""} />
          <Field name="phone" label="Phone" type="tel" defaultValue={profile.phone ?? ""} />
          <Field name="country" label="Country" defaultValue={profile.country ?? ""} />
          <Field name="port" label="Destination port" defaultValue={profile.port ?? ""} />

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={profile.email} readOnly disabled />
            <p className="text-xs text-muted-foreground">
              This is how you sign in, so it cannot be changed here. Contact us if you need it moved
              to another address.
            </p>
          </div>

          <Button type="submit" disabled={busy} className="justify-self-start sm:col-span-2">
            {busy ? "Saving…" : "Save details"}
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

function SignOutCard() {
  const navigate = useNavigate();

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
        <div>
          <h2 className="text-sm font-bold">Sign out</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            You will need to sign in again to see your documents.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            await supabase.auth.signOut();
            void navigate({ to: "/" });
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} />
    </div>
  );
}
