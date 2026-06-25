import { useEffect, useState, useRef, useCallback } from "react";
import { ChevronLeft, Music, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import CreateCameraView from "./create/CreateCameraView";
import MediaEditView from "./create/MediaEditView";
import PostPreviewView from "./create/PostPreviewView";
import SoundPickerSheet from "./SoundPickerSheet";
import { exportEditedImage } from "./create/exportMedia";
import { encodeCaptionWithMeta, parsePostCaption, defaultEditorMeta, stripBakedVisualMeta, type PostEditorMeta } from "@/lib/post-editor";
import { defaultExportViewport } from "@/lib/overlay-coords";
import { getMusicDisplayName, playPostMusic } from "@/lib/feed-music";

interface Props {
  open: boolean;
  onClose: () => void;
  postToEdit?: any | null;
  cameraStream?: MediaStream | null;
}

type Step = "camera" | "edit" | "preview";
type CaptureMode = "photo" | "video";

const CreatePostSheet = ({ open, onClose, postToEdit = null, cameraStream = null }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("camera");
  const [mode, setMode] = useState<CaptureMode>("video");
  const [caption, setCaption] = useState("");
  const [title, setTitle] = useState("");
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
  const musicStopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!open) return;
    const shouldPlay = step === "camera" || step === "edit" || step === "preview";
    musicStopRef.current?.();
    musicStopRef.current = null;
    if (!shouldPlay) return;
    const player = playPostMusic(editorMeta.music, musicPreviewUrl);
    if (player) musicStopRef.current = player.stop;
    return () => {
      musicStopRef.current?.();
      musicStopRef.current = null;
    };
  }, [
    open,
    step,
    musicPreviewUrl,
    editorMeta.music?.loopId,
    editorMeta.music?.audioUrl,
    editorMeta.music?.volume,
    editorMeta.music?.durationSec,
  ]);

  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent("feed-nav-toggle", { detail: { hidden: true } }));
    const scrollY = window.scrollY;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.top = `-${scrollY}px`;
    const parsed = parsePostCaption(postToEdit?.caption);
    setCaption(parsed.caption);
    setTitle(
      parsed.meta?.title ??
        (postToEdit && parsed.caption ? parsed.caption.split("\n")[0].slice(0, 120) : ""),
    );
    setEditorMeta(parsed.meta ?? defaultEditorMeta());
    setFile(null);
    setMusicFile(null);
    setMusicPreviewUrl(parsed.meta?.music?.audioUrl ?? null);
    setMediaType(postToEdit?.media_type === "video" ? "video" : "image");
    setMode(postToEdit?.media_type === "video" ? "video" : "photo");
    setCurrentMediaUrl(postToEdit?.media_url || null);
    setPreview(postToEdit?.media_url || null);
    setStep(postToEdit ? "preview" : "camera");
    return () => {
      window.dispatchEvent(new CustomEvent("feed-nav-toggle", { detail: { hidden: false } }));
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
      window.scrollTo(0, scrollY);
    };
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
    setTitle("");
    setFile(null);
    setPreview(null);
    setMusicFile(null);
    setMusicPreviewUrl(null);
    setMediaType("image");
    setCurrentMediaUrl(null);
    setEditorMeta(defaultEditorMeta());
    setStep("camera");
    setMode("video");
    onClose();
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !postToEdit) throw new Error("Not authenticated");
      const { error } = await (supabase as any)
        .from("posts")
        .delete()
        .eq("id", postToEdit.id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
      toast.success("Post deleted");
      reset();
    },
    onError: (e: any) => {
      toast.error(e?.message || "Failed to delete post");
    },
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      let mediaUrl: string | null = currentMediaUrl;
      let nextMediaType: "image" | "video" = mediaType;
      let uploadFile: File | Blob | null = file;
      let meta = { ...editorMeta, title: title.trim() || undefined };

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

      const imageSource = preview || currentMediaUrl;
      if (mediaType === "image" && imageSource && hasVisualEdits) {
        uploadFile = await exportEditedImage(imageSource, meta, defaultExportViewport());
        meta = stripBakedVisualMeta(meta);
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

  const handleMediaReplace = useCallback((f: File, url: string) => {
    if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
    previewBlobRef.current = url;
    setFile(f);
    setPreview(url);
    setEditorMeta((m) => ({ ...m, crop: undefined }));
  }, []);

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

  const handleSoundButton = () => {
    if (editorMeta.music || musicPreviewUrl) {
      musicStopRef.current?.();
      const player = playPostMusic(editorMeta.music, musicPreviewUrl);
      if (player) musicStopRef.current = player.stop;
    }
    setShowSoundPicker(true);
  };

  const handleMusicPreset = (loopId: string) => {
    if (musicBlobRef.current) URL.revokeObjectURL(musicBlobRef.current);
    musicBlobRef.current = null;
    setMusicFile(null);
    setMusicPreviewUrl(null);
    setEditorMeta((m) => ({ ...m, music: { loopId, volume: m.music?.volume ?? 0.6, durationSec: m.music?.durationSec } }));
  };

  const handleMusicFile = (f: File, url: string) => {
    if (musicBlobRef.current) URL.revokeObjectURL(musicBlobRef.current);
    musicBlobRef.current = url;
    setMusicFile(f);
    setMusicPreviewUrl(url);
    setEditorMeta((m) => ({ ...m, music: { fileName: f.name, volume: m.music?.volume ?? 0.6, durationSec: m.music?.durationSec } }));
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black overflow-hidden touch-none overscroll-none"
        style={{ height: "100dvh", maxHeight: "100dvh" }}
      >
        {/* Camera step */}
        {step === "camera" && (
          <CreateCameraView
            mode={mode}
            onModeChange={setMode}
            onClose={reset}
            onCapture={handleMediaFile}
            onOpenGallery={openGallery}
            onAddSound={handleSoundButton}
            soundLabel={editorMeta.music ? soundLabel : undefined}
            initialStream={cameraStream}
          />
        )}

        {/* Edit step */}
        {step === "edit" && hasMedia && (
          <div className="absolute inset-0 overflow-hidden">
            <MediaEditView
            mediaType={mediaType}
            previewUrl={previewMediaUrl}
            meta={editorMeta}
            onMetaChange={setEditorMeta}
            caption={caption}
            onCaptionChange={setCaption}
            musicPreviewUrl={musicPreviewUrl}
            onBack={() => (postToEdit ? setStep("preview") : reset())}
            onDone={() => setStep("preview")}
            onAddSound={handleSoundButton}
            soundLabel={editorMeta.music ? soundLabel : undefined}
            onMediaReplace={handleMediaReplace}
            isEditing={!!postToEdit}
            />
          </div>
        )}

        {/* Preview step */}
        {step === "preview" && (
          <PostPreviewView
            mediaType={mediaType}
            previewUrl={previewMediaUrl}
            title={title}
            description={caption}
            onTitleChange={setTitle}
            onDescriptionChange={setCaption}
            onBack={() => (postToEdit ? reset() : setStep("edit"))}
            onPost={() => postMutation.mutate()}
            onEditMedia={() => setStep("edit")}
            onDelete={postToEdit ? () => deleteMutation.mutate() : undefined}
            posting={postMutation.isPending || uploading}
            deleting={deleteMutation.isPending}
            isEditing={!!postToEdit}
          />
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
        onVolumeChange={(volume) => setEditorMeta((m) => ({ ...m, music: { ...m.music!, volume } }))}
        onDurationChange={(durationSec) =>
          setEditorMeta((m) => ({
            ...m,
            music: m.music ? { ...m.music, durationSec: durationSec || undefined } : { volume: 0.6, durationSec: durationSec || undefined },
          }))
        }
      />
    </AnimatePresence>
  );
};

export default CreatePostSheet;
