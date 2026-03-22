import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Music, Video } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreateBattleSheet = ({ open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [trackTitle, setTrackTitle] = useState("");
  const [mediaType, setMediaType] = useState<"audio" | "video">("audio");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user || !title.trim() || !trackTitle.trim()) return;
    setLoading(true);

    try {
      let mediaUrl = "";
      let coverUrl = "";

      // Upload media if provided
      if (mediaFile) {
        const ext = mediaFile.name.split(".").pop();
        const path = `battles/${user.id}/${Date.now()}.${ext}`;
        const { data: uploadData } = await supabase.storage.from("media").upload(path, mediaFile);
        if (uploadData) {
          const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
          mediaUrl = urlData.publicUrl;
        }
      }

      if (coverFile) {
        const ext = coverFile.name.split(".").pop();
        const path = `battles/covers/${user.id}/${Date.now()}.${ext}`;
        const { data: uploadData } = await supabase.storage.from("media").upload(path, coverFile);
        if (uploadData) {
          const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
          coverUrl = urlData.publicUrl;
        }
      }

      await (supabase as any).from("battles").insert({
        challenger_id: user.id,
        title: title.trim(),
        challenger_title: trackTitle.trim(),
        media_type: mediaType,
        challenger_media_url: mediaUrl || null,
        challenger_cover_url: coverUrl || null,
        status: "open",
      });

      queryClient.invalidateQueries({ queryKey: ["battles"] });
      toast({ title: "Battle created!", description: "Waiting for an opponent to accept." });
      onOpenChange(false);
      setTitle("");
      setTrackTitle("");
      setMediaFile(null);
      setCoverFile(null);
    } catch (err) {
      toast({ title: "Error", description: "Failed to create battle", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">Start a Battle 🥊</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Battle Title</label>
            <Input placeholder='e.g. "Best Bars of 2026"' value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Your Track Title</label>
            <Input placeholder="Name your entry" value={trackTitle} onChange={(e) => setTrackTitle(e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Media Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setMediaType("audio")}
                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border ${mediaType === "audio" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
              >
                <Music className="w-3.5 h-3.5" /> Audio
              </button>
              <button
                onClick={() => setMediaType("video")}
                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border ${mediaType === "video" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
              >
                <Video className="w-3.5 h-3.5" /> Video
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Upload {mediaType === "audio" ? "Song" : "Video"}
            </label>
            <input
              type="file"
              accept={mediaType === "audio" ? "audio/*,.mp3,.wav,.flac,.m4a" : "video/*,.mp4,.mov,.webm"}
              onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
              className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Cover Art (optional)</label>
            <input
              type="file"
              accept="image/*,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
              className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !title.trim() || !trackTitle.trim()}
            className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
          >
            {loading ? "Creating..." : "🔥 Throw Down the Challenge"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CreateBattleSheet;
