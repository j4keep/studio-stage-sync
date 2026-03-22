import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Music, Video, Search, X, Check } from "lucide-react";
import { uploadToR2, getR2DownloadUrl } from "@/lib/r2-storage";

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
  const [opponentSearch, setOpponentSearch] = useState("");
  const [selectedOpponent, setSelectedOpponent] = useState<{ user_id: string; display_name: string; avatar_url: string | null } | null>(null);

  const { data: searchResults = [], isFetching: isSearching } = useQuery({
    queryKey: ["search-artists", opponentSearch],
    queryFn: async () => {
      if (opponentSearch.trim().length < 1) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .neq("user_id", user?.id || "")
        .ilike("display_name", `%${opponentSearch.trim()}%`)
        .limit(5);
      return data || [];
    },
    enabled: opponentSearch.trim().length >= 1 && !selectedOpponent,
  });

  const handleSubmit = async () => {
    if (!user || !title.trim() || !trackTitle.trim() || !selectedOpponent) return;
    if (!mediaFile) {
      toast({ title: "Missing media", description: `Please upload a ${mediaType === "audio" ? "song" : "video"} first.`, variant: "destructive" });
      return;
    }
    if (mediaType === "audio" && !coverFile) {
      toast({ title: "Cover art required", description: "Audio battles need a cover image.", variant: "destructive" });
      return;
    }
    setLoading(true);

    try {
      let mediaUrl = "";
      let coverUrl = "";

      // Upload media file
      if (mediaFile) {
        const key = generateR2Key(user.id, "battles", mediaFile.name);
        const result = await uploadToR2(mediaFile, {
          folder: `battles/${user.id}`,
          fileName: `${Date.now()}.${mediaFile.name.split(".").pop()}`,
          mimeType: mediaFile.type,
          onProgress: (p) => console.log(`[Battle] Media upload: ${p}%`),
        });
        if (result.success && result.data) {
          mediaUrl = getR2DownloadUrl(result.data.key);
        } else {
          console.error("[Battle] Media upload failed:", result.error);
          toast({ title: "Upload failed", description: result.error || "Could not upload media file.", variant: "destructive" });
          setLoading(false);
          return;
        }
      }

      // Upload cover file
      if (coverFile) {
        const ext = coverFile.name.split(".").pop();
        const path = `battles/covers/${user.id}/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from("media").upload(path, coverFile);
        if (uploadError) {
          console.error("[Battle] Cover upload failed:", uploadError);
          toast({ title: "Cover upload failed", description: uploadError.message, variant: "destructive" });
          setLoading(false);
          return;
        }
        if (uploadData) {
          const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
          coverUrl = urlData.publicUrl;
        }
      }

      const { error: insertError } = await (supabase as any).from("battles").insert({
        challenger_id: user.id,
        opponent_id: selectedOpponent.user_id,
        title: title.trim(),
        challenger_title: trackTitle.trim(),
        media_type: mediaType,
        challenger_media_url: mediaUrl || null,
        challenger_cover_url: coverUrl || null,
        status: "pending",
      });

      if (insertError) {
        console.error("[Battle] Create battle insert failed:", insertError);
        throw insertError;
      }

      queryClient.invalidateQueries({ queryKey: ["battles"] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
      toast({ title: "Challenge sent! 🥊", description: `${selectedOpponent.display_name} has been challenged!` });
      onOpenChange(false);
      setTitle("");
      setTrackTitle("");
      setMediaFile(null);
      setCoverFile(null);
      setSelectedOpponent(null);
      setOpponentSearch("");
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

          {/* Opponent Search */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Challenge an Artist</label>
            {selectedOpponent ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/30">
                <div className="w-8 h-8 rounded-full bg-primary/20 overflow-hidden flex-shrink-0">
                  {selectedOpponent.avatar_url ? (
                    <img src={selectedOpponent.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-primary">
                      {(selectedOpponent.display_name || "?")[0]}
                    </div>
                  )}
                </div>
                <span className="text-sm font-bold text-foreground flex-1">{selectedOpponent.display_name}</span>
                <button onClick={() => { setSelectedOpponent(null); setOpponentSearch(""); }} className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search artist by name..."
                    value={opponentSearch}
                    onChange={(e) => setOpponentSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {opponentSearch.trim().length >= 1 && (
                  <div className="mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {isSearching ? (
                      <div className="px-3 py-3 text-xs text-muted-foreground text-center">Searching...</div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((p: any) => (
                        <button
                          key={p.user_id}
                          onClick={() => { setSelectedOpponent(p); setOpponentSearch(""); }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="w-7 h-7 rounded-full bg-muted overflow-hidden flex-shrink-0">
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                {(p.display_name || "?")[0]}
                              </div>
                            )}
                          </div>
                          <span className="text-xs font-medium text-foreground">{p.display_name}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-xs text-muted-foreground text-center">No artists found with that name</div>
                    )}
                  </div>
                )}
              </div>
            )}
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
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Cover Art {mediaType === "audio" ? "(required)" : "(optional)"}
            </label>
            <input
              type="file"
              accept="image/*,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
              className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !title.trim() || !trackTitle.trim() || !selectedOpponent || !mediaFile || (mediaType === "audio" && !coverFile)}
            className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
          >
            {loading ? "Creating..." : `🥊 Challenge ${selectedOpponent?.display_name || "an Artist"}`}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CreateBattleSheet;
