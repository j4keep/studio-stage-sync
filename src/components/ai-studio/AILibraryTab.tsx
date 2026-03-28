import { useState, useEffect } from "react";
import { Play, Settings, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const FILTER_TABS = ["All", "AI Music", "AI Cover", "Video"];

type Generation = {
  id: string;
  title: string;
  type: string;
  cover_url: string | null;
  lyrics: string | null;
  genre: string | null;
  mood: string | null;
  created_at: string;
};

const AILibraryTab = () => {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState("All");
  const [songs, setSongs] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGenerations = async () => {
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("ai_generations")
      .select("id, title, type, cover_url, lyrics, genre, mood, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setSongs(data as Generation[]);
    setLoading(false);
  };

  useEffect(() => { fetchGenerations(); }, [user]);

  const handleDelete = async (id: string) => {
    await supabase.from("ai_generations").delete().eq("id", id);
    setSongs((prev) => prev.filter((s) => s.id !== id));
    toast({ title: "Deleted" });
  };

  const filtered = activeFilter === "All" ? songs : songs.filter((s) => s.type === activeFilter);

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">Library</h1>
          <p className="text-xs text-muted-foreground">Your AI Creations</p>
        </div>
      </div>

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

      {loading ? (
        <div className="text-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((song) => (
            <div key={song.id} className="flex items-center gap-3 py-3 border-b border-border/50">
              <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
                {song.cover_url ? (
                  <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <span className="text-lg">🎵</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground truncate block">{song.title}</span>
                <span className="text-xs text-muted-foreground">{song.genre || song.type} · {song.mood || ""}</span>
              </div>
              <button
                onClick={() => handleDelete(song.id)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No songs yet. Create your first track!</p>
        </div>
      )}
    </div>
  );
};

export default AILibraryTab;
