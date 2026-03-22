import { useEffect, useState, useRef } from "react";
import { X, ImagePlus, Video } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onClose: () => void;
  postToEdit?: any | null;
}

const CreatePostSheet = ({ open, onClose, postToEdit = null }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [currentMediaUrl, setCurrentMediaUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    setCaption(postToEdit?.caption || "");
    setFile(null);
    setMediaType(postToEdit?.media_type === "video" ? "video" : "image");
    setCurrentMediaUrl(postToEdit?.media_url || null);
    setPreview(postToEdit?.media_type === "image" ? postToEdit?.media_url || null : null);
  }, [open, postToEdit]);

  const reset = () => {
    setCaption("");
    setFile(null);
    setPreview(null);
    setMediaType("image");
    setCurrentMediaUrl(null);
    onClose();
  };

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      let mediaUrl: string | null = currentMediaUrl;
      let nextMediaType: "image" | "video" = mediaType;

      if (file) {
        setUploading(true);
        const ext = file.name.split(".").pop();
        const path = `posts/${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("media")
          .upload(path, file, { contentType: file.type });
        setUploading(false);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
        mediaUrl = urlData.publicUrl;
        nextMediaType = file.type.startsWith("video/") ? "video" : "image";
      }

      const payload = {
        caption: caption.trim() || null,
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
    if (!isVideo) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-black/60"
        onClick={reset}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[80] mx-auto max-w-lg rounded-t-2xl bg-background border-t border-border max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <button onClick={reset} className="text-muted-foreground"><X className="w-5 h-5" /></button>
          <h2 className="text-sm font-bold text-foreground">{postToEdit ? "Edit Post" : "Create Post"}</h2>
          <Button
            size="sm"
            onClick={() => postMutation.mutate()}
            disabled={(!caption.trim() && !file) || postMutation.isPending || uploading}
          >
            {uploading ? "Uploading..." : postMutation.isPending ? (postToEdit ? "Saving..." : "Posting...") : (postToEdit ? "Save" : "Post")}
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <Textarea
            placeholder="What's on your mind?"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="min-h-[100px] text-sm border-none bg-transparent resize-none focus-visible:ring-0"
          />

          {preview && (
            <div className="relative">
              <img src={preview} alt="Preview" className="w-full rounded-xl object-cover max-h-64" />
              <button onClick={() => { setFile(null); setPreview(null); setCurrentMediaUrl(null); }} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          )}

          {(file || currentMediaUrl) && mediaType === "video" && (
            <div className="relative bg-card rounded-xl p-3 flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              <span className="text-xs text-foreground truncate">{file?.name || "Current video attached"}</span>
              <button onClick={() => { setFile(null); setPreview(null); setCurrentMediaUrl(null); }} className="ml-auto">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          )}

          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />

          <div className="flex gap-2">
            <button
              onClick={() => { fileRef.current?.setAttribute("accept", "image/*"); fileRef.current?.click(); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ImagePlus className="w-4 h-4 text-green-500" />
              Photo
            </button>
            <button
              onClick={() => { fileRef.current?.setAttribute("accept", "video/*"); fileRef.current?.click(); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Video className="w-4 h-4 text-red-500" />
              Video
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CreatePostSheet;
