import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Music, Play, MoreHorizontal, Plus, Trash2, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import album1 from "@/assets/album-1.jpg";
import album2 from "@/assets/album-2.jpg";
import album3 from "@/assets/album-3.jpg";
import album4 from "@/assets/album-4.jpg";
import album5 from "@/assets/album-5.jpg";

const initialSongs = [
  { id: "1", title: "Midnight Flow", plays: "12.4K", duration: "3:42", img: album1 },
  { id: "2", title: "City Lights", plays: "8.1K", duration: "4:15", img: album2 },
  { id: "3", title: "Rise Above", plays: "15.7K", duration: "3:28", img: album3 },
  { id: "4", title: "Echoes", plays: "5.3K", duration: "4:01", img: album4 },
  { id: "5", title: "Golden Hour", plays: "3.9K", duration: "3:55", img: album5 },
];

const MySongsPage = () => {
  const navigate = useNavigate();
  const [songs, setSongs] = useState(initialSongs);
  const [showUpload, setShowUpload] = useState(false);

  const removeSong = (id: string) => {
    setSongs(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate("/profile")} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-display font-bold text-foreground">My Songs</h1>
          <p className="text-[10px] text-muted-foreground">{songs.length} tracks uploaded</p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="px-3 py-2 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold glow-primary flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Upload
        </button>
      </div>

      {showUpload && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mb-4 p-4 rounded-xl bg-card border border-dashed border-primary/30"
        >
          <div className="flex flex-col items-center gap-3 py-4">
            <Upload className="w-8 h-8 text-primary" />
            <p className="text-sm text-foreground font-medium">Upload a Song</p>
            <p className="text-[10px] text-muted-foreground text-center">MP3, WAV, FLAC · Max 50MB</p>
            <button className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold glow-primary">
              Choose File
            </button>
          </div>
        </motion.div>
      )}

      <div className="flex flex-col gap-2">
        {songs.map((song, i) => (
          <motion.div
            key={song.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all group"
          >
            <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0">
              <img src={song.img} alt={song.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="w-4 h-4 text-white fill-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
              <p className="text-[10px] text-muted-foreground">{song.plays} plays · {song.duration}</p>
            </div>
            <button
              onClick={() => removeSong(song.id)}
              className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-3 h-3 text-destructive" />
            </button>
            <button className="text-muted-foreground">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </div>

      {songs.length === 0 && (
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
