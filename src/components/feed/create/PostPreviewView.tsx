import { useState } from "react";
import { ChevronLeft, Hash, AtSign, Lightbulb, Wand2 } from "lucide-react";
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
  posting?: boolean;
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
  posting = false,
  isEditing = false,
}: Props) {
  const [rewriting, setRewriting] = useState<"title" | "description" | null>(null);

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

  const canPost = title.trim().length > 0 && !posting && !rewriting;

  return (
    <div className="fixed inset-0 z-10 flex flex-col bg-zinc-950 text-white overflow-hidden touch-none overscroll-none">
      <div
        className="shrink-0 flex items-center justify-between px-3 pb-2"
        style={{ paddingTop: "max(env(safe-area-inset-top), 0.5rem)" }}
      >
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center text-white editor-touch-none"
          aria-label="Back to editor"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="text-sm font-bold text-white/90">{isEditing ? "Edit post" : "New post"}</span>
        <div className="w-10" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4">
        <div className="flex gap-3 mb-5">
          <div className="relative w-[88px] h-[88px] shrink-0 rounded-xl overflow-hidden bg-zinc-800 border border-white/10">
            {previewUrl &&
              (mediaType === "video" ? (
                <video src={previewUrl} className="w-full h-full object-cover" muted playsInline />
              ) : (
                <img src={previewUrl} alt="" className="w-full h-full object-cover" />
              ))}
            <span className="absolute top-1.5 left-1.5 text-[10px] font-bold bg-black/60 px-1.5 py-0.5 rounded-md">
              Cover
            </span>
          </div>
        </div>

        <div className="mb-1">
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Add a catchy title"
            maxLength={120}
            className="w-full bg-transparent text-lg font-bold text-white placeholder:text-white/35 outline-none border-none py-1"
          />
        </div>

        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Writing a long description can help get more views on average."
          rows={4}
          className="w-full bg-transparent text-sm text-white/85 placeholder:text-white/35 outline-none resize-none leading-relaxed mt-2"
        />

        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10">
          <button type="button" className="w-9 h-9 rounded-lg flex items-center justify-center text-white/50" aria-label="Hashtag">
            <Hash className="w-5 h-5" />
          </button>
          <button type="button" className="w-9 h-9 rounded-lg flex items-center justify-center text-white/50" aria-label="Mention">
            <AtSign className="w-5 h-5" />
          </button>
          <button type="button" className="w-9 h-9 rounded-lg flex items-center justify-center text-white/50" aria-label="Tips">
            <Lightbulb className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={rewriteDescription}
            disabled={!!rewriting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold disabled:opacity-40 editor-touch-none"
          >
            <Wand2 className="w-3.5 h-3.5" />
            {rewriting === "description" ? "Rewriting…" : "AI rewrite"}
          </button>
        </div>

        <button
          type="button"
          onClick={rewriteTitle}
          disabled={!!rewriting}
          className="mt-4 w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 active:bg-white/10 disabled:opacity-40 editor-touch-none"
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
      </div>

      <div
        className="shrink-0 px-4 pt-2 border-t border-white/10 bg-zinc-950"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
      >
        <button
          type="button"
          onClick={onPost}
          disabled={!canPost}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base disabled:opacity-40 editor-touch-none"
        >
          {posting ? (isEditing ? "Updating…" : "Posting…") : isEditing ? "Update post" : "Post"}
        </button>
        {!title.trim() && (
          <p className="text-center text-[11px] text-white/40 mt-2">Add a title to {isEditing ? "update" : "post"}</p>
        )}
      </div>
    </div>
  );
}
