import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Video, Play, Plus, Trash2, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import musicvideo1 from "@/assets/musicvideo-1.jpg";
import musicvideo2 from "@/assets/musicvideo-2.jpg";
import album1 from "@/assets/album-1.jpg";
import album2 from "@/assets/album-2.jpg";

const initialVideos = [
  { id: "1", title: "Behind The Scenes", views: "2.3K", duration: "5:12", img: musicvideo1 },
  { id: "2", title: "Live Session", views: "4.1K", duration: "8:30", img: album1 },
  { id: "3", title: "Midnight Glow (Official)", views: "45K", duration: "4:02", img: musicvideo2 },
  { id: "4", title: "Studio Vlog #3", views: "1.8K", duration: "12:45", img: album2 },
];

const MyVideosPage = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState(initialVideos);
  const [showUpload, setShowUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const removeVideo = (id: string) => setVideos(prev => prev.filter(v => v.id !== id));

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const newVideo = {
      id: Date.now().toString(),
      title: file.name.replace(/\.[^/.]+$/, ""),
      views: "0",
      duration: "0:00",
      img: musicvideo1,
    };
    setVideos(prev => [newVideo, ...prev]);
    setShowUpload(false);
    toast({ title: "Video added!", description: `"${newVideo.title}" has been uploaded` });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate("/profile")} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-display font-bold text-foreground">My Videos</h1>
          <p className="text-[10px] text-muted-foreground">{videos.length} videos uploaded</p>
        </div>
        <button onClick={() => setShowUpload(!showUpload)} className="px-3 py-2 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold glow-primary flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Upload
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />

      {showUpload && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-4 p-4 rounded-xl bg-card border border-dashed border-primary/30">
          <div className="flex flex-col items-center gap-3 py-4">
            <Upload className="w-8 h-8 text-primary" />
            <p className="text-sm text-foreground font-medium">Upload a Video</p>
            <p className="text-[10px] text-muted-foreground text-center">MP4, MOV · Max 500MB</p>
            <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold glow-primary">Choose File</button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {videos.map((v, i) => (
          <motion.div key={v.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="relative rounded-xl overflow-hidden bg-card border border-border group"
          >
            <div className="relative aspect-video">
              <img src={v.img} alt={v.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <Play className="w-6 h-6 text-white fill-white" />
              </div>
              <button onClick={() => removeVideo(v.id)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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
