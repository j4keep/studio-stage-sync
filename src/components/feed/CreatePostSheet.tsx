import { useEffect, useState, useRef } from "react";
import {
  X,
  ChevronLeft,
  Music,
  ImagePlus,
  Type,
  Sticker,
  Scissors,
  Crop,
  MapPin,
  Hash,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import PostMediaEditor, { exportEditedImage, defaultEditorMeta } from "./PostMediaEditor";
import SoundPickerSheet from "./SoundPickerSheet";
import { encodeCaptionWithMeta, parsePostCaption, type PostEditorMeta } from "@/lib/post-editor";
import { getMusicDisplayName } from "@/lib/feed-music";

interface Props {
  open: boolean;
  onClose: () => void;
  postToEdit?: any | null;
}

type Step = "pick" | "edit" | "preview";
type CaptureMode = "photo" | "video" | "text";

const MODES: { id: CaptureMode; label: string }[] = [
  { id: "video", label: "VIDEO" },
  { id: "photo", label: "PHOTO" },
  { id: "text", label: "TEXT" },
];

const CreatePostSheet = ({ open, onClose, postToEdit = null }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("pick");
  const [mode, setMode] = useState<CaptureMode>("photo");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [location, setLocation] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [currentMediaUrl, setCurrentMediaUrl] = useState<string | null>(null);
  const [editorMeta, setEditorMeta] = useState<PostEditorMeta>(defaultEditorMeta());
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicPreviewUrl, setMusicPreviewUrl] = useState<string | null>(null);
  const [showSoundPicker, setShowSoundPicker] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
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
    setHashtags("");
    setLocation(parsed.meta?.location || "");
    setFile(null);
    setMusicFile(null);
    setMusicPreviewUrl(null);
    setMediaType(postToEdit?.media_type === "video" ? "video" : "image");
    setMode(postToEdit?.media_type === "video" ? "video" : postToEdit ? "photo" : "photo");
    setCurrentMediaUrl(postToEdit?.media_url || null);
    setPreview(postToEdit?.media_url || null);
    setStep(postToEdit ? "edit" : "pick");
    setActiveTool(null);
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
    setHashtags("");
    setLocation("");
    setFile(null);
    setPreview(null);
    setMusicFile(null);
    setMusicPreviewUrl(null);
    setMediaType("image");
    setCurrentMediaUrl(null);
    setEditorMeta(defaultEditorMeta());
    setStep("pick");
    setMode("photo");
    setActiveTool(null);
    onClose();
  };

  const buildFinalCaption = () => {
    const tagPart = hashtags.trim();
    const base = [caption.trim(), tagPart].filter(Boolean).join(" ");
    const meta = { ...editorMeta, location: location.trim() || editorMeta.location };
    return encodeCaptionWithMeta(base, meta);
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

      if (file && mediaType === "image" && preview) {
        const hasEdits =
          meta.overlays.length > 0 || meta.stickers.length > 0 || meta.crop;
        if (hasEdits) uploadFile = await exportEditedImage(preview, meta);
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
        caption: encodeCaptionWithMeta(
          [caption.trim(), hashtags.trim()].filter(Boolean).join(" "),
          { ...meta, location: location.trim() || meta.location },
        ) || null,
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

  const handleMediaFile = (f: File) => {
    setFile(f);
    const isVideo = f.type.startsWith("video/");
    setMediaType(isVideo ? "video" : "image");
    setMode(isVideo ? "video" : "photo");
    setCurrentMediaUrl(null);
    revokeBlobs();
    const url = URL.createObjectURL(f);
    setPreview(url);
    previewBlobRef.current = url;
    setEditorMeta(defaultEditorMeta());
    setStep("edit");
  };

  const openMediaPicker = () => {
    if (mode === "text") return;
    const input = mode === "video" ? videoInputRef.current : photoInputRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  };

  const previewMediaUrl = preview || currentMediaUrl;
  const hasMedia = !!(file || currentMediaUrl);
  const canPost = caption.trim() || hasMedia;
  const soundLabel = getMusicDisplayName(editorMeta.music);

  const handleMusicPreset = (loopId: string) => {
    if (musicBlobRef.current) URL.revokeObjectURL(musicBlobRef.current);
    musicBlobRef.current = null;
    setMusicFile(null);
    setMusicPreviewUrl(null);
    setEditorMeta((m) => ({
      ...m,
      music: { loopId, volume: m.music?.volume ?? 0.6 },
    }));
  };

  const handleMusicFile = (f: File, url: string) => {
    if (musicBlobRef.current) URL.revokeObjectURL(musicBlobRef.current);
    musicBlobRef.current = url;
    setMusicFile(f);
    setMusicPreviewUrl(url);
    setEditorMeta((m) => ({
      ...m,
      music: { fileName: f.name, volume: m.music?.volume ?? 0.6 },
    }));
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
        className="fixed inset-0 z-[80] bg-black"
      >
        {/* Top bar — TikTok style */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2">
          <button
            onClick={() => {
              if (step === "edit" && !postToEdit) setStep("pick");
              else if (step === "preview") setStep("edit");
              else reset();
            }}
            className="w-10 h-10 flex items-center justify-center rounded-full text-white"
            aria-label="Close"
          >
            {step === "pick" ? <X className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
          </button>

          {(hasMedia || step !== "pick") && (
            <button
              onClick={() => setShowSoundPicker(true)}
              className="flex items-center gap-1.5 max-w-[55%] rounded-full bg-black/50 backdrop-blur-md border border-white/20 px-3 py-1.5 text-white"
            >
              <Music className="w-3.5 h-3.5 shrink-0" />
              <span className="text-xs font-semibold truncate">
                {editorMeta.music ? soundLabel : "Add sound"}
              </span>
            </button>
          )}

          <button
            onClick={() => {
              if (step === "preview") postMutation.mutate();
              else if (step === "edit" && hasMedia) setStep("preview");
              else if (canPost) postMutation.mutate();
            }}
            disabled={!canPost || postMutation.isPending || uploading}
            className="min-w-[3.5rem] text-sm font-bold text-white disabled:opacity-40"
          >
            {uploading ? "..." : step === "preview" || (step === "pick" && mode === "text") ? "Post" : "Next"}
          </button>
        </div>

        {/* Main content */}
        <div className="absolute inset-0 flex flex-col">
          {step === "pick" && mode === "text" && (
            <div className="flex-1 flex flex-col justify-center px-6 pt-16 pb-32">
              <textarea
                placeholder="What's on your mind?"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full min-h-[200px] bg-transparent text-white text-lg resize-none focus:outline-none placeholder:text-white/40"
                autoFocus
              />
            </div>
          )}

          {step === "pick" && mode !== "text" && (
            <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-36">
              <div className="w-full max-w-xs aspect-[9/16] rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-4 bg-white/5">
                <button
                  onClick={openMediaPicker}
                  className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                  aria-label={mode === "video" ? "Upload video" : "Upload photo"}
                >
                  {mode === "video" ? (
                    <div className="w-16 h-16 rounded-full border-4 border-black" />
                  ) : (
                    <ImagePlus className="w-8 h-8 text-black" />
                  )}
                </button>
                <p className="text-sm text-white/70 text-center">
                  Tap to upload {mode === "video" ? "a video" : "a photo"}
                </p>
                <p className="text-[11px] text-white/40">or pick from gallery below</p>
              </div>
            </div>
          )}

          {step === "edit" && hasMedia && (
            <div className="flex-1 pt-14 pb-36 overflow-hidden">
              <PostMediaEditor
                file={file}
                mediaType={mediaType}
                previewUrl={previewMediaUrl}
                meta={editorMeta}
                onMetaChange={setEditorMeta}
                hashtags={hashtags}
                onHashtagsChange={setHashtags}
                location={location}
                onLocationChange={setLocation}
                immersive
                activeTool={activeTool}
                onActiveToolChange={setActiveTool}
                musicPreviewUrl={musicPreviewUrl}
              />
            </div>
          )}

          {step === "preview" && (
            <div className="flex-1 flex items-center justify-center px-4 pt-14 pb-36">
              <div className="relative w-full max-w-sm aspect-[9/16] rounded-2xl overflow-hidden bg-zinc-900 shadow-2xl">
                {mediaType === "video" && previewMediaUrl ? (
                  <video
                    src={previewMediaUrl}
                    className="absolute inset-0 h-full w-full object-cover"
                    playsInline
                    muted={editorMeta.muteOriginal}
                    autoPlay
                    loop
                  />
                ) : previewMediaUrl ? (
                  <img src={previewMediaUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-8">
                    <p className="text-center text-white/80">{caption}</p>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent" />
                <div className="absolute bottom-4 left-3 right-3">
                  <p className="text-sm font-bold text-white">@{user?.email?.split("@")[0] || "you"}</p>
                  <p className="text-xs text-white/85 mt-1 line-clamp-2">
                    {[caption, hashtags].filter(Boolean).join(" ")}
                  </p>
                  {editorMeta.music && (
                    <p className="text-[10px] text-white/60 mt-1 flex items-center gap-1">
                      <Music className="w-3 h-3" /> {soundLabel}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right tool rail — edit mode */}
        {step === "edit" && hasMedia && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-4 pt-8">
            {[
              { id: "text", icon: Type, label: "Text" },
              { id: "sticker", icon: Sticker, label: "Stickers" },
              { id: "trim", icon: Scissors, label: "Trim" },
              { id: "crop", icon: Crop, label: "Crop" },
              { id: "location", icon: MapPin, label: "Place" },
              { id: "hashtags", icon: Hash, label: "Tags" },
            ]
              .filter((t) => (t.id === "trim" ? mediaType === "video" : true))
              .map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTool(activeTool === t.id ? null : t.id)}
                    className={`flex flex-col items-center gap-0.5 ${activeTool === t.id ? "opacity-100" : "opacity-80"}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${activeTool === t.id ? "bg-white/25" : "bg-black/40"}`}>
                      <Icon className="w-5 h-5 text-white drop-shadow-lg" />
                    </div>
                    <span className="text-[9px] text-white font-medium drop-shadow">{t.label}</span>
                  </button>
                );
              })}
          </div>
        )}

        {/* Bottom controls — TikTok style */}
        <div className="absolute bottom-0 left-0 right-0 z-20 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          {/* Mode pills */}
          <div className="flex justify-center gap-4 mb-4 px-4">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id);
                  if (m.id === "text") setStep("pick");
                }}
                className={`text-xs font-bold tracking-wide px-2 py-1 rounded-full transition-all ${
                  mode === m.id ? "bg-white text-black scale-105" : "text-white/70"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {step === "pick" && mode !== "text" && (
            <div className="flex items-center justify-center gap-8 px-6">
              <button
                onClick={openMediaPicker}
                className="w-12 h-12 rounded-lg overflow-hidden border-2 border-white bg-zinc-800 flex items-center justify-center"
                aria-label="Open gallery"
              >
                {previewMediaUrl && mediaType === "image" ? (
                  <img src={previewMediaUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus className="w-5 h-5 text-white/70" />
                )}
              </button>

              <button
                onClick={openMediaPicker}
                className="w-[4.5rem] h-[4.5rem] rounded-full bg-white border-[5px] border-white/90 shadow-lg active:scale-95 transition-transform"
                aria-label="Upload"
              />

              <div className="w-12 h-12" />
            </div>
          )}

          {step === "edit" && (
            <div className="px-4">
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption..."
                className="w-full bg-white/10 backdrop-blur-md border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
              />
            </div>
          )}
        </div>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleMediaFile(f);
            e.target.value = "";
          }}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*,.mp4,.mov,.m4v,.webm"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleMediaFile(f);
            e.target.value = "";
          }}
        />
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
        onVolumeChange={(volume) =>
          setEditorMeta((m) => ({ ...m, music: { ...m.music, volume } }))
        }
      />
    </AnimatePresence>
  );
};

export default CreatePostSheet;
