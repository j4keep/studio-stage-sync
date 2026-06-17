import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Radio, Plus, Mic, Users, ArrowLeft, Copy, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

type Episode = {
  id: string;
  title: string;
  status: string;
  livekit_room: string;
  created_at: string;
  scheduled_at: string | null;
};

const LivePodcastLobbyPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("podcast_episodes")
      .select("id,title,status,livekit_room,created_at,scheduled_at")
      .eq("host_user_id", user.id)
      .order("created_at", { ascending: false });
    setEpisodes((data as Episode[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const createEpisode = async () => {
    if (!user) return;
    setCreating(true);
    const room = `pod_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const { data, error } = await supabase
      .from("podcast_episodes")
      .insert({
        host_user_id: user.id,
        title: title.trim() || "Untitled Episode",
        livekit_room: room,
      })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast({ title: "Couldn't create episode", description: error?.message, variant: "destructive" });
      return;
    }
    setTitle("");
    navigate(`/tv/podcast/${data.id}`);
  };

  const removeEpisode = async (id: string) => {
    if (!confirm("Delete this episode and all its recordings?")) return;
    await supabase.from("podcast_episodes").delete().eq("id", id);
    load();
  };

  return (
    <div className="px-4 pt-4 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate("/tv")} className="p-2 -ml-2 rounded-full hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Radio className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-bold text-foreground">Live Podcast Studio</h1>
            <p className="text-[11px] text-muted-foreground">Record locally, stream live</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 mb-5">
        <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">New Episode</div>
        <div className="flex gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Episode title (optional)"
            className="bg-background"
          />
          <Button onClick={createEpisode} disabled={creating}>
            <Plus className="w-4 h-4 mr-1" /> Create
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Each guest records locally in their own browser, then chunks upload to your library automatically.
        </p>
      </div>

      <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Your Episodes</div>
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : episodes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No episodes yet. Create one above to start recording.
        </div>
      ) : (
        <div className="space-y-2">
          {episodes.map((ep) => (
            <div
              key={ep.id}
              className="rounded-xl border border-border bg-card p-3 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mic className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">{ep.title}</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <span className="capitalize">{ep.status}</span>
                  <span>•</span>
                  <span>{new Date(ep.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <Link to={`/tv/podcast/${ep.id}/edit`} className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/70">Edit</Link>
              <Link to={`/tv/podcast/${ep.id}`} className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground">Enter</Link>
              <button
                onClick={() => removeEpisode(ep.id)}
                className="p-2 rounded-full hover:bg-muted text-muted-foreground"
                aria-label="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LivePodcastLobbyPage;
