import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Music, Play, Pause, Plus, Trash2, Upload, Image, Radio, ChevronDown, Loader2, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GENRES } from "@/lib/genres";
import { uploadToR2, getR2DownloadUrl, deleteFromR2 } from "@/lib/r2-storage";
import { useLikes, incrementSongPlays } from "@/hooks/use-likes";
import album1 from "@/assets/album-1.jpg";

interface Song {
  id: string;
  title: string;
  plays: string;
  duration: string;
  cover_url: string;
  audio_url?: string;
  on_radio?: boolean;
  genre?: string;
  likes_count: number;
}

const RADIO_GENRES = GENRES.filter(g => g !== "Beats");

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const MySongsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [pendingAudioFile, setPendingAudioFile] = useState<File | null>(null);
  const [pendingCover, setPendingCover] = useState<string | null>(null);
  const [publishingSongId, setPublishingSongId] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [uploading, setUploading] = useState(false);

  const songIds = songs.map(s => s.id);
  const { toggleLike, isLiked, getLikeCount } = useLikes("song", songIds);

  useEffect(() => {
    if (user) fetchSongs();
  }, [user]);

  const fetchSongs = async () => {
    const { data, error } = await (supabase as any).from("songs").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
    if (!error && data) {
      setSongs(data.map((s: any) => ({
        id: s.id, title: s.title, plays: s.plays || "0", duration: s.duration || "0:00",
        cover_url: s.cover_url || album1,
        audio_url: s.audio_url ? getR2DownloadUrl(s.audio_url) : undefined,
        on_radio: s.on_radio || false,
        genre: s.genre || undefined,
        likes_count: s.likes_count || 0,
      })));
    }
    setLoading(false);
  };

  const removeSong = async (id: string) => {
    if (playingId === id) { audioRef.current?.pause(); setPlayingId(null); }
    const { data: songData } = await (supabase as any).from("songs").select("audio_url").eq("id", id).single();
    await (supabase as any).from("songs").delete().eq("id", id);
    if (songData?.audio_url) deleteFromR2(songData.audio_url).catch(() => {});
    setSongs(prev => prev.filter(s => s.id !== id));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingAudioFile(file);
    setPendingCover(null);
    toast({ title: "Audio selected", description: "Optionally add a cover image, then confirm upload." });
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingCover(reader.result as string);
    reader.readAsDataURL(file);
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const confirmUpload = () => {
    if (!pendingAudioFile || !user) return;
    const audioUrl = URL.createObjectURL(pendingAudioFile);
    const audio = new Audio(audioUrl);
    audio.addEventListener("loadedmetadata", async () => {
      const title = pendingAudioFile.name.replace(/\.[^/.]+$/, "");
      const duration = formatDuration(audio.duration);
      const cover = pendingCover || null;

      setUploading(true);
      toast({ title: "Uploading to cloud...", description: "Your song is being stored permanently." });

      const r2Result = await uploadToR2(pendingAudioFile, { folder: `${user.id}/songs`, fileName: `${Date.now()}-${pendingAudioFile.name}` });
      if (!r2Result.success) {
        setUploading(false);
        toast({ title: "Upload failed", description: r2Result.error, variant: "destructive" });
        return;
      }

      const { data, error } = await (supabase as any).from("songs").insert({ user_id: user.id, title, duration, cover_url: cover, audio_url: r2Result.data!.key }).select().single();
      if (error) { setUploading(false); toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

      const playbackUrl = getR2DownloadUrl(r2Result.data!.key);
      setSongs(prev => [{ id: data.id, title, plays: "0", duration, cover_url: cover || album1, audio_url: playbackUrl, on_radio: false, likes_count: 0 }, ...prev]);
      setPendingAudioFile(null); setPendingCover(null); setShowUpload(false); setUploading(false);
      toast({ title: "Song uploaded! ☁️", description: `"${title}" is now stored permanently` });
      if (fileInputRef.current) fileInputRef.current.value = "";
      URL.revokeObjectURL(audioUrl);
    });
    audio.addEventListener("error", () => { toast({ title: "Error", description: "Could not read audio file", variant: "destructive" }); });
  };

  const togglePlay = (song: Song) => {
    if (!song.audio_url) return;
    if (playingId === song.id) { audioRef.current?.pause(); setPlayingId(null); }
    else {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = song.audio_url; audioRef.current.play().catch(() => {}); }
      setPlayingId(song.id);
      incrementSongPlays(song.id);
    }
  };

  const handlePublishToRadio = async (songId: string) => {
    if (!selectedGenre) {
      toast({ title: "Select a genre", description: "Pick a genre before publishing to radio", variant: "destructive" });
      return;
    }
    const { error } = await (supabase as any).from("songs").update({ on_radio: true, genre: selectedGenre }).eq("id", songId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, on_radio: true, genre: selectedGenre } : s));
    setPublishingSongId(null);
    setSelectedGenre("");
    toast({ title: "Published to Radio! 📻", description: `Song is now live on WHEUAT Radio under ${selectedGenre}` });
  };

  const handleRemoveFromRadio = async (songId: string) => {
    const { error } = await (supabase as any).from("songs").update({ on_radio: false, genre: null }).eq("id", songId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setSongs(prev => prev.map(s => s.id === songId ? { ...s, on_radio: false, genre: undefined } : s));
    toast({ title: "Removed from Radio", description: "Song is no longer on WHEUAT Radio" });
  };

  if (!user) return <div className="px-4 pt-4 text-center text-muted-foreground text-sm">Please log in to view your songs.</div>;

  return (
    <div className="px-4 pt-4 pb-4">
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} playsInline />
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate("/profile")} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-display font-bold text-foreground">My Songs</h1>
          <p className="text-[10px] text-muted-foreground">{songs.length} tracks uploaded</p>
        </div>
        <button onClick={() => { setShowUpload(!showUpload); setPendingAudioFile(null); setPendingCover(null); }} className="px-3 py-2 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold glow-primary flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Upload
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav,.flac,.aac,.m4a,.ogg" className="hidden" onChange={handleFileSelect} />
      <input ref={coverInputRef} type="file" accept="image/*,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleCoverSelect} />

      {showUpload && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-4 p-4 rounded-xl bg-card border border-dashed border-primary/30">
          {!pendingAudioFile ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <Upload className="w-8 h-8 text-primary" />
              <p className="text-sm text-foreground font-medium">Upload a Song</p>
              <p className="text-[10px] text-muted-foreground text-center">MP3, WAV, FLAC · Max 50MB</p>
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold glow-primary">Choose File</button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-3">
              <p className="text-sm text-foreground font-medium truncate max-w-full">🎵 {pendingAudioFile.name}</p>
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                  {pendingCover ? <img src={pendingCover} alt="Cover" className="w-full h-full object-contain" /> : <Music className="w-6 h-6 text-muted-foreground" />}
                </div>
                <button onClick={() => coverInputRef.current?.click()} className="px-3 py-2 rounded-lg border border-border bg-card text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5" /> {pendingCover ? "Change Cover" : "Add Cover"}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">Cover art is optional</p>
              <div className="flex gap-2">
                <button onClick={() => { setPendingAudioFile(null); setPendingCover(null); }} className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground">Cancel</button>
                <button onClick={confirmUpload} disabled={uploading} className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold glow-primary flex items-center gap-1.5 disabled:opacity-50">
                  {uploading && <Loader2 className="w-3 h-3 animate-spin" />} {uploading ? "Uploading..." : "Upload Song"}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Loading...</div>
      ) : (
        <div className="flex flex-col gap-2">
          {songs.map((song, i) => (
            <div key={song.id}>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all group"
              >
                <button onClick={() => togglePlay(song)} className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0">
                  <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
                  <div className={`absolute inset-0 bg-black/30 flex items-center justify-center transition-opacity ${playingId === song.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                    {playingId === song.id ? (
                      <Pause className="w-4 h-4 text-white fill-white" />
                    ) : (
                      <Play className="w-4 h-4 text-white fill-white" />
                    )}
                  </div>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {`${song.plays} plays · ${song.duration}`}
                  </p>
                  {song.on_radio && (
                    <span className="inline-flex items-center gap-1 text-[9px] text-primary font-semibold mt-0.5">
                      <Radio className="w-2.5 h-2.5" /> On Radio · {song.genre}
                    </span>
                  )}
                </div>
                {/* Like button */}
                <button onClick={() => toggleLike(song.id)} className="flex items-center gap-1 px-1.5">
                  <Heart className={`w-4 h-4 transition-colors ${isLiked(song.id) ? "text-primary fill-primary" : "text-foreground"}`} />
                  <span className="text-xs text-foreground">{getLikeCount(song.id)}</span>
                </button>
                {song.on_radio ? (
                  <button onClick={() => handleRemoveFromRadio(song.id)} className="px-2 py-1.5 rounded-lg border border-primary/30 text-[10px] text-primary font-semibold flex items-center gap-1">
                    <Radio className="w-3 h-3" /> Live
                  </button>
                ) : (
                  <button onClick={() => { setPublishingSongId(publishingSongId === song.id ? null : song.id); setSelectedGenre(""); }} className="px-2 py-1.5 rounded-lg border border-border text-[10px] text-muted-foreground font-semibold flex items-center gap-1 hover:border-primary/30 hover:text-primary transition-all">
                    <Radio className="w-3 h-3" /> Radio
                  </button>
                )}
                <button onClick={() => removeSong(song.id)} className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              </motion.div>

              {/* Publish to Radio Panel */}
              <AnimatePresence>
                {publishingSongId === song.id && !song.on_radio && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 p-3 rounded-xl bg-primary/5 border border-primary/20">
                      <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-primary" /> Publish to WHEUAT Radio
                      </p>
                      <p className="text-[10px] text-muted-foreground mb-3">Select a genre so listeners can find your song in the right station.</p>
                      <div className="relative mb-3">
                        <select
                          value={selectedGenre}
                          onChange={(e) => setSelectedGenre(e.target.value)}
                          className="w-full appearance-none px-3 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground focus:border-primary/50 outline-none"
                        >
                          <option value="">Select Genre...</option>
                          {RADIO_GENRES.map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setPublishingSongId(null)} className="flex-1 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground">Cancel</button>
                        <button onClick={() => handlePublishToRadio(song.id)} className="flex-1 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold glow-primary">Publish</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {!loading && songs.length === 0 && (
        <div className="py-12 text-center">
          <Music className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No songs uploaded yet</p>
          <button onClick={() => setShowUpload(true)} className="mt-3 text-xs text-primary font-semibold">Upload your first song →</button>
        </div>
      )}
    </div>
  );
};

export default MySongsPage;
