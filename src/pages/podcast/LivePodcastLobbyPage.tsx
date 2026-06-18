import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Bot, CalendarDays, Clapperboard, Download, Film, FolderOpen, Home, Loader2, MessageSquareText, Mic, MoreHorizontal, Plus, Radio, Scissors, Share2, Sparkles, Trash2, Upload, UserPlus, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

type Episode = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  scheduled_at: string | null;
};

type Recording = {
  id: string;
  episode_id: string;
  r2_prefix: string;
  mime_type: string;
  chunk_count: number;
  duration_seconds: number | null;
  status: string;
  created_at: string;
};

const SUPABASE_URL = "https://cdcdlqbjyptamtleitdp.supabase.co";

const LivePodcastLobbyPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [activeTab, setActiveTab] = useState("Recordings");
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [busyRecording, setBusyRecording] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: eps } = await supabase
      .from("podcast_episodes")
      .select("id,title,status,created_at,scheduled_at")
      .eq("host_user_id", user.id)
      .order("created_at", { ascending: false });
    const episodeRows = (eps as Episode[]) ?? [];
    setEpisodes(episodeRows);
    if (episodeRows.length) {
      const { data: recs } = await supabase
        .from("podcast_recordings")
        .select("id,episode_id,r2_prefix,mime_type,chunk_count,duration_seconds,status,created_at")
        .in("episode_id", episodeRows.map((ep) => ep.id))
        .order("created_at", { ascending: false });
      setRecordings((recs as Recording[]) ?? []);
    } else {
      setRecordings([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    return () => Object.values(previewUrls).forEach((url) => URL.revokeObjectURL(url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const episodesWithRecordings = useMemo(() => episodes.map((episode) => ({
    episode,
    takes: recordings.filter((recording) => recording.episode_id === episode.id),
  })), [episodes, recordings]);

  const createEpisode = async () => {
    if (!user) return;
    setCreating(true);
    const room = `pod_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const { data, error } = await supabase
      .from("podcast_episodes")
      .insert({ host_user_id: user.id, title: title.trim() || "Untitled Episode", livekit_room: room })
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
    if (!confirm("Delete this episode and its saved takes?")) return;
    await supabase.from("podcast_episodes").delete().eq("id", id);
    load();
  };

  const fetchRecordingBlob = async (recording: Recording) => {
    const parts: BlobPart[] = [];
    for (let i = 0; i < recording.chunk_count; i += 1) {
      const key = `${recording.r2_prefix}${i.toString().padStart(6, "0")}.webm`;
      const response = await fetch(`${SUPABASE_URL}/functions/v1/r2-download?key=${encodeURIComponent(key)}`);
      if (!response.ok) throw new Error(`Saved video part ${i + 1} could not load.`);
      parts.push(await response.arrayBuffer());
    }
    return new Blob(parts, { type: recording.mime_type || "video/webm" });
  };

  const playRecording = async (recording: Recording) => {
    if (previewUrls[recording.id]) return;
    setBusyRecording(recording.id);
    try {
      const blob = await fetchRecordingBlob(recording);
      setPreviewUrls((urls) => ({ ...urls, [recording.id]: URL.createObjectURL(blob) }));
    } catch (error) {
      toast({ title: "Video not ready", description: error instanceof Error ? error.message : "Try again in a moment.", variant: "destructive" });
    } finally {
      setBusyRecording(null);
    }
  };

  const downloadRecording = async (recording: Recording) => {
    setBusyRecording(recording.id);
    try {
      const blob = await fetchRecordingBlob(recording);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `wheuat-${recording.id}.webm`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Download failed", description: error instanceof Error ? error.message : "Try again in a moment.", variant: "destructive" });
    } finally {
      setBusyRecording(null);
    }
  };

  const uploadEpisodeFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    setUploading(true);
    try {
      const cleanTitle = file.name.replace(/\.[^/.]+$/, "") || "Uploaded Episode";
      const room = `pod_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const { data: episode, error: episodeError } = await supabase
        .from("podcast_episodes")
        .insert({ host_user_id: user.id, title: cleanTitle, livekit_room: room, status: "uploaded" })
        .select("id")
        .single();
      if (episodeError || !episode) throw episodeError || new Error("Episode could not be created.");
      const prefix = `podcast/${episode.id}/upload-${crypto.randomUUID()}/`;
      const key = `${prefix}000000.webm`;
      const upload = await fetch(`${SUPABASE_URL}/functions/v1/r2-upload`, {
        method: "POST",
        headers: { "x-upload-key": key, "x-upload-content-type": file.type || "video/webm", "Content-Type": file.type || "video/webm", "Content-Length": String(file.size) },
        body: file,
      });
      if (!upload.ok) throw new Error("Upload failed.");
      await supabase.from("podcast_recordings").insert({ episode_id: episode.id, uploader_user_id: user.id, mime_type: file.type || "video/webm", r2_prefix: prefix, status: "uploaded", chunk_count: 1, byte_size: file.size });
      toast({ title: "Episode uploaded" });
      load();
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Try another file.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[96px_1fr_380px]">
        <aside className="hidden border-r border-border bg-card/60 px-3 py-5 lg:flex lg:flex-col lg:items-center lg:gap-4">
          <SideIcon icon={<Radio />} label="Studio" active />
          <SideIcon icon={<Home />} label="Home" />
          <SideIcon icon={<FolderOpen />} label="Projects" />
          <SideIcon icon={<CalendarDays />} label="Planner" />
          <SideIcon icon={<MessageSquareText />} label="Messages" />
          <div className="mt-auto" />
          <SideIcon icon={<UserPlus />} label="Invite" />
          <SideIcon icon={<Video />} label="Record" />
        </aside>

        <main className="min-w-0 border-r border-border">
          <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-4 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center gap-3">
              <button onClick={() => navigate("/tv")} className="rounded-md p-2 hover:bg-muted" aria-label="Back to TV"><ArrowLeft className="h-5 w-5" /></button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><span>Projects</span><span>/</span><span className="text-foreground">Podcast</span></div>
                <h1 className="truncate text-2xl font-bold">Your Episodes</h1>
              </div>
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>{uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Upload</Button>
              <Button onClick={createEpisode} disabled={creating}>{creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Create</Button>
              <input ref={fileInputRef} type="file" accept="video/webm,.webm,video/mp4,.mp4,audio/webm,.weba,audio/mpeg,.mp3,audio/wav,.wav" className="hidden" onChange={uploadEpisodeFile} />
            </div>
          </header>

          <section className="mx-auto max-w-6xl space-y-6 px-4 py-5">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">New episode</div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Episode title" className="bg-background" />
                <Button onClick={createEpisode} disabled={creating}>{creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Video className="mr-2 h-4 w-4" />} Record</Button>
              </div>
            </div>

            <nav className="flex flex-wrap gap-2 border-b border-border pb-3">
              {["Recordings", "Made for You", "Edits", "Exports"].map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`rounded-md px-3 py-2 text-sm font-semibold ${activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{tab}</button>)}
            </nav>

            {loading ? <div className="text-sm text-muted-foreground">Loading episodes…</div> : episodes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-10 text-center">
                <Clapperboard className="mx-auto mb-4 h-12 w-12 text-primary" />
                <h2 className="text-xl font-bold">Start creating</h2>
                <p className="mt-2 text-sm text-muted-foreground">Record live, upload a finished video, or open the editor.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <ActionTile icon={<Video />} title="Record" body="Open the studio." onClick={createEpisode} />
                  <ActionTile icon={<Upload />} title="Upload" body="Add video or audio." onClick={() => fileInputRef.current?.click()} />
                  <ActionTile icon={<Scissors />} title="Edit" body="Cut episodes." onClick={createEpisode} />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {episodesWithRecordings.map(({ episode, takes }) => {
                  const primaryTake = takes[0];
                  return (
                    <article key={episode.id} className="rounded-lg border border-border bg-card p-4">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0"><h2 className="truncate text-xl font-bold">{episode.title}</h2><p className="text-xs text-muted-foreground">{new Date(episode.created_at).toLocaleString()} · {takes.length ? `${takes.length} saved take${takes.length > 1 ? "s" : ""}` : "No saved take yet"}</p></div>
                        <div className="flex gap-2"><Link to={`/tv/podcast/${episode.id}`} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Record</Link><Link to={`/tv/podcast/${episode.id}/edit`} className="rounded-md bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground">Edit</Link><button onClick={() => removeEpisode(episode.id)} className="rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="Delete episode"><Trash2 className="h-4 w-4" /></button></div>
                      </div>
                      {primaryTake ? (
                        <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.7fr)_1fr]">
                          <div className="overflow-hidden rounded-lg border border-border bg-background">
                            {previewUrls[primaryTake.id] ? <video src={previewUrls[primaryTake.id]} controls className="aspect-video w-full object-cover" /> : <button onClick={() => playRecording(primaryTake)} className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-muted/40 text-sm text-muted-foreground"><Film className="h-10 w-10 text-primary" />{busyRecording === primaryTake.id ? "Loading saved video…" : "Play saved episode"}</button>}
                          </div>
                          <div className="space-y-3">
                            <div className="grid gap-2 sm:grid-cols-3"><Stat label="Duration" value={formatTime(primaryTake.duration_seconds ?? primaryTake.chunk_count * 5)} /><Stat label="Status" value={primaryTake.status} /><Stat label="Tracks" value="Video + audio" /></div>
                            <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => navigate(`/tv/podcast/${episode.id}/recording/${primaryTake.id}/editor`)}><Scissors className="mr-2 h-4 w-4" /> Cut video/audio</Button><Button variant="outline" onClick={() => downloadRecording(primaryTake)} disabled={busyRecording === primaryTake.id}><Download className="mr-2 h-4 w-4" /> Download episode</Button><Button variant="outline"><Share2 className="mr-2 h-4 w-4" /> Share</Button></div>
                          </div>
                        </div>
                      ) : <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">Record or upload once, then the finished video/audio episode appears here.</div>}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        <aside className="hidden bg-card/40 p-4 lg:block">
          <div className="sticky top-4 rounded-lg border border-border bg-card p-4">
            <div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-2 font-bold"><Bot className="h-5 w-5 text-primary" /> Co-Creator</div><MoreHorizontal className="h-4 w-4 text-muted-foreground" /></div>
            <div className="space-y-3"><Suggestion icon={<Film />} title="Thumbnail" /><Suggestion icon={<Clapperboard />} title="Magic clip" /><Suggestion icon={<Sparkles />} title="Instagram caption" /></div>
            <div className="mt-6 rounded-lg border border-border p-3"><Input placeholder="Ask Co-Creator" className="border-0 bg-transparent focus-visible:ring-0" /><div className="mt-3 flex justify-between text-muted-foreground"><Plus className="h-4 w-4" /><Sparkles className="h-4 w-4" /></div></div>
          </div>
        </aside>
      </div>
    </div>
  );
};

const SideIcon = ({ icon, label, active }: { icon: JSX.Element; label: string; active?: boolean }) => <div className={`flex w-full flex-col items-center gap-1 rounded-lg py-3 text-xs ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{icon}<span>{label}</span></div>;
const ActionTile = ({ icon, title, body, onClick }: { icon: JSX.Element; title: string; body: string; onClick: () => void }) => <button onClick={onClick} className="rounded-lg border border-border bg-card p-4 text-left hover:border-primary/50"><div className="mb-4 text-primary">{icon}</div><div className="font-semibold">{title}</div><div className="text-xs text-muted-foreground">{body}</div></button>;
const Stat = ({ label, value }: { label: string; value: string }) => <div className="rounded-md border border-border bg-background p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="font-semibold capitalize">{value}</div></div>;
const Suggestion = ({ icon, title }: { icon: JSX.Element; title: string }) => <button className="flex w-full items-center gap-3 rounded-lg border border-border bg-background p-3 text-left hover:bg-muted"><span className="text-primary">{icon}</span><span className="font-medium">{title}</span></button>;
const formatTime = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds)) % 60).padStart(2, "0")}`;

export default LivePodcastLobbyPage;