import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Mic2, Play, Plus, Trash2, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import podcast1 from "@/assets/podcast-1.jpg";
import podcast2 from "@/assets/podcast-2.jpg";

const initialPodcasts = [
  { id: "1", title: "The Artist Journey", episode: "Episode 5", duration: "32 min", plays: "1.2K", img: podcast1 },
  { id: "2", title: "Studio Sessions", episode: "Episode 12", duration: "45 min", plays: "890", img: podcast2 },
  { id: "3", title: "The Artist Journey", episode: "Episode 4", duration: "28 min", plays: "980", img: podcast1 },
];

const MyPodcastsPage = () => {
  const navigate = useNavigate();
  const [podcasts, setPodcasts] = useState(initialPodcasts);
  const [showUpload, setShowUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const removePodcast = (id: string) => setPodcasts(prev => prev.filter(p => p.id !== id));

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const newPodcast = {
      id: Date.now().toString(),
      title: file.name.replace(/\.[^/.]+$/, ""),
      episode: "New Episode",
      duration: "0 min",
      plays: "0",
      img: podcast1,
    };
    setPodcasts(prev => [newPodcast, ...prev]);
    setShowUpload(false);
    toast({ title: "Podcast added!", description: `"${newPodcast.title}" has been uploaded` });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate("/profile")} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-display font-bold text-foreground">My Podcasts</h1>
          <p className="text-[10px] text-muted-foreground">{podcasts.length} episodes uploaded</p>
        </div>
        <button onClick={() => setShowUpload(!showUpload)} className="px-3 py-2 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold glow-primary flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Upload
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileSelect} />

      {showUpload && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-4 p-4 rounded-xl bg-card border border-dashed border-primary/30">
          <div className="flex flex-col items-center gap-3 py-4">
            <Upload className="w-8 h-8 text-primary" />
            <p className="text-sm text-foreground font-medium">Upload a Podcast Episode</p>
            <p className="text-[10px] text-muted-foreground text-center">MP3, WAV · Max 200MB</p>
            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold glow-primary">Choose File</button>
          </div>
        </motion.div>
      )}

      <div className="flex flex-col gap-2">
        {podcasts.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all group"
          >
            <img src={p.img} alt={p.title} className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
              <p className="text-[10px] text-muted-foreground">{p.episode} · {p.duration} · {p.plays} plays</p>
            </div>
            <button onClick={() => removePodcast(p.id)}
              className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-3 h-3 text-destructive" />
            </button>
            <Play className="w-4 h-4 text-primary" />
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
