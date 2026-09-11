import { useRef, useState } from "react";
import { Video, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  VISIBILITY_META,
  createCircleContent,
  uploadCircleContentMedia,
  type CircleContentVisibility,
} from "@/lib/circle-content";

type Props = {
  open: boolean;
  onClose: () => void;
  circleId: string;
  userId: string;
  onCreated: () => void;
};

/** Simple library video upload for My Circle — never lands on the main feed. */
export default function CircleUploadVideoSheet({ open, onClose, circleId, userId, onCreated }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<CircleContentVisibility>("circle_members");
  const [donationsEnabled, setDonationsEnabled] = useState(true);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const onPick = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      toast({ title: "Choose a video", description: "Pick a clip from your photo library.", variant: "destructive" });
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const publish = async () => {
    if (!file) {
      toast({ title: "Add a video", description: "Upload from your photo library first.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const url = await uploadCircleContentMedia(userId, file, "video");
      await createCircleContent({
        circleId,
        authorId: userId,
        kind: "video",
        activityType: "video",
        title: title.trim() || undefined,
        body: caption.trim() || undefined,
        mediaUrls: [url],
        mediaType: "video",
        visibility,
        donationsEnabled,
      });
      toast({ title: "Video added", description: "It appears on Home and Videos — Circle only." });
      setFile(null);
      setPreview(null);
      setCaption("");
      setTitle("");
      onCreated();
      onClose();
    } catch (e) {
      toast({
        title: "Couldn't upload",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-background text-foreground shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-bold">Upload Circle video</h2>
          <button type="button" onClick={onClose} className="rounded-full bg-muted p-2" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-border bg-muted/40 py-8"
          >
            {preview ? (
              <video src={preview} className="max-h-56 w-full object-cover" controls playsInline />
            ) : (
              <>
                <Video className="h-7 w-7 text-muted-foreground" />
                <span className="text-[13px] font-semibold">Choose from photo library</span>
                <span className="text-[11px] text-muted-foreground">MP4, MOV, and more</span>
              </>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="video/*,.mp4,.mov,.m4v,.webm"
            className="hidden"
            onChange={(e) => {
              onPick(e.target.files?.[0] ?? null);
              e.currentTarget.value = "";
            }}
          />

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none"
          />
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption (optional)"
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none"
          />

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Who can see this</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(VISIBILITY_META) as CircleContentVisibility[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setVisibility(id)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                    visibility === id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {VISIBILITY_META[id].label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3 py-3">
            <div>
              <p className="text-[13px] font-bold">Show donation tab</p>
              <p className="text-[11px] text-muted-foreground">Turn off to hide tips on this video</p>
            </div>
            <input
              type="checkbox"
              checked={donationsEnabled}
              onChange={(e) => setDonationsEnabled(e.target.checked)}
              className="h-5 w-5 accent-primary"
            />
          </label>
        </div>

        <div className="border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={busy}
            onClick={() => void publish()}
            className="flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Uploading…" : "Publish video"}
          </button>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">Circle-only · cannot be shared to the main feed</p>
        </div>
      </div>
    </div>
  );
}
