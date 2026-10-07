import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Uploads for public website imagery: browse-list tiles, make logos and listing
 * photography.
 *
 * The browser uploads straight to storage through a one-shot signed URL, so
 * large photos never pass through the server function. The bucket is public, so
 * what comes back is a permanent URL that can go in an <img> tag or be pasted
 * into the URL field by hand.
 */
export const ASSET_BUCKETS = ["site-assets", "vehicle-photos"] as const;
export type AssetBucket = (typeof ASSET_BUCKETS)[number];

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "avif", "svg"];

/** Keeps the storage key predictable and free of anything path-like. */
function storageKey(folder: string, fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const raw = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
  const ext = ALLOWED_EXTENSIONS.includes(raw) ? raw : "";
  const safeFolder =
    folder
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "misc";
  return `${safeFolder}/${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
}

export function publicAssetUrl(supabaseUrl: string, bucket: AssetBucket, path: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${path}`;
}

const uploadSchema = z.object({
  bucket: z.enum(ASSET_BUCKETS),
  folder: z.string().trim().max(80).optional(),
  fileName: z.string().trim().min(1).max(255),
});

export const createAssetUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => uploadSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    const failure = { path: null, token: null, publicUrl: null };
    try {
      await requireStaff();
    } catch (error) {
      return { ...failure, error: error instanceof Error ? error.message : "Request failed" };
    }

    const path = storageKey(data.folder ?? "misc", data.fileName);
    const { data: signed, error } = await adminDb()
      .storage.from(data.bucket)
      .createSignedUploadUrl(path);

    if (error || !signed) {
      return { ...failure, error: error?.message ?? "Could not start upload" };
    }

    return {
      path: signed.path,
      token: signed.token,
      publicUrl: publicAssetUrl(process.env["SUPABASE_URL"] ?? "", data.bucket, signed.path),
      error: null as string | null,
    };
  });

/** Removes an uploaded file. Ignored for images that live on another host. */
export const deleteAsset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ bucket: z.enum(ASSET_BUCKETS), path: z.string().trim().min(1).max(500) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { requireStaff, adminDb } = await import("./auth.server");

    try {
      await requireStaff();
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Request failed",
      };
    }

    const { error } = await adminDb().storage.from(data.bucket).remove([data.path]);
    return error
      ? { ok: false as const, error: error.message }
      : { ok: true as const, error: null as string | null };
  });
