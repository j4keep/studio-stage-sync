import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Trash2, Music, Mic } from "lucide-react";
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
  production_notes: string | null;
  bpm: number | null;
  musical_key: string | null;
  created_at: string;
};

const AILibraryTab = () => {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState("All");
  const [songs, setSongs] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchGenerations = async () => {
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("ai_generations")
      .select("id, title, type, cover_url, lyrics, genre, mood, production_notes, bpm, musical_key, created_at")
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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

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
            <div key={song.id} className="border-b border-border/50">
              {/* Song row */}
              <div
                className="flex items-center gap-3 py-3 cursor-pointer"
                onClick={() => setExpandedId(expandedId === song.id ? null : song.id)}
              >
                <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
                  {song.cover_url ? (
                    <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <Music className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate block">{song.title}</span>
                  <span className="text-xs text-muted-foreground">{song.genre || song.type} · {song.mood || ""}</span>
                </div>
                {expandedId === song.id ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </div>

              {/* Expanded details */}
              {expandedId === song.id && (
                <div className="pb-4 pl-13 space-y-3 animate-in slide-in-from-top-2 duration-200">
                  {/* Meta chips */}
                  <div className="flex flex-wrap gap-1.5 pl-[52px]">
                    {song.genre && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                        {song.genre}
                      </span>
                    )}
                    {song.mood && (
                      <span className="px-2 py-0.5 rounded-full bg-accent/50 text-accent-foreground text-[10px] font-medium">
                        {song.mood}
                      </span>
                    )}
                    {song.bpm && (
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium">
                        {song.bpm} BPM
                      </span>
                    )}
                    {song.musical_key && (
                      <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium">
                        Key: {song.musical_key}
                      </span>
                    )}
                  </div>

                  {/* Lyrics */}
                  {song.lyrics && (
                    <div className="pl-[52px]">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Mic className="w-3 h-3" /> Lyrics
                      </p>
                      <div className="bg-card rounded-xl border border-border p-3 max-h-48 overflow-y-auto">
                        <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{song.lyrics}</p>
                      </div>
                    </div>
                  )}

                  {/* Production notes */}
                  {song.production_notes && (
                    <div className="pl-[52px]">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Production Notes</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{song.production_notes}</p>
                    </div>
                  )}

                  {/* Date + delete */}
                  <div className="flex items-center justify-between pl-[52px]">
                    <span className="text-[10px] text-muted-foreground">{formatDate(song.created_at)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(song.id); }}
                      className="px-3 py-1 rounded-full text-xs text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              )}
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
