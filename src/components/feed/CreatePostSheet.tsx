import { useEffect, useState, useRef } from "react";
import { X, ImagePlus, Video, ChevronLeft, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import PostMediaEditor, { exportEditedImage, defaultEditorMeta } from "./PostMediaEditor";
import { encodeCaptionWithMeta, parsePostCaption, type PostEditorMeta } from "@/lib/post-editor";

interface Props {
  open: boolean;
  onClose: () => void;
  postToEdit?: any | null;
}

type Step = "compose" | "edit" | "preview";

const CreatePostSheet = ({ open, onClose, postToEdit = null }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("compose");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [location, setLocation] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [currentMediaUrl, setCurrentMediaUrl] = useState<string | null>(null);
  const [editorMeta, setEditorMeta] = useState<PostEditorMeta>(defaultEditorMeta());
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewBlobRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const parsed = parsePostCaption(postToEdit?.caption);
    setCaption(parsed.caption);
    setEditorMeta(parsed.meta ?? defaultEditorMeta());
    setHashtags("");
    setLocation(parsed.meta?.location || "");
    setFile(null);
    setMediaType(postToEdit?.media_type === "video" ? "video" : "image");
    setCurrentMediaUrl(postToEdit?.media_url || null);
    setPreview(
      postToEdit?.media_type === "image" ? postToEdit?.media_url || null : postToEdit?.media_url || null
    );
    setStep("compose");
  }, [open, postToEdit]);

  const reset = () => {
    if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
    previewBlobRef.current = null;
    setCaption("");
    setHashtags("");
    setLocation("");
    setFile(null);
    setPreview(null);
    setMediaType("image");
    setCurrentMediaUrl(null);
    setEditorMeta(defaultEditorMeta());
    setStep("compose");
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

      if (file && mediaType === "image" && preview) {
        const hasEdits =
          editorMeta.overlays.length > 0 ||
          editorMeta.stickers.length > 0 ||
          editorMeta.crop;
        if (hasEdits) {
          uploadFile = await exportEditedImage(preview, editorMeta);
        }
      }

      if (uploadFile) {
        setUploading(true);
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
        setUploading(false);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
        mediaUrl = urlData.publicUrl;
        nextMediaType =
          uploadFile instanceof File && uploadFile.type.startsWith("video/") ? "video" : mediaType;
      }

      const payload = {
        caption: buildFinalCaption() || null,
        media_url: mediaUrl,
        media_type: mediaUrl ? nextMediaType : "image",
      };

      const query = postToEdit
        ? (supabase as any).from("posts").update(payload).eq("id", postToEdit.id).eq("user_id", user.id)
        : (supabase as any).from("posts").insert({
            user_id: user.id,
            ...payload,
          });

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
      toast.success(postToEdit ? "Post updated!" : "Post shared!");
      reset();
    },
    onError: (e: any) => toast.error(e?.message || (postToEdit ? "Failed to update post" : "Failed to post")),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const isVideo = f.type.startsWith("video/");
    setMediaType(isVideo ? "video" : "image");
    setCurrentMediaUrl(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
    previewBlobRef.current = url;
    setEditorMeta(defaultEditorMeta());
    setStep("edit");
  };

  const previewMediaUrl = preview || currentMediaUrl;
  const canProceedToEdit = !!(file || currentMediaUrl);
  const canPost = caption.trim() || file || currentMediaUrl;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm"
        onClick={reset}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[80] mx-auto max-w-lg rounded-t-2xl bg-background border-t border-border max-h-[min(92dvh,720px)] flex flex-col safe-area-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <button
            onClick={() => {
              if (step === "edit") setStep("compose");
              else if (step === "preview") setStep(canProceedToEdit ? "edit" : "compose");
              else reset();
            }}
            className="text-muted-foreground flex items-center gap-0.5"
          >
            {step === "compose" ? <X className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
          <h2 className="text-sm font-bold text-foreground">
            {step === "preview" ? "Preview" : postToEdit ? "Edit Post" : "Create Post"}
          </h2>
          {step === "preview" ? (
            <Button
              size="sm"
              onClick={() => postMutation.mutate()}
              disabled={!canPost || postMutation.isPending || uploading}
            >
              {uploading ? "Uploading..." : postMutation.isPending ? "Posting..." : "Post"}
            </Button>
          ) : step === "edit" ? (
            <Button size="sm" variant="secondary" onClick={() => setStep("preview")}>
              Preview
            </Button>
          ) : canProceedToEdit ? (
            <Button size="sm" variant="secondary" onClick={() => setStep("edit")}>
              Edit
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => postMutation.mutate()}
              disabled={!canPost || postMutation.isPending || uploading}
            >
              {postMutation.isPending ? "..." : "Post"}
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3">
          {step === "compose" && (
            <>
              <Textarea
                placeholder="What's on your mind?"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="min-h-[100px] text-sm border-none bg-transparent resize-none focus-visible:ring-0"
              />

              {previewMediaUrl && mediaType === "image" && (
                <div className="relative rounded-xl overflow-hidden">
                  <img src={previewMediaUrl} alt="Preview" className="w-full object-cover max-h-48" />
                  <button
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                      setCurrentMediaUrl(null);
                    }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}

              {previewMediaUrl && mediaType === "video" && (
                <div className="relative rounded-xl overflow-hidden bg-black">
                  <video src={previewMediaUrl} className="w-full max-h-48 object-contain" controls playsInline />
                  <button
                    onClick={() => {
                      setFile(null);
                      setPreview(null);
                      setCurrentMediaUrl(null);
                    }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              )}

              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    fileRef.current?.setAttribute("accept", "image/*");
                    fileRef.current?.click();
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <ImagePlus className="w-4 h-4 text-green-500" />
                  Photo
                </button>
                <button
                  onClick={() => {
                    fileRef.current?.setAttribute("accept", "video/*");
                    fileRef.current?.click();
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <Video className="w-4 h-4 text-red-500" />
                  Video
                </button>
                {canProceedToEdit && (
                  <button
                    onClick={() => setStep("preview")}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground ml-auto"
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </button>
                )}
              </div>
            </>
          )}

          {step === "edit" && canProceedToEdit && (
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
            />
          )}

          {step === "preview" && (
            <div className="space-y-3">
              <div className="relative aspect-[9/16] max-h-[55vh] w-full mx-auto rounded-xl overflow-hidden bg-black">
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
                  <div className="absolute inset-0 flex items-center justify-center p-6">
                    <p className="text-center text-sm text-white/80">{caption || "Text-only post"}</p>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />
                <div className="absolute bottom-4 left-3 right-3">
                  <p className="text-xs font-bold text-white">@{user?.email?.split("@")[0] || "you"}</p>
                  <p className="text-[11px] text-white/85 mt-0.5 line-clamp-2">
                    {[caption, hashtags].filter(Boolean).join(" ")}
                  </p>
                  {location && <p className="text-[10px] text-white/50 mt-1">{location}</p>}
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">This is how your post will appear in the feed.</p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CreatePostSheet;
