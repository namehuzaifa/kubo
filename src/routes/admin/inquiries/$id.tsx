import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ArrowLeft, Download, Eye, EyeOff, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  addInquiryNote,
  createDocumentUploadUrl,
  deleteDocument,
  getDocumentUrl,
  getInquiry,
  recordDocument,
  setDocumentVisibility,
  updateInquiry,
} from "@/lib/admin.functions";
import {
  DOCUMENT_BUCKET,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  INQUIRY_STATUSES,
  INQUIRY_STATUS_LABELS,
  type DocumentType,
  type InquiryStatus,
} from "@/integrations/supabase/admin-schema";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/inquiries/$id")({
  component: InquiryDetail,
});

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

function InquiryDetail() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<DocumentType>("invoice");
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ["admin", "inquiry", id],
    queryFn: () => getInquiry({ data: { id } }),
  });

  const inquiry = data?.inquiry;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "inquiry", id] });

  const mutateInquiry = useMutation({
    mutationFn: (patch: { status?: InquiryStatus; agreedPrice?: number | null }) =>
      updateInquiry({ data: { id, ...patch } }),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Inquiry updated");
      void refresh();
      void queryClient.invalidateQueries({ queryKey: ["admin", "inquiries"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });

  /**
   * Files go straight from the browser to storage through a one-shot signed
   * URL, then a second call records the metadata. Each file is independent, so
   * one failure does not abort the rest of the selection.
   */
  async function uploadFiles(files: FileList) {
    setUploading(true);
    let uploaded = 0;

    for (const file of Array.from(files)) {
      const signed = await createDocumentUploadUrl({
        data: { inquiryId: id, fileName: file.name },
      });
      if (signed.error || !signed.path || !signed.token) {
        toast.error(`${file.name}: ${signed.error ?? "could not start upload"}`);
        continue;
      }

      const { error: storageError } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file);

      if (storageError) {
        toast.error(`${file.name}: ${storageError.message}`);
        continue;
      }

      const recorded = await recordDocument({
        data: {
          inquiryId: id,
          storagePath: signed.path,
          title: file.name,
          docType,
          fileSize: file.size,
          mimeType: file.type || null,
        },
      });

      if (recorded.error) toast.error(`${file.name}: ${recorded.error}`);
      else uploaded += 1;
    }

    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
    if (uploaded > 0) {
      toast.success(`${uploaded} file${uploaded === 1 ? "" : "s"} uploaded`);
      void refresh();
    }
  }

  async function download(documentId: string) {
    const result = await getDocumentUrl({ data: { documentId } });
    if (result.error || !result.url) {
      toast.error(result.error ?? "Could not create download link");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!inquiry) {
    return <p className="text-sm text-destructive">{data?.error ?? "Inquiry not found."}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/inquiries">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
        <h1 className="font-mono text-xl font-bold tracking-tight">{inquiry.ref_no}</h1>
        <StatusBadge status={inquiry.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* ---------------------------------------------------------- Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="doc-type" className="text-xs">
                    Document type
                  </Label>
                  <Select
                    value={docType}
                    onValueChange={(value) => setDocType(value as DocumentType)}
                  >
                    <SelectTrigger id="doc-type" className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {DOCUMENT_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    if (event.target.files?.length) void uploadFiles(event.target.files);
                  }}
                />
                <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {uploading ? "Uploading…" : "Upload files"}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Uploads are hidden from the customer until you publish them.
              </p>

              <Separator />

              {inquiry.documents.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No documents yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {inquiry.documents.map((doc) => (
                    <li key={doc.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {DOCUMENT_TYPE_LABELS[doc.doc_type]} · {formatBytes(doc.file_size)} ·{" "}
                          {new Date(doc.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>

                      <span
                        className={
                          doc.visible_to_customer
                            ? "inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                            : "inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        }
                      >
                        {doc.visible_to_customer ? (
                          <Eye className="size-3" aria-hidden="true" />
                        ) : (
                          <EyeOff className="size-3" aria-hidden="true" />
                        )}
                        {doc.visible_to_customer ? "Shared" : "Hidden"}
                      </span>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Download"
                          onClick={() => void download(doc.id)}
                        >
                          <Download className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={
                            doc.visible_to_customer ? "Hide from customer" : "Share with customer"
                          }
                          onClick={async () => {
                            const result = await setDocumentVisibility({
                              data: { documentId: doc.id, visible: !doc.visible_to_customer },
                            });
                            if (result.error) toast.error(result.error);
                            else void refresh();
                          }}
                        >
                          {doc.visible_to_customer ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </Button>
                        <ConfirmDialog
                          title={`Delete "${doc.title}"?`}
                          description="The file will be removed from storage and from this inquiry. If it has already been shared, the customer will lose access to it. This cannot be undone."
                          onConfirm={async () => {
                            const result = await deleteDocument({ data: { documentId: doc.id } });
                            if (result.error) {
                              toast.error(result.error);
                              return;
                            }
                            toast.success("Document deleted");
                            void refresh();
                          }}
                          trigger={
                            <Button variant="ghost" size="icon" title="Delete">
                              <Trash2 className="size-4 text-destructive" />
                              <span className="sr-only">Delete {doc.title}</span>
                            </Button>
                          }
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* -------------------------------------------------------------- Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Internal notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="space-y-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!note.trim()) return;
                  const result = await addInquiryNote({
                    data: { inquiryId: id, note: note.trim() },
                  });
                  if (result.error) toast.error(result.error);
                  else {
                    setNote("");
                    void refresh();
                  }
                }}
              >
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Only staff can see these notes."
                  rows={3}
                />
                <Button type="submit" size="sm" disabled={!note.trim()}>
                  Add note
                </Button>
              </form>

              {inquiry.notes.length > 0 ? (
                <ul className="space-y-3">
                  {inquiry.notes.map((entry) => (
                    <li key={entry.id} className="rounded-md border border-border bg-muted/40 p-3">
                      <p className="text-sm whitespace-pre-wrap">{entry.note}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* ------------------------------------------------------------- Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-1.5">
                <Label className="text-xs">Status</Label>
                <Select
                  value={inquiry.status}
                  onValueChange={(value) =>
                    mutateInquiry.mutate({ status: value as InquiryStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INQUIRY_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {INQUIRY_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <form
                className="grid gap-1.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = new FormData(event.currentTarget).get("agreedPrice");
                  const parsed = value === "" || value === null ? null : Number(value);
                  if (parsed !== null && !Number.isFinite(parsed)) return;
                  mutateInquiry.mutate({ agreedPrice: parsed });
                }}
              >
                <Label htmlFor="agreedPrice" className="text-xs">
                  Agreed price ({inquiry.currency ?? "USD"})
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="agreedPrice"
                    name="agreedPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={inquiry.agreed_price ?? ""}
                  />
                  <Button type="submit" variant="secondary">
                    Save
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Field label="Name" value={inquiry.name} />
              <Field label="Email" value={inquiry.email} />
              <Field label="Phone" value={inquiry.phone} />
              <Field label="Country" value={inquiry.country} />
              <Field label="Port" value={inquiry.port} />
              <Field label="Vehicle" value={inquiry.vehicle_text} />
              <Field label="Received" value={new Date(inquiry.created_at).toLocaleString()} />
              {inquiry.message ? (
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground">Message</p>
                  <p className="mt-1 whitespace-pre-wrap">{inquiry.message}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {inquiry.history.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {inquiry.history.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-2">
                      <StatusBadge status={entry.to_status} />
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.changed_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right break-words">{value ?? "—"}</span>
    </div>
  );
}
