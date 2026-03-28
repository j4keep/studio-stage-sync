import { useState } from "react";
import { Play, Settings } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const FILTER_TABS = ["All", "AI Music", "AI Cover", "Video"];

// Mock data - will be replaced with real data from DB
const MOCK_SONGS = [
  { id: "1", title: "lovely", type: "AI Music", cover: null },
  { id: "2", title: "Teeth On The Floor", type: "AI Cover", cover: null },
  { id: "3", title: "Someone You Loved", type: "AI Cover", cover: null },
  { id: "4", title: "California In My Rearview", type: "AI Music", cover: null },
  { id: "5", title: "With You On The Run", type: "AI Music", cover: null },
];

const AILibraryTab = () => {
  const [activeFilter, setActiveFilter] = useState("All");

  const filtered = activeFilter === "All" ? MOCK_SONGS : MOCK_SONGS.filter((s) => s.type === activeFilter);

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">Library</h1>
          <p className="text-xs text-muted-foreground">Created by MyTunes</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-full bg-card border border-border text-xs font-medium text-muted-foreground flex items-center gap-1">
            💬 Join our Discord
          </button>
          <button className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 my-4 overflow-x-auto scrollbar-hide">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeFilter === tab
                ? "bg-foreground text-background"
                : "bg-card border border-border text-muted-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Song list */}
      <div className="space-y-1">
        {filtered.map((song) => (
          <div key={song.id} className="flex items-center gap-3 py-3 border-b border-border/50">
            <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
              {song.cover ? (
                <img src={song.cover} alt={song.title} className="w-full h-full object-cover rounded-lg" />
              ) : (
                <span className="text-lg">🎵</span>
              )}
            </div>
            <span className="flex-1 text-sm font-medium text-foreground truncate">{song.title}</span>
            <button
              onClick={() => toast({ title: "Playback coming soon!" })}
              className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center shrink-0"
            >
              <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
            </button>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No songs yet. Create your first track!</p>
        </div>
      )}
    </div>
  );
};

export default AILibraryTab;
