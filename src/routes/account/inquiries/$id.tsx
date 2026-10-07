import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";

import { getMyDocumentUrl, getMyInquiry } from "@/lib/inquiries.functions";
import { DOCUMENT_TYPE_LABELS, INQUIRY_STATUS_LABELS } from "@/integrations/supabase/admin-schema";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/account/inquiries/$id")({
  component: MyInquiryDetail,
});

function MyInquiryDetail() {
  const { id } = Route.useParams();

  const { data, isPending } = useQuery({
    queryKey: ["account", "inquiry", id],
    queryFn: () => getMyInquiry({ data: { id } }),
  });

  const inquiry = data?.inquiry;

  async function download(documentId: string) {
    const result = await getMyDocumentUrl({ data: { documentId } });
    if (result.error || !result.url) {
      toast.error(result.error ?? "Could not create download link");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!inquiry) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{data?.error ?? "Inquiry not found."}</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/account/inquiries">Back to my inquiries</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/account/inquiries">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
        <h1 className="font-mono text-xl font-bold tracking-tight">{inquiry.ref_no}</h1>
        <StatusBadge status={inquiry.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {inquiry.documents.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No documents have been shared with you yet. We will add them here as your order
              progresses.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {inquiry.documents.map((doc) => (
                <li key={doc.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {DOCUMENT_TYPE_LABELS[doc.doc_type]} ·{" "}
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void download(doc.id)}>
                    <Download className="size-4" />
                    Download
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Vehicle" value={inquiry.vehicle_text} />
            <Row label="Destination port" value={inquiry.port} />
            <Row label="Country" value={inquiry.country} />
            <Row
              label="Agreed price"
              value={
                inquiry.agreed_price === null
                  ? null
                  : `${inquiry.currency ?? "USD"} ${inquiry.agreed_price.toLocaleString()}`
              }
            />
            <Row label="Sent" value={new Date(inquiry.created_at).toLocaleDateString()} />
            {inquiry.message ? (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground">Message</p>
                <p className="mt-1 whitespace-pre-wrap">{inquiry.message}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {inquiry.timeline.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {inquiry.timeline.map((entry) => (
                  <li
                    key={`${entry.to_status}-${entry.changed_at}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-sm font-medium">
                      {INQUIRY_STATUS_LABELS[entry.to_status]}
                    </span>
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
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right break-words">{value ?? "—"}</span>
    </div>
  );
}
