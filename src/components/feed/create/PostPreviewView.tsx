import { useRef, useState } from "react";
import { ChevronLeft, Hash, AtSign, Lightbulb, Wand2, ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import JhiIcon from "@/components/JhiIcon";
import { jhiRewritePostDescription, jhiRewritePostTitle } from "@/lib/ask-jhi";

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
}: Props) {
  const [rewriting, setRewriting] = useState<"title" | "description" | null>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const rewriteTitle = async () => {
    if (rewriting) return;
    setRewriting("title");
    try {
      const next = await jhiRewritePostTitle(title, description);
      if (next) onTitleChange(next);
      else toast.error("J-Hi couldn't rewrite the title. Try again.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "J-Hi is unavailable right now");
    } finally {
      setRewriting(null);
    }
  };

  const rewriteDescription = async () => {
    if (rewriting) return;
    setRewriting("description");
    try {
      const next = await jhiRewritePostDescription(description, title);
      if (next) onDescriptionChange(next);
      else toast.error("J-Hi couldn't rewrite the description. Try again.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "J-Hi is unavailable right now");
    } finally {
      setRewriting(null);
    }
  };

  const insertToken = (token: string) => {
    const el = descRef.current;
    const sep = description.length && !description.endsWith(" ") ? " " : "";
    if (!el) {
      onDescriptionChange(description + sep + token);
      return;
    }
    const start = el.selectionStart ?? description.length;
    const end = el.selectionEnd ?? description.length;
    const next = description.slice(0, start) + token + description.slice(end);
    onDescriptionChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const busy = posting || deleting || !!rewriting;
  const canSave = title.trim().length > 0 && !busy;
  const saveLabel = posting
    ? isEditing
      ? "Saving…"
      : "Posting…"
    : isEditing
      ? "Update"
      : "Post";

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-zinc-950 text-white overflow-hidden"
      style={{ height: "100dvh", maxHeight: "100dvh" }}
    >
      {/* Top header: Back | Edit post | Save */}
      <header
        className="shrink-0 flex items-center justify-between gap-2 px-2 border-b border-white/10 bg-zinc-950"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 0.5rem)",
          paddingBottom: "0.625rem",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="w-10 h-10 flex items-center justify-center text-white shrink-0 disabled:opacity-40"
          aria-label="Back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="text-sm font-bold text-white/90 truncate">{isEditing ? "Edit post" : "New post"}</span>
        <button
          type="button"
          onClick={onPost}
          disabled={!canSave}
          className="shrink-0 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-bold disabled:opacity-40 min-w-[4.5rem]"
        >
          {saveLabel}
        </button>
      </header>

      {/* Scrollable form */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-4 py-4"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex gap-3 mb-5">
          <button
            type="button"
            onClick={onEditMedia}
            disabled={!onEditMedia || busy}
            className="relative w-[88px] h-[88px] shrink-0 rounded-xl overflow-hidden bg-zinc-800 border border-white/10 disabled:opacity-60"
            aria-label="Edit cover media"
          >
            {previewUrl &&
              (mediaType === "video" ? (
                <video src={previewUrl} className="w-full h-full object-cover pointer-events-none" muted playsInline />
              ) : (
                <img src={previewUrl} alt="" className="w-full h-full object-cover pointer-events-none" />
              ))}
            <span className="absolute top-1.5 left-1.5 text-[10px] font-bold bg-black/60 px-1.5 py-0.5 rounded-md">
              Cover
            </span>
            {onEditMedia && (
              <span className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-black/55 flex items-center justify-center">
                <ImageIcon className="w-3.5 h-3.5 text-white" />
              </span>
            )}
          </button>
          {onEditMedia && (
            <button
              type="button"
              onClick={onEditMedia}
              disabled={busy}
              className="text-xs font-semibold text-primary self-end mb-1 disabled:opacity-40"
            >
              Edit stickers &amp; text
            </button>
          )}
        </div>

        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Add a catchy title"
          maxLength={120}
          className="w-full bg-transparent text-lg font-bold text-white placeholder:text-white/35 outline-none border-none py-1"
          style={{ fontSize: "16px" }}
        />

        <textarea
          ref={descRef}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Writing a long description can help get more views on average."
          rows={5}
          className="w-full bg-transparent text-sm text-white/85 placeholder:text-white/35 outline-none resize-none leading-relaxed mt-3 min-h-[6rem]"
          style={{ fontSize: "16px" }}
        />

        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10 flex-wrap">
          <button
            type="button"
            onClick={() => insertToken("#")}
            disabled={busy}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white/70 active:bg-white/10 disabled:opacity-40"
            aria-label="Add hashtag"
          >
            <Hash className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => insertToken("@")}
            disabled={busy}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white/70 active:bg-white/10 disabled:opacity-40"
            aria-label="Add mention"
          >
            <AtSign className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white/50"
            aria-label="Tips"
          >
            <Lightbulb className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={rewriteDescription}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold disabled:opacity-40"
          >
            <Wand2 className="w-3.5 h-3.5" />
            {rewriting === "description" ? "Rewriting…" : "AI rewrite"}
          </button>
        </div>

        <button
          type="button"
          onClick={rewriteTitle}
          disabled={busy}
          className="mt-4 w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 active:bg-white/10 disabled:opacity-40"
        >
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <JhiIcon className="w-5 h-5" active />
          </div>
          <div className="text-left flex-1 min-w-0">
            <p className="text-sm font-bold text-white">
              {rewriting === "title" ? "J-Hi is rewriting your title…" : "Ask J-Hi to rewrite title"}
            </p>
            <p className="text-[11px] text-white/45 truncate">Get a catchier hook before you post</p>
          </div>
          <Wand2 className="w-4 h-4 text-primary shrink-0" />
        </button>

        {isEditing && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-500/40 text-red-400 font-semibold text-sm disabled:opacity-40"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? "Deleting…" : "Delete post"}
          </button>
        )}

        {/* Bottom spacer so last controls clear home indicator when scrolling */}
        <div style={{ height: "max(env(safe-area-inset-bottom), 1rem)" }} aria-hidden />
      </div>

      {!title.trim() && (
        <p
          className="shrink-0 text-center text-[11px] text-white/40 pb-2"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
        >
          Add a title to {isEditing ? "save" : "post"}
        </p>
      )}
    </div>
  );
}
