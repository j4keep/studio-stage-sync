import { useRef, useState } from "react";
import { Calendar, Camera, Lock, Sparkles, Users, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  ACTIVITY_META,
  VISIBILITY_META,
  createCircleContent,
  uploadCircleContentMedia,
  type CircleActivityType,
  type CircleContentVisibility,
} from "@/lib/circle-content";

type Props = {
  open: boolean;
  onClose: () => void;
  circleId: string;
  userId: string;
  onCreated: () => void;
};

const ACTIVITY_OPTIONS: Exclude<CircleActivityType, "video">[] = [
  "photo",
  "event",
  "community",
  "update",
  "exclusive",
];

/**
 * Create a Circle post — photos, events, community activities, exclusives.
 * Stays inside My Circle (never published to the main feed).
 */
export default function CircleCreatePostSheet({ open, onClose, circleId, userId, onCreated }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [activity, setActivity] = useState<Exclude<CircleActivityType, "video">>("photo");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<CircleContentVisibility>("circle_members");
  const [donationsEnabled, setDonationsEnabled] = useState(true);
  const [eventAt, setEventAt] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const reset = () => {
    setTitle("");
    setBody("");
    setEventAt("");
    setEventLocation("");
    setPreview(null);
    setFile(null);
    setActivity("photo");
    setVisibility("circle_members");
    setDonationsEnabled(true);
  };

  const onPick = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast({ title: "Choose a photo", description: "Posts use images from your library.", variant: "destructive" });
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    if (activity === "update") setActivity("photo");
  };

  const publish = async () => {
    if (!body.trim() && !file && !title.trim()) {
      toast({ title: "Add something", description: "Write a caption or add a photo.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      let mediaUrls: string[] = [];
      let mediaType: "image" | "none" = "none";
      if (file) {
        mediaUrls = [await uploadCircleContentMedia(userId, file, "image")];
        mediaType = "image";
      }
      await createCircleContent({
        circleId,
        authorId: userId,
        kind: "post",
        activityType: activity,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        mediaUrls,
        mediaType,
        visibility,
        donationsEnabled,
        eventAt: activity === "event" && eventAt ? new Date(eventAt).toISOString() : null,
        eventLocation: activity === "event" ? eventLocation.trim() || null : null,
      });
      toast({ title: "Posted to your Circle", description: "Members can see it on Home. It stays off the main feed." });
      reset();
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
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center">
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[#3A2A1A] bg-[#1A1410] text-[#F6EDE3] shadow-2xl sm:rounded-3xl"
        style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-base font-bold tracking-tight" style={{ fontFamily: '"Syne", sans-serif' }}>
            New Circle post
          </h2>
          <button type="button" onClick={onClose} className="rounded-full bg-white/10 p-2" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#C4A484]">What are you sharing?</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ACTIVITY_OPTIONS.map((id) => {
                const meta = ACTIVITY_META[id];
                const Icon = id === "event" ? Calendar : id === "community" ? Users : id === "exclusive" ? Sparkles : id === "photo" ? Camera : Lock;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActivity(id)}
                    className={`rounded-2xl border px-3 py-2.5 text-left transition ${
                      activity === id
                        ? "border-[#E8A05A] bg-[#E8A05A]/15"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <Icon className="mb-1 h-4 w-4 text-[#E8A05A]" />
                    <p className="text-[12px] font-bold">{meta.label}</p>
                    <p className="text-[10px] text-[#C4A484]">{meta.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-[#E8A05A]/40 bg-[#241C16] py-6"
          >
            {preview ? (
              <img src={preview} alt="" className="max-h-48 w-full object-cover" />
            ) : (
              <>
                <Camera className="h-6 w-6 text-[#E8A05A]" />
                <span className="text-[12px] font-semibold text-[#C4A484]">Add photo from library</span>
              </>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
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
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none placeholder:text-[#8A7460]"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What's happening in your Circle?"
            rows={4}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none placeholder:text-[#8A7460]"
          />

          {activity === "event" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="datetime-local"
                value={eventAt}
                onChange={(e) => setEventAt(e.target.value)}
                className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none"
              />
              <input
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
                placeholder="Location (optional)"
                className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none placeholder:text-[#8A7460]"
              />
            </div>
          )}

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#C4A484]">Who can see this</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(VISIBILITY_META) as CircleContentVisibility[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setVisibility(id)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                    visibility === id ? "bg-[#E8A05A] text-[#1A1410]" : "bg-white/10 text-[#F6EDE3]"
                  }`}
                >
                  {VISIBILITY_META[id].label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
            <div>
              <p className="text-[13px] font-bold">Show donation tab</p>
              <p className="text-[11px] text-[#C4A484]">Members can tip this post when enabled</p>
            </div>
            <input
              type="checkbox"
              checked={donationsEnabled}
              onChange={(e) => setDonationsEnabled(e.target.checked)}
              className="h-5 w-5 accent-[#E8A05A]"
            />
          </label>
        </div>

        <div className="border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={busy}
            onClick={() => void publish()}
            className="flex h-12 w-full items-center justify-center rounded-full bg-[#E8A05A] text-sm font-bold text-[#1A1410] disabled:opacity-50"
          >
            {busy ? "Posting…" : "Post to Circle"}
          </button>
          <p className="mt-2 text-center text-[10px] text-[#8A7460]">Circle-only · not shared to the main feed</p>
        </div>
      </div>
    </div>
  );
}
