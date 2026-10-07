import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, LogIn } from "lucide-react";

import { submitInquiry } from "@/lib/inquiries.functions";
import { getAccountOverview } from "@/lib/account.functions";
import { useAdminSession } from "@/hooks/use-admin-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Asks about one specific vehicle without leaving the page.
 *
 * The inquiry carries the vehicle's id, so it arrives in the dashboard already
 * attached to the listing rather than as a line of free text someone has to
 * match up by hand. Signing in is required — the customer portal can only show
 * someone their quotation if the inquiry belongs to an account.
 */
export function VehicleInquiryDialog({
  vehicleId,
  stockId,
  title,
  className,
}: {
  vehicleId: string;
  stockId: string;
  title: string;
  className?: string;
}) {
  const { loading, session } = useAdminSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refNo, setRefNo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pre-fills the form from the profile, so a returning customer only has to
  // write the message.
  const { data: account } = useQuery({
    queryKey: ["account", "overview"],
    queryFn: () => getAccountOverview(),
    enabled: Boolean(session) && open,
  });
  const profile = account?.profile;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setRefNo(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className={
            className ??
            "mt-4 inline-flex w-full items-center justify-center rounded-md bg-brand px-4 py-3 text-sm font-bold text-brand-foreground hover:opacity-90"
          }
        >
          Inquire about this vehicle
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{refNo ? "Inquiry sent" : "Inquire about this vehicle"}</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{title}</span>
            <span className="ml-2 font-mono text-xs">{stockId}</span>
          </DialogDescription>
        </DialogHeader>

        {refNo ? (
          <div className="space-y-4 py-2">
            <CheckCircle2 className="size-10 text-brand" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Thank you — we usually reply within one business day. Your reference is{" "}
              <span className="font-mono font-semibold text-foreground">{refNo}</span>.
            </p>
            <DialogFooter className="sm:justify-start">
              <Button asChild>
                <Link to="/account/inquiries">Track it in your account</Link>
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Keep browsing
              </Button>
            </DialogFooter>
          </div>
        ) : loading ? (
          <p className="py-6 text-sm text-muted-foreground">Checking your session…</p>
        ) : !session ? (
          <div className="space-y-4 py-2">
            <LogIn className="size-10 text-brand" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Please sign in first. An account keeps your quotation, invoice and shipping documents
              for this vehicle in one place.
            </p>
            <DialogFooter className="sm:justify-start">
              <Button asChild>
                <Link to="/login" search={{ redirect: `/cars/${stockId}` }}>
                  Sign in or create an account
                </Link>
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              setBusy(true);
              setError(null);

              const result = await submitInquiry({
                data: {
                  name: String(form.get("name") ?? ""),
                  phone: String(form.get("phone") ?? ""),
                  country: String(form.get("country") ?? ""),
                  port: String(form.get("port") ?? ""),
                  vehicleId,
                  vehicleText: `${title} (${stockId})`,
                  message: String(form.get("message") ?? ""),
                  website: "",
                },
              });

              setBusy(false);
              if (!result.ok) {
                setError(result.error ?? "Something went wrong. Please try again.");
                return;
              }
              setRefNo(result.refNo);
            }}
          >
            <Field name="name" label="Full name" defaultValue={profile?.name ?? ""} required />
            <Field name="phone" label="Phone" type="tel" defaultValue={profile?.phone ?? ""} />
            <Field name="country" label="Country" defaultValue={profile?.country ?? ""} />
            <Field name="port" label="Destination port" defaultValue={profile?.port ?? ""} />

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                name="message"
                rows={4}
                placeholder="Anything you would like to know — condition, total cost to your port, shipping schedule."
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive sm:col-span-2" role="alert">
                {error}
              </p>
            ) : null}

            <DialogFooter className="sm:col-span-2 sm:justify-start">
              <Button type="submit" disabled={busy}>
                {busy ? "Sending…" : "Send inquiry"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-brand"> *</span> : null}
      </Label>
      {/* keyed so the field picks up the profile once it loads */}
      <Input
        key={defaultValue}
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
      />
    </div>
  );
}
