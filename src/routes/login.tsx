import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { getAdminSession } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type LoginSearch = { redirect?: string | undefined };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search["redirect"] === "string" ? (search["redirect"] as string) : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign in — Kubo Trading Japan" }] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [busy, setBusy] = useState(false);

  /** Staff land in the dashboard, everyone else where they were headed. */
  async function goOnwards() {
    const { session } = await getAdminSession();
    const target = redirect ?? (session?.isStaff ? "/admin" : "/account/inquiries");
    void navigate({ to: target });
  }

  async function signIn(email: string, password: string) {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    await goOnwards();
    setBusy(false);
  }

  async function signUp(email: string, password: string, name: string) {
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/account/inquiries`,
      },
    });
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    // With email confirmation switched on, Supabase returns a user but no
    // session — the account is not usable until the link is clicked.
    if (!data.session) {
      toast.success("Account created. Check your inbox to confirm your email address.");
      return;
    }

    toast.success("Welcome — your account is ready.");
    await goOnwards();
  }

  async function sendMagicLink(email: string) {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/account/inquiries` },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Check your inbox for the sign-in link.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Kubo Trading Japan</CardTitle>
          <CardDescription>
            An account keeps your quotations and shipping documents in one place.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
              <TabsTrigger value="link">Email link</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form
                className="grid gap-4 pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void signIn(String(form.get("email")), String(form.get("password")));
                }}
              >
                <TextField
                  id="signin-email"
                  name="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                />
                <TextField
                  id="signin-password"
                  name="password"
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                />
                <Button type="submit" disabled={busy}>
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form
                className="grid gap-4 pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const password = String(form.get("password"));
                  if (password.length < 8) {
                    toast.error("Use at least 8 characters for your password.");
                    return;
                  }
                  void signUp(String(form.get("email")), password, String(form.get("name")));
                }}
              >
                <TextField
                  id="signup-name"
                  name="name"
                  label="Full name"
                  type="text"
                  autoComplete="name"
                />
                <TextField
                  id="signup-email"
                  name="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                />
                <TextField
                  id="signup-password"
                  name="password"
                  label="Password"
                  type="password"
                  autoComplete="new-password"
                  hint="At least 8 characters."
                />
                <Button type="submit" disabled={busy}>
                  {busy ? "Creating…" : "Create account"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="link">
              <form
                className="grid gap-4 pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void sendMagicLink(String(form.get("email")));
                }}
              >
                <TextField
                  id="link-email"
                  name="email"
                  label="Email"
                  type="email"
                  autoComplete="email"
                />
                <Button type="submit" disabled={busy}>
                  {busy ? "Sending…" : "Email me a sign-in link"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function TextField({
  id,
  name,
  label,
  type,
  autoComplete,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  type: string;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type={type} required autoComplete={autoComplete} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
