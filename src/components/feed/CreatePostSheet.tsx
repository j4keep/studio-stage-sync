import { useEffect, useState, useRef } from "react";
import { ChevronLeft, Music, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import CreateCameraView from "./create/CreateCameraView";
import MediaEditView from "./create/MediaEditView";
import PostOverlayRenderer from "./create/PostOverlayRenderer";
import SoundPickerSheet from "./SoundPickerSheet";
import { exportEditedImage } from "./create/exportMedia";
import { encodeCaptionWithMeta, parsePostCaption, defaultEditorMeta, type PostEditorMeta } from "@/lib/post-editor";
import { getMusicDisplayName } from "@/lib/feed-music";

interface Props {
  open: boolean;
  onClose: () => void;
  postToEdit?: any | null;
}

type Step = "camera" | "edit" | "preview";
type CaptureMode = "photo" | "video";

const MODES: { id: CaptureMode; label: string }[] = [
  { id: "video", label: "VIDEO" },
  { id: "photo", label: "PHOTO" },
];

const CreatePostSheet = ({ open, onClose, postToEdit = null }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("camera");
  const [mode, setMode] = useState<CaptureMode>("photo");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [currentMediaUrl, setCurrentMediaUrl] = useState<string | null>(null);
  const [editorMeta, setEditorMeta] = useState<PostEditorMeta>(defaultEditorMeta());
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicPreviewUrl, setMusicPreviewUrl] = useState<string | null>(null);
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const previewBlobRef = useRef<string | null>(null);
  const musicBlobRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const parsed = parsePostCaption(postToEdit?.caption);
    setCaption(parsed.caption);
    setEditorMeta(parsed.meta ?? defaultEditorMeta());
    setFile(null);
    setMusicFile(null);
    setMusicPreviewUrl(null);
    setMediaType(postToEdit?.media_type === "video" ? "video" : "image");
    setMode(postToEdit?.media_type === "video" ? "video" : "photo");
    setCurrentMediaUrl(postToEdit?.media_url || null);
    setPreview(postToEdit?.media_url || null);
    setStep(postToEdit ? "edit" : "camera");
  }, [open, postToEdit]);

  const revokeBlobs = () => {
    if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
    if (musicBlobRef.current) URL.revokeObjectURL(musicBlobRef.current);
    previewBlobRef.current = null;
    musicBlobRef.current = null;
  };

  const reset = () => {
    revokeBlobs();
    setCaption("");
    setFile(null);
    setPreview(null);
    setMusicFile(null);
    setMusicPreviewUrl(null);
    setMediaType("image");
    setCurrentMediaUrl(null);
    setEditorMeta(defaultEditorMeta());
    setStep("camera");
    setMode("photo");
    onClose();
  };

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      let mediaUrl: string | null = currentMediaUrl;
      let nextMediaType: "image" | "video" = mediaType;
      let uploadFile: File | Blob | null = file;
      let meta = { ...editorMeta };

      if (musicFile) {
        setUploading(true);
        const ext = musicFile.name.split(".").pop() || "mp3";
        const audioPath = `posts/${user.id}/audio-${Date.now()}.${ext}`;
        const { error: audioErr } = await supabase.storage
          .from("media")
          .upload(audioPath, musicFile, { contentType: musicFile.type || "audio/mpeg" });
        if (audioErr) throw audioErr;
        const { data: audioUrlData } = supabase.storage.from("media").getPublicUrl(audioPath);
        meta = {
          ...meta,
          music: {
            ...meta.music,
            audioUrl: audioUrlData.publicUrl,
            fileName: musicFile.name,
            volume: meta.music?.volume ?? 0.6,
          },
        };
      }

      const hasVisualEdits =
        meta.overlays.length > 0 ||
        meta.stickers.length > 0 ||
        (meta.drawings?.length ?? 0) > 0 ||
        meta.crop;

      if (file && mediaType === "image" && preview && hasVisualEdits) {
        uploadFile = await exportEditedImage(preview, meta);
      }

      if (uploadFile) {
        const ext = uploadFile instanceof File ? uploadFile.name.split(".").pop() : "jpg";
        const path = `posts/${user.id}/${Date.now()}.${ext}`;
        const contentType =
          uploadFile instanceof File
            ? uploadFile.type
            : mediaType === "video"
              ? "video/mp4"
              : "image/jpeg";
        const { error: uploadErr } = await supabase.storage
          .from("media")
          .upload(path, uploadFile, { contentType });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
        mediaUrl = urlData.publicUrl;
        nextMediaType =
          uploadFile instanceof File && uploadFile.type.startsWith("video/") ? "video" : mediaType;
      }

      setUploading(false);

      const payload = {
        caption: encodeCaptionWithMeta(caption.trim(), meta) || null,
        media_url: mediaUrl,
        media_type: mediaUrl ? nextMediaType : "image",
      };

      const query = postToEdit
        ? (supabase as any).from("posts").update(payload).eq("id", postToEdit.id).eq("user_id", user.id)
        : (supabase as any).from("posts").insert({ user_id: user.id, ...payload });

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
      toast.success(postToEdit ? "Post updated!" : "Post shared!");
      reset();
    },
    onError: (e: any) => {
      setUploading(false);
      toast.error(e?.message || "Failed to post");
    },
  });

  const handleMediaFile = (f: File, type?: "image" | "video") => {
    setFile(f);
    const isVideo = type === "video" || f.type.startsWith("video/");
    setMediaType(isVideo ? "video" : "image");
    setMode(isVideo ? "video" : "photo");
    setCurrentMediaUrl(null);
    revokeBlobs();
    const url = URL.createObjectURL(f);
    setPreview(url);
    previewBlobRef.current = url;
    if (!postToEdit) setEditorMeta(defaultEditorMeta());
    setStep("edit");
  };

  const openGallery = () => {
    const input = mode === "video" ? videoInputRef.current : photoInputRef.current;
    input?.click();
  };

  const previewMediaUrl = preview || currentMediaUrl;
  const hasMedia = !!(file || currentMediaUrl);
  const soundLabel = getMusicDisplayName(editorMeta.music);

  const handleMusicPreset = (loopId: string) => {
    if (musicBlobRef.current) URL.revokeObjectURL(musicBlobRef.current);
    musicBlobRef.current = null;
    setMusicFile(null);
    setMusicPreviewUrl(null);
    setEditorMeta((m) => ({ ...m, music: { loopId, volume: m.music?.volume ?? 0.6 } }));
  };

  const handleMusicFile = (f: File, url: string) => {
    if (musicBlobRef.current) URL.revokeObjectURL(musicBlobRef.current);
    musicBlobRef.current = url;
    setMusicFile(f);
    setMusicPreviewUrl(url);
    setEditorMeta((m) => ({ ...m, music: { fileName: f.name, volume: m.music?.volume ?? 0.6 } }));
  };

  const clearMusic = () => {
    if (musicBlobRef.current) URL.revokeObjectURL(musicBlobRef.current);
    musicBlobRef.current = null;
    setMusicFile(null);
    setMusicPreviewUrl(null);
    setEditorMeta((m) => ({ ...m, music: undefined }));
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] bg-black">
        {/* Camera step */}
        {step === "camera" && (
          <>
            <CreateCameraView
              mode={mode}
              onClose={reset}
              onCapture={handleMediaFile}
              onOpenGallery={openGallery}
              onAddSound={() => setShowSoundPicker(true)}
              soundLabel={editorMeta.music ? soundLabel : undefined}
            />
            <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] inset-x-0 z-30 flex justify-center gap-5">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`text-xs font-bold tracking-wide px-3 py-1 rounded-full ${mode === m.id ? "bg-white text-black" : "text-white/70"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Edit step */}
        {step === "edit" && hasMedia && (
          <>
            <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2">
              <button onClick={() => (postToEdit ? reset() : setStep("camera"))} className="w-10 h-10 flex items-center justify-center text-white">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={() => setShowSoundPicker(true)}
                className="flex items-center gap-1.5 max-w-[50%] rounded-full bg-black/50 backdrop-blur-md border border-white/20 px-3 py-1.5 text-white"
              >
                <Music className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs font-semibold truncate">{editorMeta.music ? soundLabel : "Add sound"}</span>
              </button>
              <button
                onClick={() => setStep("preview")}
                className="w-10 h-10 flex items-center justify-center text-primary"
                aria-label="Preview"
              >
                <Check className="w-6 h-6" />
              </button>
            </div>
            <div className="absolute inset-0 pt-[calc(env(safe-area-inset-top)+2.5rem)]">
              <MediaEditView
                mediaType={mediaType}
                previewUrl={previewMediaUrl}
                meta={editorMeta}
                onMetaChange={setEditorMeta}
                caption={caption}
                onCaptionChange={setCaption}
                musicPreviewUrl={musicPreviewUrl}
              />
            </div>
          </>
        )}

        {/* Preview step */}
        {step === "preview" && (
          <>
            <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
              <button onClick={() => setStep("edit")} className="w-10 h-10 flex items-center justify-center text-white">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <span className="text-sm font-bold text-white">Preview</span>
              <button
                onClick={() => postMutation.mutate()}
                disabled={postMutation.isPending || uploading}
                className="px-4 py-1.5 rounded-full bg-primary text-black text-sm font-bold disabled:opacity-40"
              >
                {uploading ? "..." : "Post"}
              </button>
            </div>
            <div className="absolute inset-0 pt-14 pb-8">
              <div className="relative h-full w-full">
                {mediaType === "video" && previewMediaUrl ? (
                  <video src={previewMediaUrl} className="absolute inset-0 w-full h-full object-cover" playsInline autoPlay loop muted={editorMeta.muteOriginal} />
                ) : previewMediaUrl ? (
                  <img src={previewMediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : null}
                <PostOverlayRenderer meta={editorMeta} />
              </div>
            </div>
          </>
        )}

        <input ref={photoInputRef} type="file" accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMediaFile(f, "image"); e.target.value = ""; }} />
        <input ref={videoInputRef} type="file" accept="video/*,.mp4,.mov,.m4v,.webm" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMediaFile(f, "video"); e.target.value = ""; }} />
      </motion.div>

      <SoundPickerSheet
        open={showSoundPicker}
        onClose={() => setShowSoundPicker(false)}
        meta={editorMeta}
        musicFile={musicFile}
        musicPreviewUrl={musicPreviewUrl}
        onSelectPreset={handleMusicPreset}
        onSelectFile={handleMusicFile}
        onClear={clearMusic}
        onVolumeChange={(volume) => setEditorMeta((m) => ({ ...m, music: { ...m.music, volume } }))}
      />
    </AnimatePresence>
  );
};

export default CreatePostSheet;
