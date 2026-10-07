import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";

import { listMyInquiries } from "@/lib/inquiries.functions";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/account/inquiries/")({
  component: MyInquiries,
});

function MyInquiries() {
  const { data, isPending } = useQuery({
    queryKey: ["account", "inquiries"],
    queryFn: () => listMyInquiries(),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">My inquiries</h1>

      {isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-24 w-full" />
          ))}
        </div>
      ) : (data?.inquiries.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              You have no inquiries yet. Once you send one, it will appear here with any documents
              we share.
            </p>
            <Link
              to="/inquiry"
              className="mt-4 inline-block text-sm font-semibold text-brand hover:underline"
            >
              Send an inquiry
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {data?.inquiries.map((inquiry) => (
            <li key={inquiry.id}>
              <Link to="/account/inquiries/$id" params={{ id: inquiry.id }}>
                <Card className="transition-colors hover:border-brand">
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold">{inquiry.ref_no}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {inquiry.vehicle_text ?? "Vehicle inquiry"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Sent {new Date(inquiry.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      {inquiry.document_count > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          <FileText className="size-4" aria-hidden="true" />
                          {inquiry.document_count}
                        </span>
                      ) : null}
                      <StatusBadge status={inquiry.status} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
