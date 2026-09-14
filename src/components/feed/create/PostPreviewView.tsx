import { useEffect, useRef, useState } from "react";
import { applyFeedVideoAudio, bindFeedMediaSession } from "@/lib/feed-video-playback";
import { syncMusicWithVideo, getAddedSoundVideoSyncOptions, MIXED_VOCAL_VIDEO_VOLUME } from "@/lib/post-music-preview";
import type { PostEditorMeta } from "@/lib/post-editor";
import { Hash, AtSign, Lightbulb, Wand2, ImageIcon, Trash2, Type } from "lucide-react";
import { toast } from "sonner";
import YajAiGeneratorIcon from "@/components/YajAiGeneratorIcon";
import { yajRewritePostDescription, yajRewritePostTitle } from "@/lib/ask-yaj";

interface Props {
  mediaType: "image" | "video";
  previewUrl: string | null;
  title: string;
  description: string;
  onTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onBack: () => void;
  onPost: () => void;
  onEditMedia?: () => void;
  onDelete?: () => void;
  posting?: boolean;
  deleting?: boolean;
  isEditing?: boolean;
  musicPreviewUrl?: string | null;
  music?: PostEditorMeta["music"];
  muteOriginal?: boolean;
  originalVolume?: number;
}

export default function PostPreviewView({
  mediaType,
  previewUrl,
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  onBack,
  onPost,
  onEditMedia,
  onDelete,
  posting = false,
  deleting = false,
  isEditing = false,
  musicPreviewUrl,
  music,
  muteOriginal = false,
  originalVolume,
}: Props) {
  const [rewriting, setRewriting] = useState<"title" | "description" | null>(null);
  const [titleError, setTitleError] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const coverVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = coverVideoRef.current;
    const musicUrl = musicPreviewUrl || music?.audioUrl;
    if (!video || mediaType !== "video" || !musicUrl) return;

    const soundSync = getAddedSoundVideoSyncOptions(true, { muteOriginal, music });

    return syncMusicWithVideo(video, musicUrl, {
      trimStart: music?.trimStart,
      trimEnd: music?.trimEnd,
      sourceDurationSec: music?.durationSec,
      volume: soundSync.volume,
      muteOriginal: soundSync.muteOriginal,
      originalVolume: originalVolume ?? MIXED_VOCAL_VIDEO_VOLUME,
      mediaSessionMeta: { title: title || "Preview" },
    });
  }, [
    mediaType,
    musicPreviewUrl,
    music?.audioUrl,
    music?.trimStart,
    music?.trimEnd,
    music?.durationSec,
    music?.volume,
    muteOriginal,
    originalVolume,
    previewUrl,
    title,
  ]);

  const hasAddedSound = !!(musicPreviewUrl || music?.audioUrl);

  const applyCoverVideoAudio = (el: HTMLVideoElement) => {
    if (hasAddedSound) return;
    applyFeedVideoAudio(el, { muted: muteOriginal });
    if (!muteOriginal) bindFeedMediaSession(el, { title: title || "Preview" });
  };

  const rewriteTitle = async () => {
    if (rewriting) return;
    setRewriting("title");
    try {
      const next = await yajRewritePostTitle(title, description);
      if (next) onTitleChange(next);
      else toast.error("YAJ couldn't rewrite the title. Try again.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "YAJ is unavailable right now");
    } finally {
      setRewriting(null);
    }
  };

  const rewriteDescription = async () => {
    if (rewriting) return;
    setRewriting("description");
    try {
      const next = await yajRewritePostDescription(description, title);
      if (next) onDescriptionChange(next);
      else toast.error("YAJ couldn't rewrite the description. Try again.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "YAJ is unavailable right now");
    } finally {
      setRewriting(null);
    }
  };

  const insertToken = (token: string) => {
    const el = descRef.current;
    const start = el?.selectionStart ?? description.length;
    const end = el?.selectionEnd ?? description.length;
    const needsSpace = start > 0 && description[start - 1] !== " ";
    const inserted = `${needsSpace ? " " : ""}${token}`;
    const next = description.slice(0, start) + inserted + description.slice(end);
    onDescriptionChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + inserted.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const showTips = () => {
    toast("Post tips", {
      description: "Lead with a clear title, keep the first sentence strong, and use only relevant hashtags or mentions.",
    });
  };

  const busy = posting || deleting || !!rewriting;
  const saveLabel = posting
    ? isEditing
      ? "Saving…"
      : "Posting…"
    : isEditing
      ? "Update"
      : "Post";

  const tryPost = () => {
    if (!title.trim()) {
      setTitleError(true);
      toast.error("Add a title before posting");
      return;
    }
    setTitleError(false);
    onPost();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-zinc-950 text-white"
      style={{ height: "100dvh", maxHeight: "100dvh" }}
    >
      <header
        className="shrink-0 border-b border-white/10 bg-zinc-950/95 px-3 backdrop-blur-xl"
        style={{ paddingTop: "max(env(safe-area-inset-top), 0.55rem)", paddingBottom: "0.65rem" }}
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={busy}
            className="min-w-[4.7rem] rounded-full border border-white/15 bg-white/8 px-4 py-2.5 text-[13px] font-bold text-white transition active:scale-95 disabled:opacity-40"
          >
            Back
          </button>
          <div className="min-w-0 text-center">
            <p className="truncate text-[15px] font-black tracking-tight">{isEditing ? "Edit post" : "New post"}</p>
            <p className="mt-0.5 text-[9.5px] font-medium text-white/40">Review before publishing</p>
          </div>
          <button
            type="button"
            onClick={tryPost}
            disabled={busy}
            className="min-w-[4.7rem] rounded-full bg-primary px-4 py-2.5 text-[13px] font-black text-primary-foreground shadow-lg transition active:scale-95 disabled:opacity-40"
          >
            {saveLabel}
          </button>
        </div>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y px-4 py-5"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <section className="rounded-[22px] border border-white/10 bg-white/[0.035] p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onEditMedia}
              disabled={!onEditMedia || busy}
              className="relative flex h-[92px] w-[92px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-zinc-800 shadow-md disabled:opacity-60"
              aria-label={previewUrl ? "Edit cover media" : "Text post"}
            >
              {previewUrl ? (
                mediaType === "video" ? (
                  <video
                    ref={coverVideoRef}
                    src={previewUrl}
                    className="h-full w-full object-cover pointer-events-none"
                    playsInline
                    loop
                    muted={muteOriginal}
                    onLoadedMetadata={(e) => applyCoverVideoAudio(e.currentTarget)}
                    onPlay={(e) => applyCoverVideoAudio(e.currentTarget)}
                  />
                ) : (
                  <img src={previewUrl} alt="" className="h-full w-full object-cover pointer-events-none" />
                )
              ) : (
                <div className="flex flex-col items-center gap-1 px-1 text-center">
                  <Type className="h-7 w-7 text-white/45" strokeWidth={2} />
                  <span className="text-[9px] font-semibold leading-tight text-white/40">Text only</span>
                </div>
              )}
              <span className="absolute left-1.5 top-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[9px] font-bold">
                {previewUrl ? "Cover" : "Text"}
              </span>
              {onEditMedia && previewUrl && (
                <span className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/65">
                  <ImageIcon className="h-3.5 w-3.5 text-white" />
                </span>
              )}
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-white">{previewUrl ? "Post media" : "Text post"}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                {previewUrl ? "Make sure your cover looks right before publishing." : "Your title and message will become the post."}
              </p>
              {onEditMedia && previewUrl && (
                <button
                  type="button"
                  onClick={onEditMedia}
                  disabled={busy}
                  className="mt-3 rounded-full bg-primary/15 px-3 py-1.5 text-[11px] font-bold text-primary transition active:scale-95 disabled:opacity-40"
                >
                  Edit stickers &amp; text
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="yaj-post-title" className="text-[12px] font-bold text-white/70">Title</label>
            <span className="text-[10px] font-medium text-white/30">{title.length}/120</span>
          </div>
          <input
            id="yaj-post-title"
            value={title}
            onChange={(e) => {
              setTitleError(false);
              onTitleChange(e.target.value);
            }}
            placeholder="Add a catchy title"
            maxLength={120}
            aria-invalid={titleError || undefined}
            className={`mt-2 w-full rounded-xl bg-black/20 px-3 py-3 text-[16px] font-bold text-white outline-none placeholder:text-white/25 ${
              titleError ? "border border-red-500 ring-2 ring-red-500/35" : "border border-white/8 focus:border-primary/45"
            }`}
          />
          {titleError && <p className="mt-1.5 px-1 text-[11px] font-semibold text-red-400">Title is required</p>}

          <div className="mt-4 flex items-center justify-between gap-3">
            <label htmlFor="yaj-post-description" className="text-[12px] font-bold text-white/70">Description</label>
            <span className="text-[10px] font-medium text-white/30">Optional</span>
          </div>
          <textarea
            id="yaj-post-description"
            ref={descRef}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Tell people what this post is about…"
            rows={5}
            className="mt-2 min-h-[7rem] w-full resize-none rounded-xl border border-white/8 bg-black/20 px-3 py-3 text-[16px] leading-relaxed text-white/90 outline-none placeholder:text-white/25 focus:border-primary/45"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
            <button type="button" onClick={() => insertToken("#")} disabled={busy} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/7 text-white/70 transition active:scale-95 disabled:opacity-40" aria-label="Add hashtag">
              <Hash className="h-4.5 w-4.5" />
            </button>
            <button type="button" onClick={() => insertToken("@")} disabled={busy} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/7 text-white/70 transition active:scale-95 disabled:opacity-40" aria-label="Add mention">
              <AtSign className="h-4.5 w-4.5" />
            </button>
            <button type="button" onClick={showTips} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/7 text-white/65 transition active:scale-95" aria-label="Post tips">
              <Lightbulb className="h-4.5 w-4.5" />
            </button>
            <button
              type="button"
              onClick={rewriteDescription}
              disabled={busy}
              className="ml-auto flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-3 py-2 text-[11px] font-bold text-primary disabled:opacity-40"
            >
              <Wand2 className="h-3.5 w-3.5" />
              {rewriting === "description" ? "Rewriting…" : "AI rewrite"}
            </button>
          </div>
        </section>

        <button
          type="button"
          onClick={rewriteTitle}
          disabled={busy}
          className="mt-4 flex w-full items-center gap-3 rounded-[20px] border border-primary/20 bg-primary/8 px-4 py-3.5 text-left transition active:scale-[0.99] disabled:opacity-40"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <YajAiGeneratorIcon className="h-5 w-5" active />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-white">
              {rewriting === "title" ? "YAJ is rewriting your title…" : "Ask YAJ to improve the title"}
            </p>
            <p className="mt-0.5 truncate text-[10.5px] text-white/45">Create a clearer, stronger hook before you post</p>
          </div>
          <Wand2 className="h-4 w-4 shrink-0 text-primary" />
        </button>

        {isEditing && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 py-3 text-sm font-semibold text-red-400 disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Deleting…" : "Delete post"}
          </button>
        )}

        <div style={{ height: "max(env(safe-area-inset-bottom), 1rem)" }} aria-hidden />
      </div>
    </div>
  );
}
