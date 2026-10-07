import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  ImagePlus,
  Loader2,
  Lock,
  LockOpen,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { createAssetUploadUrl } from "@/lib/assets.functions";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

import {
  addVehicleImage,
  deleteVehicle,
  deleteVehicleImage,
  getAdminVehicle,
  saveVehicle,
  unlockVehicleField,
} from "@/lib/vehicles-admin.functions";
import { listAllTaxonomies } from "@/lib/taxonomy.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/vehicles/$id")({
  component: VehicleEditor,
});

type Draft = Record<string, string | number | boolean | null>;

const NONE = "__none__";
const STATUSES = ["Available", "Reserved", "Sold", "Removed"];

function VehicleEditor() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState<Draft>({});
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ["admin", "vehicle", id],
    queryFn: () => getAdminVehicle({ data: { id } }),
    enabled: !isNew,
  });

  const { data: taxonomies } = useQuery({
    queryKey: ["admin", "taxonomies"],
    queryFn: () => listAllTaxonomies(),
  });

  const vehicle = data?.vehicle as Record<string, unknown> | null | undefined;
  const locked = new Set((vehicle?.["locked_fields"] as string[] | undefined) ?? []);
  const isManual = vehicle?.["is_manual"] === true;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "vehicle", id] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "vehicles"] });
  };

  /**
   * Each photo goes straight from the browser to storage through its own
   * one-shot signed URL, then gets recorded against the listing. Files are
   * handled one at a time so a single failure does not lose the rest.
   */
  async function uploadPhotos(files: FileList) {
    setUploadingPhotos(true);
    let added = 0;

    for (const file of Array.from(files)) {
      const signed = await createAssetUploadUrl({
        data: { bucket: "vehicle-photos", folder: id, fileName: file.name },
      });

      if (signed.error || !signed.path || !signed.token || !signed.publicUrl) {
        toast.error(`${file.name}: ${signed.error ?? "could not start upload"}`);
        continue;
      }

      const { error } = await supabase.storage
        .from("vehicle-photos")
        .uploadToSignedUrl(signed.path, signed.token, file);

      if (error) {
        toast.error(`${file.name}: ${error.message}`);
        continue;
      }

      const recorded = await addVehicleImage({
        data: { vehicleId: id, imageUrl: signed.publicUrl, altText: file.name },
      });
      if (recorded.error) toast.error(`${file.name}: ${recorded.error}`);
      else added += 1;
    }

    setUploadingPhotos(false);
    if (photoInput.current) photoInput.current.value = "";
    if (added > 0) {
      toast.success(`${added} photo${added === 1 ? "" : "s"} uploaded`);
      refresh();
    }
  }

  const value = (field: string): string => {
    if (field in draft) return draft[field] === null ? "" : String(draft[field]);
    const current = vehicle?.[field];
    return current === null || current === undefined ? "" : String(current);
  };

  const flag = (field: string): boolean =>
    field in draft ? Boolean(draft[field]) : vehicle?.[field] === true;

  const set = (field: string, next: string | number | boolean | null) =>
    setDraft((previous) => ({ ...previous, [field]: next }));

  async function onSave() {
    setSaving(true);

    const numeric = new Set([
      "year",
      "registration_year",
      "mileage",
      "engine_size",
      "doors",
      "seats",
      "price",
    ]);

    const fields: Record<string, unknown> = {};
    for (const [field, raw] of Object.entries(draft)) {
      if (typeof raw === "boolean") {
        fields[field] = raw;
      } else if (numeric.has(field)) {
        const text = raw === null ? "" : String(raw).trim();
        fields[field] = text === "" ? null : Number(text);
      } else {
        const text = raw === null ? "" : String(raw).trim();
        // Required text columns must never be blanked out.
        fields[field] =
          text === "" && !["title", "make", "model", "status"].includes(field) ? null : text;
      }
    }

    const result = await saveVehicle({ data: { id: isNew ? undefined : id, fields } });
    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(isNew ? "Listing created" : "Listing saved");
    setDraft({});
    if (isNew && result.id) void navigate({ to: "/admin/vehicles/$id", params: { id: result.id } });
    else refresh();
  }

  if (!isNew && isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isNew && !vehicle) {
    return <p className="text-sm text-destructive">{data?.error ?? "Vehicle not found."}</p>;
  }

  const dirty = Object.keys(draft).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/vehicles">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-xl font-bold tracking-tight">
          {isNew ? "New listing" : (vehicle?.["stock_id"] as string)}
        </h1>
        {isManual ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs">
            <Lock className="size-3.5" />
            Manual listing — the inventory sync skips it entirely
          </span>
        ) : null}
        <div className="ml-auto flex gap-2">
          {!isNew ? (
            <>
              <Button variant="outline" asChild>
                <a
                  href={`/cars/${vehicle?.["stock_id"] as string}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="size-4" />
                  View on site
                </a>
              </Button>

              <ConfirmDialog
                title="Delete this listing?"
                description={
                  <>
                    This listing, its photos, features and pricing will be removed. This cannot be
                    undone.
                    {!isManual ? (
                      <span className="mt-2 block">
                        It came from the inventory feed, so a later sync may bring it back. To take
                        it off the site permanently, set its status to Removed instead.
                      </span>
                    ) : null}
                  </>
                }
                onConfirm={async () => {
                  const result = await deleteVehicle({ data: { id } });
                  if (result.error) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Listing deleted");
                  void navigate({ to: "/admin/vehicles" });
                }}
                trigger={
                  <Button variant="outline">
                    <Trash2 className="size-4 text-destructive" />
                    Delete
                  </Button>
                }
              />
            </>
          ) : null}
          <Button onClick={() => void onSave()} disabled={saving || (!isNew && !dirty)}>
            {saving ? "Saving…" : isNew ? "Create listing" : "Save changes"}
          </Button>
        </div>
      </div>

      {!isNew && locked.size > 0 ? (
        <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Lock className="mr-1 inline size-3.5" />
          {locked.size} field{locked.size === 1 ? " is" : "s are"} protected from the inventory sync
          because {locked.size === 1 ? "it was" : "they were"} edited here. Unlock one to let the
          feed manage it again.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field
                name="title"
                label="Title"
                className="sm:col-span-2"
                {...{ value, set, locked, id, refresh }}
              />

              <TaxonomySelect
                name="make"
                label="Make"
                options={(taxonomies?.makes ?? []).map((item) => item.name)}
                {...{ value, set, locked, id, refresh }}
              />
              <Field name="model" label="Model" {...{ value, set, locked, id, refresh }} />
              <Field name="variant" label="Variant" {...{ value, set, locked, id, refresh }} />
              <TaxonomySelect
                name="body_type"
                label="Body style"
                options={(taxonomies?.body_styles ?? []).map((item) => item.name)}
                {...{ value, set, locked, id, refresh }}
              />
              <TaxonomySelect
                name="category"
                label="Category"
                options={(taxonomies?.categories ?? []).map((item) => item.name)}
                {...{ value, set, locked, id, refresh }}
              />
              <Field
                name="year"
                label="Year"
                type="number"
                {...{ value, set, locked, id, refresh }}
              />
              <Field
                name="mileage"
                label="Mileage (km)"
                type="number"
                {...{ value, set, locked, id, refresh }}
              />
              <Field
                name="engine_size"
                label="Engine (cc)"
                type="number"
                {...{ value, set, locked, id, refresh }}
              />
              <Field name="fuel" label="Fuel" {...{ value, set, locked, id, refresh }} />
              <Field
                name="transmission"
                label="Transmission"
                {...{ value, set, locked, id, refresh }}
              />
              <Field name="steering" label="Steering" {...{ value, set, locked, id, refresh }} />
              <Field
                name="drivetrain"
                label="Drivetrain"
                {...{ value, set, locked, id, refresh }}
              />
              <Field
                name="exterior_color"
                label="Exterior colour"
                {...{ value, set, locked, id, refresh }}
              />
              <Field
                name="doors"
                label="Doors"
                type="number"
                {...{ value, set, locked, id, refresh }}
              />
              <Field
                name="seats"
                label="Seats"
                type="number"
                {...{ value, set, locked, id, refresh }}
              />

              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="description" className="text-xs">
                  Description
                </Label>
                <Textarea
                  id="description"
                  rows={4}
                  value={value("description")}
                  onChange={(event) => set("description", event.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {!isNew ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Photos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-end gap-2">
                  <form
                    className="flex flex-1 items-end gap-2"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!imageUrl.trim()) return;
                      const result = await addVehicleImage({
                        data: { vehicleId: id, imageUrl: imageUrl.trim() },
                      });
                      if (result.error) toast.error(result.error);
                      else {
                        setImageUrl("");
                        refresh();
                      }
                    }}
                  >
                    <div className="grid flex-1 gap-1.5">
                      <Label htmlFor="image-url" className="text-xs">
                        Paste an image URL
                      </Label>
                      <Input
                        id="image-url"
                        value={imageUrl}
                        onChange={(event) => setImageUrl(event.target.value)}
                        placeholder="https://…"
                      />
                    </div>
                    <Button type="submit" variant="secondary" disabled={!imageUrl.trim()}>
                      <ImagePlus className="size-4" />
                      Add
                    </Button>
                  </form>

                  <input
                    ref={photoInput}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      if (event.target.files?.length) void uploadPhotos(event.target.files);
                    }}
                  />
                  <Button onClick={() => photoInput.current?.click()} disabled={uploadingPhotos}>
                    {uploadingPhotos ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    {uploadingPhotos ? "Uploading…" : "Upload photos"}
                  </Button>
                </div>

                {(data?.images.length ?? 0) === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No photos yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {data?.images.map((image) => (
                      <div
                        key={image.id}
                        className="group relative overflow-hidden rounded-md border border-border"
                      >
                        <img
                          src={image.image_url}
                          alt={image.alt_text ?? ""}
                          className="aspect-4/3 w-full object-cover"
                          loading="lazy"
                        />
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100"
                          title="Remove photo"
                          onClick={async () => {
                            const result = await deleteVehicleImage({
                              data: { imageId: image.id },
                            });
                            if (result.error) toast.error(result.error);
                            else refresh();
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Publishing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-1.5">
                <Label className="text-xs">Status</Label>
                <Select
                  value={value("status") || "Available"}
                  onValueChange={(next) => set("status", next)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="is_featured" className="text-sm font-normal">
                  Feature on the home page
                </Label>
                <Switch
                  id="is_featured"
                  checked={flag("is_featured")}
                  onCheckedChange={(checked) => set("is_featured", checked)}
                />
              </div>

              <Field
                name="price"
                label="Price"
                type="number"
                {...{ value, set, locked, id, refresh }}
              />
              <Field name="currency" label="Currency" {...{ value, set, locked, id, refresh }} />
              <Field
                name="inventory_location"
                label="Location"
                {...{ value, set, locked, id, refresh }}
              />
              <Field name="port" label="Port" {...{ value, set, locked, id, refresh }} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

type FieldProps = {
  name: string;
  label: string;
  type?: string;
  className?: string;
  value: (field: string) => string;
  set: (field: string, next: string | number | boolean | null) => void;
  locked: Set<string>;
  id: string;
  refresh: () => void;
};

function LockBadge({
  name,
  locked,
  id,
  refresh,
}: Pick<FieldProps, "name" | "locked" | "id" | "refresh">) {
  if (!locked.has(name)) return null;
  return (
    <button
      type="button"
      title="Locked against the inventory sync — click to unlock"
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      onClick={async () => {
        const result = await unlockVehicleField({ data: { id, field: name } });
        if (result.error) toast.error(result.error);
        else {
          toast.success(`"${name}" will be managed by the sync again`);
          refresh();
        }
      }}
    >
      <LockOpen className="size-3" />
      unlock
    </button>
  );
}

function Field({
  name,
  label,
  type = "text",
  className,
  value,
  set,
  locked,
  id,
  refresh,
}: FieldProps) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={name} className="text-xs">
          {label}
        </Label>
        <LockBadge name={name} locked={locked} id={id} refresh={refresh} />
      </div>
      <Input
        id={name}
        type={type}
        value={value(name)}
        onChange={(event) => set(name, event.target.value)}
      />
    </div>
  );
}

function TaxonomySelect({
  name,
  label,
  options,
  value,
  set,
  locked,
  id,
  refresh,
}: FieldProps & { options: string[] }) {
  const current = value(name);
  // A vehicle may carry a value the browse list no longer offers; keep it
  // selectable rather than silently resetting the field.
  const choices = current && !options.includes(current) ? [current, ...options] : options;

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">{label}</Label>
        <LockBadge name={name} locked={locked} id={id} refresh={refresh} />
      </div>
      <Select
        value={current || NONE}
        onValueChange={(next) => set(name, next === NONE ? "" : next)}
      >
        <SelectTrigger>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>—</SelectItem>
          {choices.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
