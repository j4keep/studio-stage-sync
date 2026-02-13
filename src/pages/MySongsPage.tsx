import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Music, Play, Pause, MoreHorizontal, Plus, Trash2, Upload, Image } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import album1 from "@/assets/album-1.jpg";

interface Song {
  id: string;
  title: string;
  plays: string;
  duration: string;
  cover_url: string;
  audio_url?: string;
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (user) fetchSongs();
  }, [user]);

  const fetchSongs = async () => {
    const { data, error } = await (supabase as any).from("songs").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
    if (!error && data) {
      setSongs(data.map((s: any) => ({ id: s.id, title: s.title, plays: s.plays || "0", duration: s.duration || "0:00", cover_url: s.cover_url || album1, audio_url: s.audio_url })));
    }
    setLoading(false);
  };

  const removeSong = async (id: string) => {
    if (playingId === id) { audioRef.current?.pause(); setPlayingId(null); }
    await (supabase as any).from("songs").delete().eq("id", id);
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

      const { data, error } = await (supabase as any).from("songs").insert({ user_id: user.id, title, duration, cover_url: cover, audio_url: null }).select().single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

      setSongs(prev => [{ id: data.id, title, plays: "0", duration, cover_url: cover || album1, audio_url: audioUrl }, ...prev]);
      setPendingAudioFile(null); setPendingCover(null); setShowUpload(false);
      toast({ title: "Song added!", description: `"${title}" has been uploaded` });
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
    audio.addEventListener("error", () => { toast({ title: "Error", description: "Could not read audio file", variant: "destructive" }); });
  };

  const togglePlay = (song: Song) => {
    if (!song.audio_url) return;
    if (playingId === song.id) { audioRef.current?.pause(); setPlayingId(null); }
    else {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = song.audio_url; audioRef.current.play().catch(() => {}); }
      setPlayingId(song.id);
    }
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
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                  {pendingCover ? <img src={pendingCover} alt="Cover" className="w-full h-full object-cover" /> : <Music className="w-6 h-6 text-muted-foreground" />}
                </div>
                <button onClick={() => coverInputRef.current?.click()} className="px-3 py-2 rounded-lg border border-border bg-card text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5" /> {pendingCover ? "Change Cover" : "Add Cover"}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">Cover art is optional</p>
              <div className="flex gap-2">
                <button onClick={() => { setPendingAudioFile(null); setPendingCover(null); }} className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground">Cancel</button>
                <button onClick={confirmUpload} className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold glow-primary">Upload Song</button>
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
            <motion.div key={song.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all group"
            >
              <button onClick={() => togglePlay(song)} className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0" disabled={!song.audio_url}>
                <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" />
                <div className={`absolute inset-0 bg-black/30 flex items-center justify-center transition-opacity ${playingId === song.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"} ${!song.audio_url ? "hidden" : ""}`}>
                  {playingId === song.id ? <Pause className="w-4 h-4 text-white fill-white" /> : <Play className="w-4 h-4 text-white fill-white" />}
                </div>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                <p className="text-[10px] text-muted-foreground">{song.plays} plays · {song.duration}</p>
              </div>
              <button onClick={() => removeSong(song.id)} className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="w-3 h-3 text-destructive" />
              </button>
              <button className="text-muted-foreground"><MoreHorizontal className="w-4 h-4" /></button>
            </motion.div>
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
