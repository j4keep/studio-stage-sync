import { useCallback, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Image as ImageIcon, X } from "lucide-react";
import { uploadToR2, generateR2Key, getR2DownloadUrl } from "@/lib/r2-storage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type PublishChoice = { kind: "audio" | "video"; coverUrl?: string | null };

export function usePublishPodcastChoice() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"audio" | "video">("video");
  const [forcedKind, setForcedKind] = useState<"audio" | "video" | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const resolverRef = useRef<((v: PublishChoice | null) => void) | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const reset = () => {
    setKind("video");
    setForcedKind(null);
    setCoverFile(null);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview("");
    setUploading(false);
  };

  const request = useCallback((opts?: { forceKind?: "audio" | "video" }) => {
    reset();
    if (opts?.forceKind) {
      setForcedKind(opts.forceKind);
      setKind(opts.forceKind);
    }
    setOpen(true);
    return new Promise<PublishChoice | null>((resolve) => {
      resolverRef.current = resolve;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = (value: PublishChoice | null) => {
    setOpen(false);
    const r = resolverRef.current;
    resolverRef.current = null;
    setTimeout(() => {
      r?.(value);
      reset();
    }, 0);
  };

  const onPickFile = (file: File | null) => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    if (!file) {
      setCoverFile(null);
      setCoverPreview("");
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const confirm = async () => {
    if (kind === "video" || !coverFile) {
      close({ kind, coverUrl: null });
      return;
    }
    try {
      setUploading(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id || "anon";
      const ext = (coverFile.name.split(".").pop() || "jpg").toLowerCase();
      const key = generateR2Key(uid, "podcast-covers", `${Date.now()}-cover.${ext}`);
      const up = await uploadToR2(coverFile, { fileName: key, mimeType: coverFile.type || "image/jpeg" });
      if (!up.success || !up.data) throw new Error(up.error || "Cover upload failed");
      close({ kind, coverUrl: getR2DownloadUrl(up.data.key) });
    } catch (err) {
      toast({
        title: "Cover upload failed",
        description: err instanceof Error ? err.message : "Try a different image.",
        variant: "destructive",
      });
      setUploading(false);
    }
  };

  const dialog = (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !uploading) close(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish podcast</DialogTitle>
          <DialogDescription>
            Choose where this podcast should go.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={kind} onValueChange={(v) => setKind(v as "audio" | "video")} className="gap-3">
          <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40">
            <RadioGroupItem value="video" id="pk-video" className="mt-1" />
            <div>
              <div className="font-medium">Video — WHEUAT.TV</div>
              <div className="text-xs text-muted-foreground">Publish to the WHEUAT.TV Free tab.</div>
            </div>
          </label>
          <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40">
            <RadioGroupItem value="audio" id="pk-audio" className="mt-1" />
            <div>
              <div className="font-medium">Audio — Radio Podcasts</div>
              <div className="text-xs text-muted-foreground">Publish audio only to the Radio station's Podcasts tab.</div>
            </div>
          </label>
        </RadioGroup>

        {kind === "audio" && (
          <div className="space-y-2">
            <Label className="text-sm">Cover image (optional)</Label>
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                {coverPreview ? (
                  <img src={coverPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                  {coverPreview ? "Replace image" : "Upload cover"}
                </Button>
                {coverPreview && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => onPickFile(null)}>
                    <X className="h-3.5 w-3.5 mr-1" /> Remove
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              If you skip this, we'll use the podcast background as the cover.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => close(null)} disabled={uploading}>Cancel</Button>
          <Button onClick={confirm} disabled={uploading}>
            {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</> : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { request, dialog };
}
