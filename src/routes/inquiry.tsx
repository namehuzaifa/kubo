import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, LogIn } from "lucide-react";

import { PageHero } from "@/components/PageHero";
import { submitInquiry } from "@/lib/inquiries.functions";
import { useAdminSession } from "@/hooks/use-admin-session";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/inquiry")({
  head: () => ({
    meta: [
      { title: "Inquiry & Auction Sheet Translation | Kubo Trading Japan" },
      {
        name: "description",
        content:
          "Send a vehicle inquiry or request a free Japanese auction sheet translation with photos from Kubo Trading Japan.",
      },
      { property: "og:title", content: "Inquiry — Kubo Trading Japan" },
      {
        property: "og:description",
        content: "Request a quotation or a free auction sheet translation.",
      },
    ],
  }),
  component: Inquiry,
});

const FIELDS = [
  { label: "Full name", type: "text", name: "name", required: true },
  { label: "Phone", type: "tel", name: "phone", required: false },
  { label: "Country", type: "text", name: "country", required: false },
  { label: "Destination port", type: "text", name: "port", required: false },
  { label: "Vehicle of interest", type: "text", name: "vehicleText", required: false },
] as const;

const inputClass =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand";

function Inquiry() {
  const { loading, session } = useAdminSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refNo, setRefNo] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "");

    try {
      const result = await submitInquiry({
        data: {
          name: value("name"),
          phone: value("phone"),
          country: value("country"),
          port: value("port"),
          vehicleText: value("vehicleText"),
          message: value("message"),
          website: value("website"),
        },
      });

      if (!result.ok) {
        setError(result.error ?? "Something went wrong. Please try again.");
        return;
      }

      setRefNo(result.refNo);
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-surface">
      <PageHero
        title="Inquiry"
        subtitle="Tell us the model, year and destination port. We reply with a full quotation, usually within one business day."
      />
      <div className="mx-auto max-w-[1400px] px-4 py-12">
        {loading ? (
          <div className="max-w-3xl space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !session ? (
          <SignInPrompt />
        ) : sent ? (
          <div className="max-w-3xl rounded-xl border border-border bg-card p-8 shadow-card">
            <CheckCircle2 className="size-10 text-brand" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-bold text-foreground">
              Thank you — your inquiry is with us.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We usually reply within one business day.
              {refNo ? (
                <>
                  {" "}
                  Your reference is{" "}
                  <span className="font-mono font-semibold text-foreground">{refNo}</span>.
                </>
              ) : null}
            </p>
            <Link
              to="/account/inquiries"
              className="mt-4 inline-block text-sm font-semibold text-brand hover:underline"
            >
              Track it in your account →
            </Link>
          </div>
        ) : (
          <form
            className="grid max-w-3xl gap-4 rounded-xl border border-border bg-card p-6 shadow-card sm:grid-cols-2"
            onSubmit={onSubmit}
          >
            <p className="text-sm text-muted-foreground sm:col-span-2">
              Signed in as <span className="font-medium text-foreground">{session.email}</span>.
              Your quotation and shipping documents will appear in your account.
            </p>

            {FIELDS.map((field) => (
              <label key={field.name} className="block text-sm font-medium text-foreground">
                {field.label}
                {field.required ? <span className="text-brand"> *</span> : null}
                <input
                  type={field.type}
                  name={field.name}
                  required={field.required}
                  className={inputClass}
                />
              </label>
            ))}

            <label className="block text-sm font-medium text-foreground sm:col-span-2">
              Message / auction sheet link
              <textarea name="message" rows={5} className={inputClass} />
            </label>

            {/* Honeypot: hidden from people, irresistible to bots. */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
            />

            {error ? (
              <p className="text-sm text-destructive sm:col-span-2" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
            >
              {busy ? "Sending…" : "Send Inquiry"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function SignInPrompt() {
  return (
    <div className="max-w-3xl rounded-xl border border-border bg-card p-8 shadow-card">
      <LogIn className="size-10 text-brand" aria-hidden="true" />
      <h2 className="mt-4 text-xl font-bold text-foreground">Please sign in to send an inquiry</h2>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        An account lets us keep your quotation, invoice, bill of lading and export certificate in
        one place, so you can download them the moment they are ready. It takes a moment to create.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to="/login"
          search={{ redirect: "/inquiry" }}
          className="rounded-md bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
        >
          Sign in or create an account
        </Link>
        <Link
          to="/contact"
          className="rounded-md border border-border px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          Contact us another way
        </Link>
      </div>
    </div>
  );
}
