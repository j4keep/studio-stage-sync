import { useRef, useState } from "react";
import { Camera, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { generateYajImage } from "@/lib/yaj-media";
import { uploadCircleImage, uploadCircleImageFromDataUrl } from "@/lib/circles";

type Props = {
  userId: string;
  circleName: string;
  onSaved: (url: string) => void;
  /** Renders as a full-screen mandatory prompt vs. an inline sheet-style card. */
  fullScreen?: boolean;
  onSkip?: () => void;
};

/**
 * Upload-from-device or generate-with-YAJ-AI cover creator, reused for both the
 * mandatory first-visit prompt on a user's own personal circle and any group Circle's
 * cover step. Reuses the existing generateYajImage() edge function (the same one
 * behind Ask YAJ AI's "create an image" mode) rather than building new AI infra.
 */
export default function CircleCoverCreator({ userId, circleName, onSaved, fullScreen, onSkip }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"pick" | "ai">("pick");
  const [prompt, setPrompt] = useState(`A vibrant, welcoming cover photo for "${circleName}"`);
  const [generating, setGenerating] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<File | { dataUrl: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const pickFile = (file: File) => {
    setPendingUpload(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const image = await generateYajImage(prompt.trim());
      setPreview(image);
      setPendingUpload({ dataUrl: image });
    } catch (e: any) {
      toast({ title: "Couldn't generate that image", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const confirm = async () => {
    if (!pendingUpload) return;
    setSaving(true);
    try {
      const url =
        pendingUpload instanceof File
          ? await uploadCircleImage(userId, pendingUpload, "cover")
          : await uploadCircleImageFromDataUrl(userId, pendingUpload.dataUrl, "cover");
      onSaved(url);
    } catch (e: any) {
      toast({ title: "Couldn't save your cover", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const body = (
    <div className="w-full max-w-sm">
      <div className="mb-4 text-center">
        <h2 className="text-lg font-black">Create your Circle cover</h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          This is the first thing people see before they ask to join {circleName}.
        </p>
      </div>

      <div className="mb-4 flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted">
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <Camera className="h-8 w-8 text-muted-foreground" />
        )}
      </div>

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("pick")}
          className={`flex-1 rounded-full border py-2 text-[12px] font-bold transition ${mode === "pick" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
        >
          Upload Photo
        </button>
        <button
          type="button"
          onClick={() => setMode("ai")}
          className={`flex-1 rounded-full border py-2 text-[12px] font-bold transition ${mode === "ai" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
        >
          <Sparkles className="mr-1 inline h-3.5 w-3.5" /> YAJ AI Generate
        </button>
      </div>

      {mode === "pick" ? (
        <>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])} />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="w-full rounded-full border border-border bg-card py-2.5 text-[12.5px] font-bold"
          >
            Choose a photo
          </button>
        </>
      ) : (
        <div className="space-y-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder="Describe the cover you want…"
            className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-[13px] outline-none"
          />
          <button
            type="button"
            disabled={generating}
            onClick={generate}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-[12.5px] font-black text-primary-foreground disabled:opacity-60"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Generating…" : "Generate with YAJ AI"}
          </button>
        </div>
      )}

      <button
        type="button"
        disabled={!pendingUpload || saving}
        onClick={confirm}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-[13px] font-black text-background disabled:opacity-40"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Use This Cover
      </button>

      {onSkip && (
        <button type="button" onClick={onSkip} className="mt-2 w-full py-2 text-center text-[11.5px] font-bold text-muted-foreground underline">
          Skip for now
        </button>
      )}
    </div>
  );

  if (!fullScreen) return body;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background px-6" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {onSkip && (
        <button type="button" onClick={onSkip} aria-label="Close" className="absolute right-4 top-[max(env(safe-area-inset-top),1rem)] rounded-full bg-muted p-2">
          <X className="h-4 w-4" />
        </button>
      )}
      {body}
    </div>
  );
}
