import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Video, Play, Pause, Plus, Trash2, Upload, Image } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import musicvideo1 from "@/assets/musicvideo-1.jpg";
import musicvideo2 from "@/assets/musicvideo-2.jpg";
import album1 from "@/assets/album-1.jpg";
import album2 from "@/assets/album-2.jpg";

interface VideoItem {
  id: string;
  title: string;
  views: string;
  duration: string;
  img: string;
  videoUrl?: string;
}

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const initialVideos: VideoItem[] = [
  { id: "1", title: "Behind The Scenes", views: "2.3K", duration: "5:12", img: musicvideo1 },
  { id: "2", title: "Live Session", views: "4.1K", duration: "8:30", img: album1 },
  { id: "3", title: "Midnight Glow (Official)", views: "45K", duration: "4:02", img: musicvideo2 },
  { id: "4", title: "Studio Vlog #3", views: "1.8K", duration: "12:45", img: album2 },
];

const MyVideosPage = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoItem[]>(initialVideos);
  const [showUpload, setShowUpload] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
  const [pendingCover, setPendingCover] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);

  const removeVideo = (id: string) => {
    if (playingId === id) {
      setPlayingId(null);
    }
    setVideos(prev => prev.filter(v => v.id !== id));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingVideoFile(file);
    setPendingCover(null);
    toast({ title: "Video selected", description: "Optionally add a cover image, then confirm upload." });
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
    if (!pendingVideoFile) return;
    const videoUrl = URL.createObjectURL(pendingVideoFile);
    const tempVideo = document.createElement("video");
    tempVideo.preload = "metadata";
    tempVideo.onloadedmetadata = () => {
      // Generate thumbnail from video if no cover provided
      if (!pendingCover) {
        tempVideo.currentTime = 1;
      }
      const finalize = (cover: string) => {
        const newVideo: VideoItem = {
          id: Date.now().toString(),
          title: pendingVideoFile.name.replace(/\.[^/.]+$/, ""),
          views: "0",
          duration: formatDuration(tempVideo.duration),
          img: cover,
          videoUrl,
        };
        setVideos(prev => [newVideo, ...prev]);
        setPendingVideoFile(null);
        setPendingCover(null);
        setShowUpload(false);
        toast({ title: "Video added!", description: `"${newVideo.title}" has been uploaded` });
        if (fileInputRef.current) fileInputRef.current.value = "";
      };

      if (pendingCover) {
        finalize(pendingCover);
      } else {
        tempVideo.onseeked = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = tempVideo.videoWidth || 320;
            canvas.height = tempVideo.videoHeight || 180;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
            const thumb = canvas.toDataURL("image/jpeg", 0.7);
            finalize(thumb);
          } catch {
            finalize(musicvideo1);
          }
        };
        tempVideo.onerror = () => finalize(musicvideo1);
      }
    };
    tempVideo.onerror = () => {
      toast({ title: "Error", description: "Could not read video file", variant: "destructive" });
    };
    tempVideo.src = videoUrl;
  };

  const togglePlay = (video: VideoItem) => {
    if (!video.videoUrl) return;
    if (playingId === video.id) {
      setPlayingId(null);
    } else {
      setPlayingId(video.id);
    }
  };

  return (
    <div className="px-4 pt-4 pb-4">
      <input ref={fileInputRef} type="file" accept="video/*,.mp4,.mov,.avi,.mkv,.webm,.m4v" className="hidden" onChange={handleFileSelect} />
      <input ref={coverInputRef} type="file" accept="image/*,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleCoverSelect} />

      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate("/profile")} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-display font-bold text-foreground">My Videos</h1>
          <p className="text-[10px] text-muted-foreground">{videos.length} videos uploaded</p>
        </div>
        <button onClick={() => { setShowUpload(!showUpload); setPendingVideoFile(null); setPendingCover(null); }} className="px-3 py-2 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold glow-primary flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Upload
        </button>
      </div>

      {showUpload && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-4 p-4 rounded-xl bg-card border border-dashed border-primary/30">
          {!pendingVideoFile ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <Upload className="w-8 h-8 text-primary" />
              <p className="text-sm text-foreground font-medium">Upload a Video</p>
              <p className="text-[10px] text-muted-foreground text-center">MP4, MOV, WEBM · Max 500MB</p>
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold glow-primary">Choose File</button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-3">
              <p className="text-sm text-foreground font-medium truncate max-w-full">
                🎬 {pendingVideoFile.name}
              </p>

              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                  {pendingCover ? (
                    <img src={pendingCover} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <Video className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <button
                  onClick={() => coverInputRef.current?.click()}
                  className="px-3 py-2 rounded-lg border border-border bg-card text-xs font-medium text-foreground flex items-center gap-1.5"
                >
                  <Image className="w-3.5 h-3.5" />
                  {pendingCover ? "Change Cover" : "Add Cover"}
                </button>
              </div>

              <p className="text-[10px] text-muted-foreground">Cover art is optional · a frame will be used if none selected</p>

              <div className="flex gap-2">
                <button
                  onClick={() => { setPendingVideoFile(null); setPendingCover(null); }}
                  className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmUpload}
                  className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold glow-primary"
                >
                  Upload Video
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {videos.map((v, i) => (
          <motion.div key={v.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="relative rounded-xl overflow-hidden bg-card border border-border group"
          >
            <div className="relative aspect-video">
              {playingId === v.id && v.videoUrl ? (
                <video
                  src={v.videoUrl}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  controls
                  onEnded={() => setPlayingId(null)}
                />
              ) : (
                <>
                  <img src={v.img} alt={v.title} className="w-full h-full object-cover" />
                  <button
                    onClick={() => togglePlay(v)}
                    className="absolute inset-0 bg-black/30 flex items-center justify-center"
                    disabled={!v.videoUrl}
                  >
                    <Play className="w-6 h-6 text-white fill-white" />
                  </button>
                </>
              )}
              <button onClick={() => removeVideo(v.id)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <Trash2 className="w-3 h-3 text-white" />
              </button>
            </div>
            <div className="p-2">
              <p className="text-xs font-medium text-foreground truncate">{v.title}</p>
              <p className="text-[10px] text-muted-foreground">{v.views} views · {v.duration}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {videos.length === 0 && (
        <div className="py-12 text-center">
          <Video className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No videos uploaded yet</p>
          <button onClick={() => setShowUpload(true)} className="mt-3 text-xs text-primary font-semibold">Upload your first video →</button>
        </div>
      )}
    </div>
  );
};

export default MyVideosPage;
