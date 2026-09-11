import { useRef, useState } from "react";
import { Calendar, Camera, ImageIcon, Lock, Sparkles, Users, Video, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  ACTIVITY_META,
  COMMUNITY_SUBTYPE_META,
  EXCLUSIVE_VISIBILITY_OPTIONS,
  createCircleContent,
  uploadCircleContentMedia,
  type CircleActivityType,
  type CircleContentVisibility,
  type CommunitySubtype,
} from "@/lib/circle-content";

type Props = {
  open: boolean;
  onClose: () => void;
  circleId: string;
  userId: string;
  onCreated: () => void;
};

type PostType = Exclude<CircleActivityType, "video">;

const POST_TYPES: PostType[] = ["photo", "event", "community", "update", "exclusive"];

/**
 * Create a Circle post — five typed forms.
 * Exclusive is optional monetization, not the default for every Circle.
 */
export default function CircleCreatePostSheet({ open, onClose, circleId, userId, onCreated }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [postType, setPostType] = useState<PostType>("photo");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [donationsEnabled, setDonationsEnabled] = useState(true);
  const [exclusiveVisibility, setExclusiveVisibility] = useState<CircleContentVisibility>("circle_members");
  const [isPinned, setIsPinned] = useState(false);
  const [communitySubtype, setCommunitySubtype] = useState<CommunitySubtype>("question");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [eventDate, setEventDate] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventOnlineUrl, setEventOnlineUrl] = useState("");
  const [eventCapacity, setEventCapacity] = useState("");
  const [eventTicket, setEventTicket] = useState("");
  const [eventReminders, setEventReminders] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mediaKind, setMediaKind] = useState<"image" | "video" | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const reset = () => {
    setPostType("photo");
    setTitle("");
    setBody("");
    setTags("");
    setDonationsEnabled(true);
    setExclusiveVisibility("circle_members");
    setIsPinned(false);
    setCommunitySubtype("question");
    setPollOptions(["", ""]);
    setEventDate("");
    setEventStart("");
    setEventEnd("");
    setEventLocation("");
    setEventOnlineUrl("");
    setEventCapacity("");
    setEventTicket("");
    setEventReminders(true);
    setPreview(null);
    setFile(null);
    setMediaKind(null);
  };

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

  const toIso = (date: string, time: string) => {
    if (!date || !time) return null;
    const d = new Date(`${date}T${time}`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  const publish = async () => {
    if (postType === "event" && (!title.trim() || !eventDate || !eventStart)) {
      toast({ title: "Event needs a name, date, and start time", variant: "destructive" });
      return;
    }
    if (postType === "community" && communitySubtype === "poll") {
      const opts = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) {
        toast({ title: "Add at least two poll options", variant: "destructive" });
        return;
      }
    }
    if (postType === "update" && !body.trim() && !file) {
      toast({ title: "Write an update or add an image", variant: "destructive" });
      return;
    }
    if ((postType === "photo" || postType === "exclusive") && !body.trim() && !file && !title.trim()) {
      toast({ title: "Add a caption or media", variant: "destructive" });
      return;
    }
    if (postType === "community" && !body.trim() && !title.trim()) {
      toast({ title: "Add a title or description", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      let mediaUrls: string[] = [];
      let mediaType: "image" | "video" | "none" = "none";
      let kind: "post" | "video" = "post";

      if (file && mediaKind) {
        mediaUrls = [await uploadCircleContentMedia(userId, file, mediaKind)];
        mediaType = mediaKind;
        if (mediaKind === "video" && postType === "photo") kind = "video";
      }

      const visibility: CircleContentVisibility =
        postType === "exclusive" ? exclusiveVisibility : "circle_members";

      const tagList = tags
        .split(/[#,|\s]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      await createCircleContent({
        circleId,
        authorId: userId,
        kind: postType === "photo" && mediaKind === "video" ? "video" : kind,
        activityType: postType === "photo" && mediaKind === "video" ? "video" : postType,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        mediaUrls,
        mediaType,
        visibility,
        donationsEnabled,
        tags: tagList,
        eventAt: postType === "event" ? toIso(eventDate, eventStart) : null,
        eventEndAt: postType === "event" ? toIso(eventDate, eventEnd || eventStart) : null,
        eventLocation: postType === "event" ? eventLocation.trim() || null : null,
        eventOnlineUrl: postType === "event" ? eventOnlineUrl.trim() || null : null,
        eventCapacity: postType === "event" && eventCapacity ? Number(eventCapacity) || null : null,
        eventTicketCents:
          postType === "event" && eventTicket.trim()
            ? Math.round(Number(eventTicket) * 100) || null
            : null,
        eventReminders: postType === "event" ? eventReminders : false,
        communitySubtype: postType === "community" ? communitySubtype : null,
        pollOptions:
          postType === "community" && communitySubtype === "poll"
            ? pollOptions.map((o) => o.trim()).filter(Boolean)
            : [],
        isPinned: postType === "update" ? isPinned : false,
      });

      toast({
        title: "Posted to your Circle",
        description:
          postType === "exclusive"
            ? "Visible to qualifying members only · not on the main feed"
            : "Shows on Home · Circle only",
      });
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

  const IconFor = (id: PostType) =>
    id === "event" ? Calendar : id === "community" ? Users : id === "exclusive" ? Sparkles : id === "photo" ? Camera : Lock;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-background text-foreground shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-bold">New Circle post</h2>
          <button type="button" onClick={onClose} className="rounded-full bg-muted p-2" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Post type</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {POST_TYPES.map((id) => {
                const meta = ACTIVITY_META[id];
                const Icon = IconFor(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPostType(id)}
                    className={`rounded-2xl border px-3 py-2.5 text-left transition ${
                      postType === id ? "border-primary bg-primary/10" : "border-border bg-card"
                    }`}
                  >
                    <Icon className="mb-1 h-4 w-4 text-primary" />
                    <p className="text-[12px] font-bold">{meta.label}</p>
                    <p className="text-[10px] text-muted-foreground">{meta.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Shared media picker — photo/video for most types; optional on update */}
          {(postType === "photo" || postType === "exclusive" || postType === "event" || postType === "update" || postType === "community") && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-border bg-muted/40 py-6"
            >
              {preview && mediaKind === "image" ? (
                <img src={preview} alt="" className="max-h-48 w-full object-cover" />
              ) : preview && mediaKind === "video" ? (
                <video src={preview} className="max-h-48 w-full object-cover" controls playsInline />
              ) : (
                <>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <ImageIcon className="h-6 w-6" />
                    <Video className="h-6 w-6" />
                  </div>
                  <span className="text-[12px] font-semibold text-muted-foreground">
                    {postType === "event" ? "Cover image or video (optional)" : postType === "update" ? "Optional image" : "Add photo or video from library"}
                  </span>
                </>
              )}
            </button>
          )}
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

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              postType === "event"
                ? "Event name"
                : postType === "update"
                  ? "Headline (optional)"
                  : "Title (optional)"
            }
            className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              postType === "event"
                ? "Description"
                : postType === "update"
                  ? "Announcement for the Circle…"
                  : postType === "community"
                    ? "Describe the activity or ask your question…"
                    : "Caption / details"
            }
            rows={postType === "update" ? 3 : 4}
            className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none"
          />

          {(postType === "photo" || postType === "exclusive") && (
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tags (optional) — music, drop, tip"
              className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none"
            />
          )}

          {postType === "event" && (
            <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Event details</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-2 text-sm" />
                <input type="time" value={eventStart} onChange={(e) => setEventStart(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-2 text-sm" title="Start" />
                <input type="time" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-2 text-sm" title="End" />
              </div>
              <input
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
                placeholder="Location (optional)"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
              <input
                value={eventOnlineUrl}
                onChange={(e) => setEventOnlineUrl(e.target.value)}
                placeholder="Online link (optional)"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={eventCapacity}
                  onChange={(e) => setEventCapacity(e.target.value)}
                  placeholder="Capacity (optional)"
                  inputMode="numeric"
                  className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                />
                <input
                  value={eventTicket}
                  onChange={(e) => setEventTicket(e.target.value)}
                  placeholder="Ticket $ (optional)"
                  inputMode="decimal"
                  className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                />
              </div>
              <label className="flex items-center justify-between gap-3 pt-1">
                <span className="text-[12px] font-semibold">Send reminders</span>
                <input type="checkbox" checked={eventReminders} onChange={(e) => setEventReminders(e.target.checked)} className="h-5 w-5 accent-primary" />
              </label>
              <p className="text-[10px] text-muted-foreground">Members get Going / Interested / Can&apos;t go after you publish.</p>
            </div>
          )}

          {postType === "community" && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Community subtype</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(COMMUNITY_SUBTYPE_META) as CommunitySubtype[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCommunitySubtype(id)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                      communitySubtype === id ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {COMMUNITY_SUBTYPE_META[id].label}
                  </button>
                ))}
              </div>
              {communitySubtype === "poll" && (
                <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
                  {pollOptions.map((opt, i) => (
                    <input
                      key={i}
                      value={opt}
                      onChange={(e) => {
                        const next = [...pollOptions];
                        next[i] = e.target.value;
                        setPollOptions(next);
                      }}
                      placeholder={`Option ${i + 1}`}
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    />
                  ))}
                  {pollOptions.length < 6 && (
                    <button
                      type="button"
                      onClick={() => setPollOptions((o) => [...o, ""])}
                      className="text-[11px] font-bold text-primary"
                    >
                      + Add option
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {postType === "update" && (
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3 py-3">
              <div>
                <p className="text-[13px] font-bold">Pin this update</p>
                <p className="text-[11px] text-muted-foreground">Keep important announcements at the top of Home</p>
              </div>
              <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} className="h-5 w-5 accent-primary" />
            </label>
          )}

          {postType === "exclusive" && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Exclusive visibility
              </p>
              <div className="space-y-2">
                {EXCLUSIVE_VISIBILITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setExclusiveVisibility(opt.id)}
                    className={`flex w-full flex-col rounded-2xl border px-3 py-2.5 text-left ${
                      exclusiveVisibility === opt.id ? "border-primary bg-primary/10" : "border-border bg-card"
                    }`}
                  >
                    <span className="text-[13px] font-bold">{opt.label}</span>
                    <span className="text-[11px] text-muted-foreground">{opt.hint}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Circle access (Public / Private / Paid) is set separately in Settings. Free Circles can still post paid-subscriber Exclusive posts.
              </p>
            </div>
          )}

          <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3 py-3">
            <div>
              <p className="text-[13px] font-bold">Show donation tab</p>
              <p className="text-[11px] text-muted-foreground">Optional tips on this post</p>
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
            {busy ? "Posting…" : "Post to Circle"}
          </button>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">Circle-only · not shared to the main feed</p>
        </div>
      </div>
    </div>
  );
}
