import { useState, useRef } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { motion } from "framer-motion";
import { ArrowLeft, Mic2, Play, Pause, Plus, Trash2, Upload, Image, Video, Headphones } from "lucide-react";
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
  mediaUrl?: string;
  isVideo?: boolean;
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
  const [podcasts, setPodcasts] = usePersistedState<Podcast[]>("wheuat_my_podcasts", initialPodcasts);
  const [showUpload, setShowUpload] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playMode, setPlayMode] = useState<Record<string, "video" | "audio">>({});
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingCover, setPendingCover] = useState<string | null>(null);
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const removePodcast = (id: string) => {
    if (playingId === id) { audioRef.current?.pause(); setPlayingId(null); setExpandedVideo(null); }
    setPodcasts(prev => prev.filter(p => p.id !== id));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPendingCover(null);
    const type = file.type.startsWith("video") ? "video" : "audio";
    toast({ title: `${type === "video" ? "Video" : "Audio"} selected`, description: "Optionally add a cover image, then confirm upload." });
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
    if (!pendingFile) return;
    const mediaUrl = URL.createObjectURL(pendingFile);
    const isVideo = pendingFile.type.startsWith("video");
    const el = isVideo ? document.createElement("video") : new Audio(mediaUrl);
    if (isVideo) (el as HTMLVideoElement).src = mediaUrl;

    const onMeta = () => {
      const dur = isVideo ? (el as HTMLVideoElement).duration : (el as HTMLAudioElement).duration;

      // Generate thumbnail from video if no cover provided
      if (isVideo && !pendingCover) {
        const vidEl = el as HTMLVideoElement;
        vidEl.currentTime = 1;
        vidEl.addEventListener("seeked", () => {
          const canvas = document.createElement("canvas");
          canvas.width = vidEl.videoWidth;
          canvas.height = vidEl.videoHeight;
          canvas.getContext("2d")?.drawImage(vidEl, 0, 0);
          const thumb = canvas.toDataURL("image/jpeg");
          addPodcast(dur, mediaUrl, isVideo, thumb);
        }, { once: true });
      } else {
        addPodcast(dur, mediaUrl, isVideo, pendingCover || podcast1);
      }
    };

    const addPodcast = (dur: number, url: string, video: boolean, cover: string) => {
      const newPodcast: Podcast = {
        id: Date.now().toString(),
        title: pendingFile!.name.replace(/\.[^/.]+$/, ""),
        episode: "New Episode",
        duration: formatDuration(dur),
        plays: "0",
        img: cover,
        mediaUrl: url,
        isVideo: video,
      };
      setPodcasts(prev => [newPodcast, ...prev]);
      setPendingFile(null);
      setPendingCover(null);
      setShowUpload(false);
      toast({ title: "Podcast added!", description: `"${newPodcast.title}" has been uploaded` });
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("error", () => {
      toast({ title: "Error", description: "Could not read media file", variant: "destructive" });
    });
  };

  const getMode = (p: Podcast): "video" | "audio" => playMode[p.id] || (p.isVideo ? "video" : "audio");

  const togglePlay = (p: Podcast) => {
    if (!p.mediaUrl) return;
    const mode = getMode(p);

    if (playingId === p.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      setExpandedVideo(null);
    } else {
      if (mode === "video" && p.isVideo) {
        // Stop any audio playing
        audioRef.current?.pause();
        setExpandedVideo(p.id);
        setPlayingId(p.id);
      } else {
        setExpandedVideo(null);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = p.mediaUrl;
          audioRef.current.play().catch(() => {});
        }
        setPlayingId(p.id);
      }
    }
  };

  const switchMode = (p: Podcast, mode: "video" | "audio") => {
    setPlayMode(prev => ({ ...prev, [p.id]: mode }));
    // Stop current playback when switching
    if (playingId === p.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      setExpandedVideo(null);
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
        <button onClick={() => { setShowUpload(!showUpload); setPendingFile(null); setPendingCover(null); }} className="px-3 py-2 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold glow-primary flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Upload
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="audio/*,video/*,.mp3,.wav,.flac,.aac,.m4a,.ogg,.mp4,.mov,.avi,.mkv,.webm" className="hidden" onChange={handleFileSelect} />
      <input ref={coverInputRef} type="file" accept="image/*,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleCoverSelect} />

      {showUpload && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-4 p-4 rounded-xl bg-card border border-dashed border-primary/30">
          {!pendingFile ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <Upload className="w-8 h-8 text-primary" />
              <p className="text-sm text-foreground font-medium">Upload a Podcast Episode</p>
              <p className="text-[10px] text-muted-foreground text-center">Audio (MP3, WAV) or Video (MP4, MOV)</p>
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold glow-primary">Choose File</button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-3">
              <p className="text-sm text-foreground font-medium truncate max-w-full">
                {pendingFile.type.startsWith("video") ? "🎬" : "🎙️"} {pendingFile.name}
              </p>
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
                <button onClick={() => { setPendingFile(null); setPendingCover(null); }} className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground">Cancel</button>
                <button onClick={confirmUpload} className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold glow-primary">Upload Episode</button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      <div className="flex flex-col gap-2">
        {podcasts.map((p, i) => {
          const mode = getMode(p);
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all group">
                <button onClick={() => togglePlay(p)} className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0" disabled={!p.mediaUrl}>
                  <img src={p.img} alt={p.title} className="w-full h-full object-cover" />
                  <div className={`absolute inset-0 bg-black/30 flex items-center justify-center transition-opacity ${playingId === p.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"} ${!p.mediaUrl ? "hidden" : ""}`}>
                    {playingId === p.id ? <Pause className="w-4 h-4 text-white fill-white" /> : <Play className="w-4 h-4 text-white fill-white" />}
                  </div>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                  <p className="text-[10px] text-muted-foreground">{p.episode} · {p.duration} · {p.plays} plays</p>
                </div>
                {/* Video/Audio toggle for video podcasts */}
                {p.isVideo && p.mediaUrl && (
                  <div className="flex rounded-lg border border-border overflow-hidden">
                    <button
                      onClick={() => switchMode(p, "video")}
                      className={`p-1.5 transition-colors ${mode === "video" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
                      title="Play as video"
                    >
                      <Video className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => switchMode(p, "audio")}
                      className={`p-1.5 transition-colors ${mode === "audio" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
                      title="Play audio only"
                    >
                      <Headphones className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <button onClick={() => removePodcast(p.id)} className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              </div>
              {/* Expanded video player */}
              {expandedVideo === p.id && p.mediaUrl && p.isVideo && mode === "video" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-1 rounded-xl overflow-hidden bg-black">
                  <video
                    src={p.mediaUrl}
                    controls
                    autoPlay
                    playsInline
                    className="w-full max-h-[280px] object-contain"
                    onEnded={() => { setPlayingId(null); setExpandedVideo(null); }}
                  />
                </motion.div>
              )}
            </motion.div>
          );
        })}
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
