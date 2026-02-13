import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Mic2, Play, Pause, Plus, Trash2, Upload, Image } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import podcast1 from "@/assets/podcast-1.jpg";
import podcast2 from "@/assets/podcast-2.jpg";

interface Podcast {
  id: string;
  title: string;
  episode: string;
  duration: string;
  plays: string;
  img: string;
  audioUrl?: string;
}

const initialPodcasts: Podcast[] = [
  { id: "1", title: "The Artist Journey", episode: "Episode 5", duration: "32 min", plays: "1.2K", img: podcast1 },
  { id: "2", title: "Studio Sessions", episode: "Episode 12", duration: "45 min", plays: "890", img: podcast2 },
  { id: "3", title: "The Artist Journey", episode: "Episode 4", duration: "28 min", plays: "980", img: podcast1 },
];

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  return `${m} min`;
};

const MyPodcastsPage = () => {
  const navigate = useNavigate();
  const [podcasts, setPodcasts] = useState<Podcast[]>(initialPodcasts);
  const [showUpload, setShowUpload] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [pendingAudioFile, setPendingAudioFile] = useState<File | null>(null);
  const [pendingCover, setPendingCover] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const removePodcast = (id: string) => {
    if (playingId === id) { audioRef.current?.pause(); setPlayingId(null); }
    setPodcasts(prev => prev.filter(p => p.id !== id));
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
    if (!pendingAudioFile) return;
    const audioUrl = URL.createObjectURL(pendingAudioFile);
    const audio = new Audio(audioUrl);
    audio.addEventListener("loadedmetadata", () => {
      const newPodcast: Podcast = {
        id: Date.now().toString(),
        title: pendingAudioFile.name.replace(/\.[^/.]+$/, ""),
        episode: "New Episode",
        duration: formatDuration(audio.duration),
        plays: "0",
        img: pendingCover || podcast1,
        audioUrl,
      };
      setPodcasts(prev => [newPodcast, ...prev]);
      setPendingAudioFile(null);
      setPendingCover(null);
      setShowUpload(false);
      toast({ title: "Podcast added!", description: `"${newPodcast.title}" has been uploaded` });
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
    audio.addEventListener("error", () => {
      toast({ title: "Error", description: "Could not read audio file", variant: "destructive" });
    });
  };

  const togglePlay = (p: Podcast) => {
    if (!p.audioUrl) return;
    if (playingId === p.id) { audioRef.current?.pause(); setPlayingId(null); }
    else {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = p.audioUrl; audioRef.current.play().catch(() => {}); }
      setPlayingId(p.id);
    }
  };

  return (
    <div className="px-4 pt-4 pb-4">
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} playsInline />

      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate("/profile")} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-display font-bold text-foreground">My Podcasts</h1>
          <p className="text-[10px] text-muted-foreground">{podcasts.length} episodes uploaded</p>
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
              <p className="text-sm text-foreground font-medium">Upload a Podcast Episode</p>
              <p className="text-[10px] text-muted-foreground text-center">MP3, WAV · Max 200MB</p>
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold glow-primary">Choose File</button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-3">
              <p className="text-sm text-foreground font-medium truncate max-w-full">🎙️ {pendingAudioFile.name}</p>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                  {pendingCover ? (
                    <img src={pendingCover} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <Mic2 className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <button onClick={() => coverInputRef.current?.click()} className="px-3 py-2 rounded-lg border border-border bg-card text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5" />
                  {pendingCover ? "Change Cover" : "Add Cover"}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">Cover art is optional</p>
              <div className="flex gap-2">
                <button onClick={() => { setPendingAudioFile(null); setPendingCover(null); }} className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground">Cancel</button>
                <button onClick={confirmUpload} className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold glow-primary">Upload Episode</button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      <div className="flex flex-col gap-2">
        {podcasts.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all group"
          >
            <button onClick={() => togglePlay(p)} className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0" disabled={!p.audioUrl}>
              <img src={p.img} alt={p.title} className="w-full h-full object-cover" />
              <div className={`absolute inset-0 bg-black/30 flex items-center justify-center transition-opacity ${playingId === p.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"} ${!p.audioUrl ? "hidden" : ""}`}>
                {playingId === p.id ? <Pause className="w-4 h-4 text-white fill-white" /> : <Play className="w-4 h-4 text-white fill-white" />}
              </div>
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
              <p className="text-[10px] text-muted-foreground">{p.episode} · {p.duration} · {p.plays} plays</p>
            </div>
            <button onClick={() => removePodcast(p.id)} className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Trash2 className="w-3 h-3 text-destructive" />
            </button>
          </motion.div>
        ))}
      </div>

      {podcasts.length === 0 && (
        <div className="py-12 text-center">
          <Mic2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No podcasts uploaded yet</p>
          <button onClick={() => setShowUpload(true)} className="mt-3 text-xs text-primary font-semibold">Upload your first episode →</button>
        </div>
      )}
    </div>
  );
};

export default MyPodcastsPage;
