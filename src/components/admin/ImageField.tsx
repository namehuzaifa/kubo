import { useRef, useState } from "react";
import { ImageOff, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { createAssetUploadUrl, type AssetBucket } from "@/lib/assets.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * An image slot that accepts either a pasted URL or an uploaded file.
 *
 * Both routes end at the same place — a URL string the caller stores — so an
 * image hosted elsewhere and one uploaded here are interchangeable, and
 * switching from one to the other is just editing the field.
 */
export function ImageField({
  value,
  onCommit,
  bucket,
  folder,
  placeholder = "https://…",
  className,
}: {
  value: string;
  onCommit: (url: string) => void;
  bucket: AssetBucket;
  folder: string;
  placeholder?: string;
  className?: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [broken, setBroken] = useState(false);

  async function upload(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error(`${file.name} is larger than 8 MB.`);
      return;
    }

    setBusy(true);
    const signed = await createAssetUploadUrl({
      data: { bucket, folder, fileName: file.name },
    });

    if (signed.error || !signed.path || !signed.token || !signed.publicUrl) {
      setBusy(false);
      toast.error(signed.error ?? "Could not start upload");
      return;
    }

    const { error } = await supabase.storage
      .from(bucket)
      .uploadToSignedUrl(signed.path, signed.token, file);

    setBusy(false);
    if (fileInput.current) fileInput.current.value = "";

    if (error) {
      toast.error(error.message);
      return;
    }

    setDraft(signed.publicUrl);
    setBroken(false);
    onCommit(signed.publicUrl);
    toast.success("Image uploaded");
  }

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
        {value && !broken ? (
          <img
            src={value}
            alt=""
            className="size-full object-contain"
            loading="lazy"
            onError={() => setBroken(true)}
            onLoad={() => setBroken(false)}
          />
        ) : (
          <ImageOff className="size-4 text-muted-foreground/50" aria-hidden="true" />
        )}
      </div>

      <Input
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setBroken(false);
        }}
        onBlur={() => draft !== value && onCommit(draft)}
        placeholder={placeholder}
        className="min-w-0 flex-1"
      />

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      <Button
        type="button"
        variant="outline"
        size="icon"
        title="Upload an image"
        disabled={busy}
        onClick={() => fileInput.current?.click()}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
      </Button>

      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Clear"
          onClick={() => {
            setDraft("");
            setBroken(false);
            onCommit("");
          }}
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
