import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Music, Video, Search, X, Clock, Image, Mic, ChevronLeft, ChevronRight, Rocket } from "lucide-react";
import { uploadToR2, getR2DownloadUrl } from "@/lib/r2-storage";
import { Slider } from "@/components/ui/slider";
import VoiceoverRecorder from "@/components/VoiceoverRecorder";
import { PhotoBattleSongTrimSheet } from "@/components/battle/PhotoBattleSongTrimSheet";
import { PHOTO_BATTLE_SONG_MAX_SEC } from "@/lib/photo-battle-song";
import { preparePhotoBattleSong } from "@/lib/prepare-photo-battle-song";

const STEPS = ["Type", "Title", "Opponent", "Upload", "Review"] as const;


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
  const [photoSongChecking, setPhotoSongChecking] = useState(false);
  const [photoSongTrim, setPhotoSongTrim] = useState<{ file: File; durationSec: number } | null>(null);
  const photoSongInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [opponentSearch, setOpponentSearch] = useState("");
  const [selectedOpponent, setSelectedOpponent] = useState<{ user_id: string; display_name: string; avatar_url: string | null } | null>(null);
  const [maxDuration, setMaxDuration] = useState(20);
  const [mediaDurationMin, setMediaDurationMin] = useState<number | null>(null);
  const [showVoiceover, setShowVoiceover] = useState(false);
  const [hasVoiceover, setHasVoiceover] = useState(false);
  const [step, setStep] = useState(0);
  
  const isPhotoBattle = mediaType === "photo";

  useEffect(() => {
    if (!open) setStep(0);
  }, [open]);

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

  const handlePhotoSongChange = async (file: File | null) => {
    if (!file) {
      setPhotoSongFile(null);
      setPhotoSongTrim(null);
      return;
    }
    setPhotoSongChecking(true);
    try {
      const result = await preparePhotoBattleSong(file);
      if (result.kind === "needs_trim") {
        setPhotoSongFile(null);
        setPhotoSongTrim({ file: result.file, durationSec: result.durationSec });
        toast({
          title: "Trim your song to 30s",
          description: "Photo battles only play a short clip under your photo.",
        });
        return;
      }
      setPhotoSongTrim(null);
      setPhotoSongFile(result.file);
    } catch (err) {
      setPhotoSongFile(null);
      setPhotoSongTrim(null);
      toast({
        title: "Couldn't read song",
        description: err instanceof Error ? err.message : "Try another audio file",
        variant: "destructive",
      });
      if (photoSongInputRef.current) photoSongInputRef.current.value = "";
    } finally {
      setPhotoSongChecking(false);
    }
  };

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

      const { error: insertError } = await supabase.from("battles").insert({
        challenger_id: user.id,
        opponent_id: selectedOpponent.user_id,
        title: title.trim(),
        challenger_title: trackTitle.trim(),
        media_type: mediaType,
        challenger_media_url: mediaUrl || null,
        challenger_cover_url: coverUrl || null,
        status: "pending",
        max_duration_minutes: isPhotoBattle ? 0 : maxDuration,
        battle_background: null,
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
      setMaxDuration(20);
      setMediaDurationMin(null);
      
    } catch (err: any) {
      console.error("[Battle] Create failed:", err);
      toast({ title: "Error", description: err?.message || "Failed to create battle", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = () => {
    if (loading || photoSongChecking || !!photoSongTrim || !title.trim() || !trackTitle.trim() || !selectedOpponent) return true;
    if (isPhotoBattle) return !photoFile;
    return !mediaFile || (mediaType === "audio" && !coverFile) || (mediaDurationMin !== null && mediaDurationMin > maxDuration);
  };

  const canNext = () => {
    if (step === 0) return true;
    if (step === 1) return !!title.trim() && !!trackTitle.trim();
    if (step === 2) return !!selectedOpponent;
    if (step === 3) {
      if (isPhotoBattle) return !!photoFile && !photoSongChecking && !photoSongTrim;
      return !!mediaFile && (mediaType !== "audio" || !!coverFile) && !(mediaDurationMin !== null && mediaDurationMin > maxDuration);
    }
    return !isSubmitDisabled();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="font-display">Launch a Battle</SheetTitle>
        </SheetHeader>

        <div className="mt-3 mb-4 flex items-center gap-1">
          {STEPS.map((label, i) => (
            <div key={label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className={`h-1.5 w-full rounded-full ${
                  i <= step ? "bg-primary" : "bg-muted"
                }`}
              />
              <span className={`truncate text-[9px] font-bold ${i === step ? "text-primary" : "text-muted-foreground"}`}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-2 space-y-4">
          {step === 0 && (
            <div>
              <p className="mb-3 text-sm font-bold text-foreground">Choose battle type</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "audio" as const, label: "Audio", emoji: "🎵", Icon: Music },
                  { id: "video" as const, label: "Video", emoji: "🎥", Icon: Video },
                  { id: "photo" as const, label: "Photo", emoji: "📷", Icon: Image },
                ]).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setMediaType(t.id);
                      if (t.id === "photo") {
                        setMediaFile(null);
                        setCoverFile(null);
                        setMediaDurationMin(null);
                        setPhotoSongFile(null);
                      } else {
                        setPhotoFile(null);
                      }
                    }}
                    className={`rounded-2xl border px-2 py-4 text-center transition ${
                      mediaType === t.id
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    <t.Icon className="mx-auto mb-1.5 h-5 w-5" />
                    <p className="text-xs font-black">{t.emoji} {t.label}</p>
                  </button>
                ))}
              </div>
              {!isPhotoBattle && (
                <div className="mt-4">
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" /> Max duration per entry
                  </label>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[maxDuration]}
                      onValueChange={(v) => setMaxDuration(v[0])}
                      min={0}
                      max={20}
                      step={1}
                      className="flex-1"
                    />
                    <span className="min-w-[3rem] text-right text-sm font-bold text-primary">{maxDuration} min</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Battle title</label>
                <Input placeholder='e.g. "Best Hook 2026"' value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {isPhotoBattle ? "Your caption" : "Your track title"}
                </label>
                <Input
                  placeholder={isPhotoBattle ? 'e.g. "Fresh fit 🔥"' : "Name your entry"}
                  value={trackTitle}
                  onChange={(e) => setTrackTitle(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Invite opponent</label>
              {selectedOpponent ? (
                <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 p-2">
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-primary/20">
                    {selectedOpponent.avatar_url ? (
                      <img src={selectedOpponent.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs font-bold text-primary">
                        {(selectedOpponent.display_name || "?")[0]}
                      </div>
                    )}
                  </div>
                  <span className="flex-1 text-sm font-bold text-foreground">{selectedOpponent.display_name}</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedOpponent(null); setOpponentSearch(""); }}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-muted"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search artist by name..."
                      value={opponentSearch}
                      onChange={(e) => setOpponentSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {opponentSearch.trim().length >= 1 && (
                    <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                      {isSearching ? (
                        <div className="px-3 py-3 text-center text-xs text-muted-foreground">Searching...</div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map((p: any) => (
                          <button
                            key={p.user_id}
                            type="button"
                            onClick={() => { setSelectedOpponent(p); setOpponentSearch(""); }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50"
                          >
                            <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted">
                              {p.avatar_url ? (
                                <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-muted-foreground">
                                  {(p.display_name || "?")[0]}
                                </div>
                              )}
                            </div>
                            <span className="text-xs font-medium text-foreground">{p.display_name}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-3 text-center text-xs text-muted-foreground">No artists found</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              {isPhotoBattle ? (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Upload your photo</label>
                    <input
                      type="file"
                      accept="image/*,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                      className="w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary"
                    />
                    {photoFile && (
                      <div className="mt-2 max-h-40 overflow-hidden rounded-lg">
                        <img src={URL.createObjectURL(photoFile)} alt="Preview" className="h-full w-full object-cover" />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Music className="h-3.5 w-3.5" /> Add a {PHOTO_BATTLE_SONG_MAX_SEC}s song clip (optional)
                    </label>
                    <input
                      ref={photoSongInputRef}
                      type="file"
                      accept="audio/*,.mp3,.wav,.flac,.m4a"
                      onChange={(e) => void handlePhotoSongChange(e.target.files?.[0] || null)}
                      className="w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Longer tracks open a trimmer so you pick a {PHOTO_BATTLE_SONG_MAX_SEC}s section.
                    </p>
                    {photoSongChecking && (
                      <p className="mt-1 text-[10px] text-muted-foreground">Checking song length…</p>
                    )}
                    {photoSongFile && (
                      <p className="mt-1 text-[10px] text-primary">🎵 {photoSongFile.name} · clip ready</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Upload {mediaType === "audio" ? "song" : "video"}
                    </label>
                    <input
                      type="file"
                      accept={mediaType === "audio" ? "audio/*,.mp3,.wav,.flac,.m4a" : "video/*,.mp4,.mov,.webm"}
                      onChange={(e) => handleMediaFileChange(e.target.files?.[0] || null)}
                      className="w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary"
                    />
                    {mediaDurationMin !== null && maxDuration > 0 && (
                      <p className={`mt-1 text-[10px] ${mediaDurationMin > maxDuration ? "font-bold text-destructive" : "text-muted-foreground"}`}>
                        File duration: ~{mediaDurationMin} min {mediaDurationMin > maxDuration ? `(exceeds ${maxDuration} min limit!)` : "✓"}
                      </p>
                    )}
                  </div>
                  {mediaFile && !showVoiceover && (
                    <button
                      type="button"
                      onClick={() => setShowVoiceover(true)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/40 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/5"
                    >
                      <Mic className="h-3.5 w-3.5" /> {hasVoiceover ? "Re-record Voiceover ✓" : "Add Voiceover 🎙️"}
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
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Cover art {mediaType === "audio" ? "(required)" : "(optional)"}
                    </label>
                    <input
                      type="file"
                      accept="image/*,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                      className="w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">Review</p>
              <div className="space-y-1.5 text-sm">
                <p><span className="text-muted-foreground">Type:</span> <span className="font-bold capitalize">{mediaType}</span></p>
                <p><span className="text-muted-foreground">Title:</span> <span className="font-bold">{title}</span></p>
                <p><span className="text-muted-foreground">Your entry:</span> <span className="font-bold">{trackTitle}</span></p>
                <p><span className="text-muted-foreground">Opponent:</span> <span className="font-bold">{selectedOpponent?.display_name}</span></p>
                {!isPhotoBattle && (
                  <p><span className="text-muted-foreground">Max duration:</span> <span className="font-bold">{maxDuration} min</span></p>
                )}
                {isPhotoBattle && photoSongFile && (
                  <p>
                    <span className="text-muted-foreground">Song clip:</span>{" "}
                    <span className="font-bold">{photoSongFile.name}</span>
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Ready to send the challenge? Your opponent uploads next — then the crowd votes.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="flex h-12 items-center justify-center gap-1 rounded-xl border border-border px-4 text-sm font-bold text-foreground"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            ) : null}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                disabled={!canNext()}
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                className="flex h-12 flex-1 items-center justify-center gap-1 rounded-xl bg-foreground text-sm font-black text-background disabled:opacity-45"
              >
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitDisabled()}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-black gradient-primary text-primary-foreground disabled:opacity-50"
              >
                <Rocket className="h-4 w-4" />
                {loading ? "Launching..." : "Launch Battle"}
              </button>
            )}
          </div>
        </div>
      </SheetContent>

      <PhotoBattleSongTrimSheet
        open={!!photoSongTrim}
        file={photoSongTrim?.file ?? null}
        durationSec={photoSongTrim?.durationSec ?? 0}
        onOpenChange={(next) => {
          if (!next) {
            setPhotoSongTrim(null);
            if (!photoSongFile && photoSongInputRef.current) {
              photoSongInputRef.current.value = "";
            }
          }
        }}
        onConfirm={(clipped) => {
          setPhotoSongFile(clipped);
          setPhotoSongTrim(null);
          toast({ title: "30s clip ready", description: "Your photo battle song is trimmed." });
        }}
      />
    </Sheet>
  );
};

export default CreateBattleSheet;
