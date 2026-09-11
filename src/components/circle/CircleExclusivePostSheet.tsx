import { useRef, useState } from "react";
import { ImageIcon, Video, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  createCircleContent,
  uploadCircleContentMedia,
  type CircleContentVisibility,
} from "@/lib/circle-content";
import type { Circle } from "@/lib/circles";
import { getCircleExclusiveAccess } from "@/lib/circles";

type Props = {
  open: boolean;
  onClose: () => void;
  circle: Circle;
  userId: string;
  onCreated: () => void;
};

/** Simple Exclusive media drop — photo or video only. Access is set on the Exclusive area, not per post. */
export default function CircleExclusivePostSheet({ open, onClose, circle, userId, onCreated }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"image" | "video" | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const access = getCircleExclusiveAccess(circle);
  const visibility: CircleContentVisibility = access === "paid" ? "paid_members" : "circle_members";

  const onPick = (f: File | null) => {
    if (!f) return;
    const isVideo = f.type.startsWith("video/");
    const isImage = f.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast({ title: "Choose a photo or video", variant: "destructive" });
      return;
    }
    setFile(f);
    setMediaKind(isVideo ? "video" : "image");
    setPreview(URL.createObjectURL(f));
  };

  const publish = async () => {
    if (!file || !mediaKind) {
      toast({ title: "Add a photo or video", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const url = await uploadCircleContentMedia(userId, file, mediaKind);
      await createCircleContent({
        circleId: circle.id,
        authorId: userId,
        kind: mediaKind === "video" ? "video" : "post",
        activityType: "exclusive",
        mediaUrls: [url],
        mediaType: mediaKind,
        visibility,
        donationsEnabled: true,
      });
      toast({
        title: "Posted to Exclusive",
        description:
          access === "paid"
            ? "Only paid supporters can see this."
            : "Only Circle members can see this.",
      });
      setFile(null);
      setPreview(null);
      setMediaKind(null);
      onCreated();
      onClose();
    } catch (e) {
      toast({
        title: "Couldn't post",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-background shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-bold">Exclusive post</h2>
            <p className="text-[11px] text-muted-foreground">
              {access === "paid" ? "Paid supporters only" : "Members only"} · set on the Exclusive tab
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-muted p-2" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-border bg-muted/40 py-10"
          >
            {preview && mediaKind === "image" ? (
              <img src={preview} alt="" className="max-h-56 w-full object-cover" />
            ) : preview && mediaKind === "video" ? (
              <video src={preview} className="max-h-56 w-full object-cover" controls playsInline />
            ) : (
              <>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <ImageIcon className="h-7 w-7" />
                  <Video className="h-7 w-7" />
                </div>
                <span className="text-[13px] font-semibold">Upload photo or video</span>
              </>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*,.mp4,.mov,.m4v,.webm"
            className="hidden"
            onChange={(e) => {
              onPick(e.target.files?.[0] ?? null);
              e.currentTarget.value = "";
            }}
          />
        </div>

        <div className="border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={busy}
            onClick={() => void publish()}
            className="flex h-12 w-full items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Posting…" : "Post to Exclusive"}
          </button>
        </div>
      </div>
    </div>
  );
}
