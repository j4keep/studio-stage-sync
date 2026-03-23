import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Music, Video, Search, X, Clock, Image, Mic } from "lucide-react";
import { uploadToR2, getR2DownloadUrl } from "@/lib/r2-storage";
import { Slider } from "@/components/ui/slider";
import VoiceoverRecorder from "@/components/VoiceoverRecorder";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getMediaDuration = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = file.type.startsWith("video") ? document.createElement("video") : document.createElement("audio");
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const dur = el.duration;
      URL.revokeObjectURL(url);
      resolve(Math.ceil(dur / 60));
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read media duration"));
    };
    el.src = url;
  });
};

const CreateBattleSheet = ({ open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [trackTitle, setTrackTitle] = useState("");
  const [mediaType, setMediaType] = useState<"audio" | "video" | "photo">("audio");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoSongFile, setPhotoSongFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [opponentSearch, setOpponentSearch] = useState("");
  const [selectedOpponent, setSelectedOpponent] = useState<{ user_id: string; display_name: string; avatar_url: string | null } | null>(null);
  const [maxDuration, setMaxDuration] = useState(40);
  const [mediaDurationMin, setMediaDurationMin] = useState<number | null>(null);
  const [showVoiceover, setShowVoiceover] = useState(false);
  const [hasVoiceover, setHasVoiceover] = useState(false);
  const isPhotoBattle = mediaType === "photo";

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

  const handleMediaFileChange = async (file: File | null) => {
    setMediaFile(file);
    setMediaDurationMin(null);
    setHasVoiceover(false);
    setShowVoiceover(false);
    if (file) {
      try {
        const dur = await getMediaDuration(file);
        setMediaDurationMin(dur);
        if (dur > maxDuration) {
          toast({ title: "File too long", description: `Your file is ~${dur} min. Max is ${maxDuration} min. Please trim it or increase the battle duration.`, variant: "destructive" });
        }
      } catch {
        // can't detect duration, allow upload
      }
    }
  };

  const handleSubmit = async () => {
    if (!user || !title.trim() || !trackTitle.trim() || !selectedOpponent) return;

    if (isPhotoBattle) {
      if (!photoFile) {
        toast({ title: "Missing photo", description: "Please upload your photo for the battle.", variant: "destructive" });
        return;
      }
    } else {
      if (!mediaFile) {
        toast({ title: "Missing media", description: `Please upload a ${mediaType === "audio" ? "song" : "video"} first.`, variant: "destructive" });
        return;
      }
      if (mediaType === "audio" && !coverFile) {
        toast({ title: "Cover art required", description: "Audio battles need a cover image.", variant: "destructive" });
        return;
      }
      if (mediaDurationMin && mediaDurationMin > maxDuration) {
        toast({ title: "File too long", description: `Your file is ~${mediaDurationMin} min but the battle limit is ${maxDuration} min. Please trim it.`, variant: "destructive" });
        return;
      }
    }

    setLoading(true);

    try {
      let mediaUrl = "";
      let coverUrl = "";

      if (isPhotoBattle && photoFile) {
        // For photo battles, the photo IS the cover
        const ext = photoFile.name.split(".").pop();
        const result = await uploadToR2(photoFile, {
          folder: `battles/photos/${user.id}`,
          fileName: `${Date.now()}.${ext}`,
          mimeType: photoFile.type,
        });
        if (result.success && result.data) {
          coverUrl = getR2DownloadUrl(result.data.key);
        } else {
          toast({ title: "Upload failed", description: result.error || "Could not upload photo.", variant: "destructive" });
          setLoading(false);
          return;
        }
        // Optional song for photo battle
        if (photoSongFile) {
          const songExt = photoSongFile.name.split(".").pop();
          const songResult = await uploadToR2(photoSongFile, {
            folder: `battles/${user.id}`,
            fileName: `${Date.now()}.${songExt}`,
            mimeType: photoSongFile.type,
          });
          if (songResult.success && songResult.data) {
            mediaUrl = getR2DownloadUrl(songResult.data.key);
          }
        }
      } else {
        if (mediaFile) {
          const fileExtension = mediaFile.name.split(".").pop();
          const uploadResult = await uploadToR2(mediaFile, {
            folder: `battles/${user.id}`,
            fileName: `${Date.now()}.${fileExtension}`,
            mimeType: mediaFile.type,
            onProgress: (p) => console.log(`[Battle] Media upload: ${p}%`),
          });
          if (uploadResult.success && uploadResult.data) {
            mediaUrl = getR2DownloadUrl(uploadResult.data.key);
          } else {
            toast({ title: "Upload failed", description: uploadResult.error || "Could not upload media file.", variant: "destructive" });
            setLoading(false);
            return;
          }
        }

        if (coverFile) {
          const ext = coverFile.name.split(".").pop();
          const coverResult = await uploadToR2(coverFile, {
            folder: `battles/covers/${user.id}`,
            fileName: `${Date.now()}.${ext}`,
            mimeType: coverFile.type,
          });
          if (coverResult.success && coverResult.data) {
            coverUrl = getR2DownloadUrl(coverResult.data.key);
          } else {
            toast({ title: "Cover upload failed", description: coverResult.error || "Could not upload cover.", variant: "destructive" });
            setLoading(false);
            return;
          }
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
        max_duration_minutes: isPhotoBattle ? 0 : maxDuration,
      });

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["battles"] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
      toast({ title: "Challenge sent! 🥊", description: `${selectedOpponent.display_name} has been challenged!` });
      onOpenChange(false);
      setTitle("");
      setTrackTitle("");
      setMediaFile(null);
      setCoverFile(null);
      setPhotoFile(null);
      setPhotoSongFile(null);
      setSelectedOpponent(null);
      setOpponentSearch("");
      setMaxDuration(40);
      setMediaDurationMin(null);
      setSelectedBackground("none");
    } catch (err) {
      toast({ title: "Error", description: "Failed to create battle", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = () => {
    if (loading || !title.trim() || !trackTitle.trim() || !selectedOpponent) return true;
    if (isPhotoBattle) return !photoFile;
    return !mediaFile || (mediaType === "audio" && !coverFile) || (mediaDurationMin !== null && mediaDurationMin > maxDuration);
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
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {isPhotoBattle ? "Caption / Title" : "Your Track Title"}
            </label>
            <Input placeholder={isPhotoBattle ? "e.g. \"Fresh fit 🔥\"" : "Name your entry"} value={trackTitle} onChange={(e) => setTrackTitle(e.target.value)} />
          </div>

          {/* Media Type */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Battle Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => { setMediaType("audio"); setPhotoFile(null); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border ${mediaType === "audio" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
              >
                <Music className="w-3.5 h-3.5" /> Audio
              </button>
              <button
                onClick={() => { setMediaType("video"); setPhotoFile(null); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border ${mediaType === "video" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
              >
                <Video className="w-3.5 h-3.5" /> Video
              </button>
              <button
                onClick={() => { setMediaType("photo"); setMediaFile(null); setCoverFile(null); setMediaDurationMin(null); setPhotoSongFile(null); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border ${mediaType === "photo" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
              >
                <Image className="w-3.5 h-3.5" /> Photo
              </button>
            </div>
          </div>

          {/* Duration slider — only for audio/video */}
          {!isPhotoBattle && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Max Duration Per Entry
              </label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[maxDuration]}
                  onValueChange={(v) => setMaxDuration(v[0])}
                  min={0}
                  max={40}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm font-bold text-primary min-w-[3rem] text-right">{maxDuration} min</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {maxDuration === 0
                  ? "No duration limit set — any length accepted."
                  : `Each artist's entry must be ${maxDuration} min or less. Total battle: up to ${maxDuration * 2} min.`}
              </p>
            </div>
          )}

          {/* Photo upload for photo battles */}
          {isPhotoBattle && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Upload Your Photo</label>
                <input
                  type="file"
                  accept="image/*,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary"
                />
                {photoFile && (
                  <div className="mt-2 rounded-lg overflow-hidden max-h-40">
                    <img src={URL.createObjectURL(photoFile)} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5" /> Add a Song (optional)
                </label>
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.flac,.m4a"
                  onChange={(e) => setPhotoSongFile(e.target.files?.[0] || null)}
                  className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary"
                />
                {photoSongFile && (
                  <p className="text-[10px] text-muted-foreground mt-1">🎵 {photoSongFile.name}</p>
                )}
              </div>
            </>
          )}

          {/* Media upload for audio/video */}
          {!isPhotoBattle && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Upload {mediaType === "audio" ? "Song" : "Video"}
                </label>
                <input
                  type="file"
                  accept={mediaType === "audio" ? "audio/*,.mp3,.wav,.flac,.m4a" : "video/*,.mp4,.mov,.webm"}
                  onChange={(e) => handleMediaFileChange(e.target.files?.[0] || null)}
                  className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary"
                />
                {mediaDurationMin !== null && maxDuration > 0 && (
                  <p className={`text-[10px] mt-1 ${mediaDurationMin > maxDuration ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                    File duration: ~{mediaDurationMin} min {mediaDurationMin > maxDuration ? `(exceeds ${maxDuration} min limit!)` : "✓"}
                  </p>
                )}
              </div>

              {/* Voiceover option */}
              {mediaFile && !showVoiceover && (
                <button
                  onClick={() => setShowVoiceover(true)}
                  className="w-full py-2 rounded-lg border border-dashed border-primary/40 text-xs font-bold text-primary flex items-center justify-center gap-1.5 hover:bg-primary/5 transition-colors"
                >
                  <Mic className="w-3.5 h-3.5" /> {hasVoiceover ? "Re-record Voiceover ✓" : "Add Voiceover 🎙️"}
                </button>
              )}

              {mediaFile && showVoiceover && (
                <VoiceoverRecorder
                  mediaFile={mediaFile}
                  mediaType={mediaType}
                  onMixedFile={(mixed) => {
                    setMediaFile(mixed);
                    setHasVoiceover(true);
                    setShowVoiceover(false);
                    toast({ title: "Voiceover applied! 🎙️", description: "Your voice has been mixed with the track." });
                  }}
                  onCancel={() => setShowVoiceover(false)}
                />
              )}

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
            </>
          )}

          {/* Battle Background Picker */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Battle Background</label>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {BATTLE_BACKGROUNDS.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => setSelectedBackground(bg.id)}
                  className={`flex-shrink-0 w-14 h-14 rounded-xl border-2 overflow-hidden relative transition-all ${
                    selectedBackground === bg.id ? "border-primary ring-2 ring-primary/30" : "border-border"
                  }`}
                >
                  {bg.src ? (
                    <img src={bg.src} alt={bg.label} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-background flex items-center justify-center text-lg">
                      {bg.emoji}
                    </div>
                  )}
                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-white text-center py-0.5 font-medium">
                    {bg.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitDisabled()}
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
