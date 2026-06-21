import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  ChevronDown,
  Clapperboard,
  Copy,
  Download,
  Edit3,
  Film,
  FolderOpen,
  Gauge,
  HelpCircle,
  Home,
  Loader2,
  MessageSquareText,
  MoreHorizontal,
  Radio,
  Scissors,
  Search,
  Settings,
  Trash2,
  Upload,
  Users,
  Video,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import PodcastScheduleSheet from "./PodcastScheduleSheet";
import PodcastScheduleDashboard from "./PodcastScheduleDashboard";
import {
  PodcastSessionStore,
  schedulePodcastReminders,
  evaluateJoinGate,
  type ScheduledPodcastSession,
} from "./podcastSessionStore";
import { PodcastFinals, type FinalRecording } from "./podcastRecoveryStore";
import PodcastEditorPro from "./PodcastEditorPro";

type Episode = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  scheduled_at: string | null;
  is_streaming?: boolean | null;
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

type ViewMode = "home" | "projects" | "planner";

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
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [busyRecording, setBusyRecording] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleStartNow, setScheduleStartNow] = useState(false);
  const [editingSession, setEditingSession] = useState<ScheduledPodcastSession | null>(null);
  const [localFinals, setLocalFinals] = useState<FinalRecording[]>([]);
  const [editingLocal, setEditingLocal] = useState<FinalRecording | null>(null);
  const [editingLocalUrl, setEditingLocalUrl] = useState<string>("");

  const loadLocalFinals = async () => {
    try { setLocalFinals(await PodcastFinals.list()); } catch {}
  };
  useEffect(() => {
    loadLocalFinals();
    const onVis = () => { if (document.visibilityState === "visible") loadLocalFinals(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const deleteLocal = async (rec: FinalRecording) => {
    if (!confirm(`Delete "${rec.title}"? This cannot be undone.`)) return;
    await PodcastFinals.delete(rec.id);
    setLocalFinals((rs) => rs.filter((r) => r.id !== rec.id));
    toast({ title: "Recording deleted" });
  };

  const downloadLocal = (rec: FinalRecording) => {
    const url = URL.createObjectURL(rec.blob);
    const a = document.createElement("a");
    a.href = url; a.download = rec.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const openLocalEditor = (rec: FinalRecording) => {
    const url = URL.createObjectURL(rec.blob);
    setEditingLocalUrl(url);
    setEditingLocal(rec);
  };
  const closeLocalEditor = () => {
    if (editingLocalUrl) URL.revokeObjectURL(editingLocalUrl);
    setEditingLocalUrl("");
    setEditingLocal(null);
  };

  const renameLocal = async (rec: FinalRecording) => {
    const next = prompt("Rename recording", rec.title);
    if (!next || next.trim() === rec.title) return;
    await PodcastFinals.update(rec.id, { title: next.trim() });
    setLocalFinals((rs) => rs.map((r) => r.id === rec.id ? { ...r, title: next.trim() } : r));
  };

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: eps, error: epsError } = await supabase
      .from("podcast_episodes")
      .select("id,title,status,created_at,scheduled_at,is_streaming")
      .eq("host_user_id", user.id)
      .order("created_at", { ascending: false });

    if (epsError) {
      toast({ title: "Episodes could not load", description: epsError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

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
    const stop = schedulePodcastReminders();
    return () => {
      Object.values(previewUrls).forEach((url) => URL.revokeObjectURL(url));
      if (stop) stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const openScheduleModal = (startNow: boolean) => {
    setEditingSession(null);
    setScheduleStartNow(startNow);
    setScheduleOpen(true);
  };

  const handleScheduleSaved = (s: ScheduledPodcastSession) => {
    const gate = evaluateJoinGate(s);
    if (gate.kind === "open" || gate.kind === "live") {
      PodcastSessionStore.markLive(s.id);
      navigate(`/podcast/room/${s.id}`);
    } else {
      setViewMode("planner");
      toast({ title: "Session scheduled", description: new Date(s.scheduledAt).toLocaleString() });
    }
  };

  const episodeRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return episodes
      .filter((episode) => !normalizedSearch || episode.title.toLowerCase().includes(normalizedSearch))
      .map((episode) => ({
        episode,
        takes: recordings.filter((recording) => recording.episode_id === episode.id),
      }));
  }, [episodes, recordings, search]);

  const recentRows = useMemo(() => episodeRows.filter(({ takes }) => takes.length > 0).slice(0, 8), [episodeRows]);
  const nextScheduled = useMemo(() => episodes.filter((ep) => ep.scheduled_at).slice(0, 4), [episodes]);

  const createEpisode = async (mode: "record" | "edit" | "live" | "schedule" = "record") => {
    if (!user) return;
    setCreating(true);
    const room = `pod_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const nextTitle = title.trim() || (mode === "schedule" ? "Scheduled Episode" : "Untitled Episode");
    const scheduled_at = mode === "schedule" ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : null;
    const { data, error } = await supabase
      .from("podcast_episodes")
      .insert({ host_user_id: user.id, title: nextTitle, livekit_room: room, scheduled_at })
      .select("id")
      .single();
    setCreating(false);
    if (error || !data) {
      toast({ title: "Couldn't create episode", description: error?.message, variant: "destructive" });
      return;
    }
    setTitle("");
    if (mode === "edit") navigate(`/tv/podcast/${data.id}/edit`);
    else if (mode === "schedule") {
      setViewMode("planner");
      toast({ title: "Episode scheduled", description: "Open the studio when you're ready to record." });
      load();
    } else navigate(`/tv/podcast/${data.id}`);
  };

  const openLatestEditor = () => {
    const firstWithRecording = episodeRows.find(({ takes }) => takes.length > 0);
    if (firstWithRecording) {
      navigate(`/tv/podcast/${firstWithRecording.episode.id}/recording/${firstWithRecording.takes[0].id}/editor`);
      return;
    }
    if (episodes[0]) navigate(`/tv/podcast/${episodes[0].id}/edit`);
    else createEpisode("edit");
  };

  const removeEpisode = async (id: string) => {
    if (!confirm("Delete this episode and its saved recording?")) return;
    await supabase.from("podcast_episodes").delete().eq("id", id);
    setOpenMenu(null);
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
      anchor.download = `wheuat-podcast-${recording.id}.webm`;
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

  const copyPreviewLink = async (episodeId: string) => {
    const link = `${window.location.origin}/#/tv/podcast/${episodeId}/edit`;
    await navigator.clipboard.writeText(link);
    toast({ title: "Project link copied" });
    setOpenMenu(null);
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
      toast({ title: "Episode uploaded", description: "Your video/audio is now in Projects." });
      setViewMode("projects");
      load();
    } catch (error) {
      toast({ title: "Upload failed", description: error instanceof Error ? error.message : "Try another file.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const activeRows = viewMode === "home" ? recentRows : episodeRows;

  return (
    <div className="dark min-h-screen bg-background text-foreground lg:h-screen lg:overflow-hidden">
      <div className="grid min-h-screen lg:h-screen lg:grid-cols-[104px_minmax(0,1fr)]">
        <aside className="hidden border-r border-border bg-card/70 lg:flex lg:flex-col lg:items-center lg:gap-2 lg:px-3 lg:py-4">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground"><Radio className="h-6 w-6" /></div>
          <SideButton icon={<Home />} label="Home" active={viewMode === "home"} onClick={() => setViewMode("home")} />
          <SideButton icon={<Users />} label="People" onClick={() => navigate("/podcast/contacts")} />
          <SideButton icon={<FolderOpen />} label="Projects" active={viewMode === "projects"} onClick={() => setViewMode("projects")} />
          <SideButton icon={<CalendarDays />} label="Planner" active={viewMode === "planner"} onClick={() => setViewMode("planner")} />
          <SideButton icon={<MessageSquareText />} label="Messages" onClick={() => navigate("/messages")} />
          <SideButton icon={<Settings />} label="Settings" onClick={() => navigate("/settings")} />
          <div className="mt-auto" />
          <SideButton icon={<HelpCircle />} label="Help" onClick={() => navigate("/help")} />
        </aside>

        <main className="min-w-0 lg:h-screen lg:overflow-y-auto">
          <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center">
              <button
                onClick={() => navigate("/")}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground"
                title="Back to home"
                aria-label="Back to home"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">WHEUAT Studio</div>
                <h1 className="truncate text-2xl font-bold">Podcast Home</h1>
              </div>
              <label className="flex h-11 min-w-0 items-center gap-2 rounded-md border border-border bg-card px-3 lg:w-[360px]">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search recordings and projects" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              </label>
            </div>
          </header>

          <section className="mx-auto max-w-7xl px-4 py-5">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">New recording or project</label>
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Episode title" className="h-11 bg-background" />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 md:flex">
                  <ActionButton icon={<Video />} label="Start podcast" active onClick={() => openScheduleModal(true)} />
                  <ActionButton icon={<Scissors />} label="Edit" onClick={openLatestEditor} />
                  <ActionButton icon={<Radio />} label="Go live" onClick={() => openScheduleModal(true)} />
                  <ActionButton icon={<CalendarDays />} label="Schedule" onClick={() => openScheduleModal(false)} />
                  <ActionButton icon={<Upload />} label={uploading ? "Uploading" : "Upload"} onClick={() => fileInputRef.current?.click()} disabled={uploading} />
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="video/webm,.webm,video/mp4,.mp4,audio/webm,.weba,audio/mpeg,.mp3,audio/wav,.wav" className="hidden" onChange={uploadEpisodeFile} />
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              <MobileTab label="Home" active={viewMode === "home"} onClick={() => setViewMode("home")} />
              <MobileTab label="Projects" active={viewMode === "projects"} onClick={() => setViewMode("projects")} />
              <MobileTab label="Planner" active={viewMode === "planner"} onClick={() => setViewMode("planner")} />
              <MobileTab label="Messages" onClick={() => navigate("/messages")} />
            </div>

            <div className="mt-6">
              <section className="min-w-0">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">{viewMode === "planner" ? "Planner" : viewMode === "projects" ? "Projects" : "Recents"}</h2>
                    <p className="text-sm text-muted-foreground">Saved videos and audio stay as full episodes here.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={load} disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gauge className="mr-2 h-4 w-4" />} Refresh</Button>
                </div>

                {viewMode === "planner" ? (
                  <PodcastScheduleDashboard onEdit={(s) => { setEditingSession(s); setScheduleStartNow(false); setScheduleOpen(true); }} />
                ) : loading ? (
                  <div className="rounded-lg border border-border bg-card p-8 text-sm text-muted-foreground">Loading episodes…</div>
                ) : (activeRows.filter(({ takes }) => takes.length > 0).length === 0 && localFinals.length === 0) ? (
                  <EmptyState onRecord={() => openScheduleModal(true)} onUpload={() => fileInputRef.current?.click()} />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {activeRows.filter(({ takes }) => takes.length > 0).map(({ episode, takes }) => {
                      const take = takes[0];
                      return (
                        <EpisodeCard
                          key={episode.id}
                          episode={episode}
                          take={take}
                          previewUrl={take ? previewUrls[take.id] : undefined}
                          loadingPreview={take ? busyRecording === take.id : false}
                          menuOpen={openMenu === episode.id}
                          onToggleMenu={() => setOpenMenu(openMenu === episode.id ? null : episode.id)}
                          onPlay={() => take && playRecording(take)}
                          onRecord={() => navigate(`/tv/podcast/${episode.id}`)}
                          onProject={() => navigate(`/tv/podcast/${episode.id}/edit`)}
                          onEdit={() => take ? navigate(`/tv/podcast/${episode.id}/recording/${take.id}/editor`) : navigate(`/tv/podcast/${episode.id}/edit`)}
                          onDownload={() => take && downloadRecording(take)}
                          onCopy={() => copyPreviewLink(episode.id)}
                          onDelete={() => removeEpisode(episode.id)}
                        />
                      );
                    })}
                  </div>
                )}

                {viewMode !== "planner" && (
                  <LocalRecordingsPanel
                    items={localFinals}
                    onEdit={openLocalEditor}
                    onDownload={downloadLocal}
                    onDelete={deleteLocal}
                    onRename={renameLocal}
                    onRefresh={loadLocalFinals}
                  />
                )}
              </section>
            </div>
          </section>
        </main>
      </div>

      <PodcastScheduleSheet
        open={scheduleOpen}
        onClose={() => { setScheduleOpen(false); setEditingSession(null); }}
        hostId={user?.id ?? null}
        hostName={user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Host"}
        editing={editingSession}
        initialStartNow={scheduleStartNow}
        onSaved={handleScheduleSaved}
      />

      {editingLocal && (
        <div className="fixed inset-0 z-[90] bg-zinc-950/95 backdrop-blur overflow-y-auto p-3 md:p-6">
          <div className="mx-auto max-w-6xl">
            <PodcastEditorPro
              initial={{
                id: editingLocal.id,
                name: editingLocal.title,
                url: editingLocalUrl,
                blob: editingLocal.blob,
                durationMs: editingLocal.durationMs,
              }}
              onClose={closeLocalEditor}
              onSaveToProject={async (blob, mime, ext) => {
                const id = `${editingLocal.id}-edit-${Date.now()}`;
                const title = editingLocal.title;
                const name = `${title.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 40)}-edited.${ext}`;
                await PodcastFinals.save({
                  id, sessionId: editingLocal.sessionId, title, name, mime, ext, blob,
                  createdAt: Date.now(),
                  durationMs: editingLocal.durationMs,
                  edited: true,
                  hostName: editingLocal.hostName,
                });
                await loadLocalFinals();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const SideButton = ({ icon, label, active, onClick }: { icon: ReactNode; label: string; active?: boolean; onClick: () => void }) => (
  <button onClick={onClick} className={`flex w-full flex-col items-center gap-1 rounded-lg py-3 text-xs transition ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
    {icon}<span>{label}</span>
  </button>
);

const MobileTab = ({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) => (
  <button onClick={onClick} className={`shrink-0 rounded-md border px-4 py-2 text-sm font-semibold ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>{label}</button>
);

const ActionButton = ({ icon, label, active, disabled, onClick }: { icon: ReactNode; label: string; active?: boolean; disabled?: boolean; onClick: () => void }) => (
  <button disabled={disabled} onClick={onClick} className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 md:min-w-[92px] ${active ? "border-primary bg-primary/15 text-primary" : "border-border bg-background hover:border-primary/60"}`}>
    {disabled ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}<span>{label}</span>
  </button>
);

const EpisodeCard = ({ episode, take, previewUrl, loadingPreview, menuOpen, onToggleMenu, onPlay, onRecord, onProject, onEdit, onDownload, onCopy, onDelete }: {
  episode: Episode;
  take?: Recording;
  previewUrl?: string;
  loadingPreview: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onPlay: () => void;
  onRecord: () => void;
  onProject: () => void;
  onEdit: () => void;
  onDownload: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) => (
  <article className="group relative overflow-hidden rounded-lg border border-border bg-card">
    <div className="relative bg-background">
      {take && previewUrl ? (
        <video src={previewUrl} controls className="aspect-video w-full object-cover" />
      ) : take ? (
        <button onClick={onPlay} className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-muted/35 text-sm text-muted-foreground">
          {loadingPreview ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Film className="h-10 w-10 text-primary" />}
          {loadingPreview ? "Loading video…" : "Play saved episode"}
        </button>
      ) : (
        <button onClick={onRecord} className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-muted/35 text-sm text-muted-foreground">
          <Video className="h-10 w-10 text-primary" />Record this episode
        </button>
      )}
      {take && <span className="absolute bottom-2 right-2 rounded-md bg-background/85 px-2 py-1 text-xs font-semibold">{formatTime(take.duration_seconds ?? take.chunk_count * 5)}</span>}
    </div>
    <div className="space-y-3 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold">{episode.title}</h3>
          <p className="text-xs text-muted-foreground">{take ? `Recorded ${new Date(take.created_at).toLocaleString()}` : "No recording yet"}</p>
        </div>
        <button onClick={onToggleMenu} className="rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="Episode actions"><MoreHorizontal className="h-4 w-4" /></button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onEdit}><Scissors className="mr-1 h-4 w-4" /> Edit</Button>
        <Button size="sm" variant="secondary" onClick={onProject}><FolderOpen className="mr-1 h-4 w-4" /> Project</Button>
        <Button size="sm" variant="outline" onClick={onRecord}><Video className="mr-1 h-4 w-4" /> Studio</Button>
      </div>
    </div>
    {menuOpen && (
      <div className="absolute right-3 top-[52%] z-10 w-56 rounded-lg border border-border bg-popover p-2 shadow-xl">
        <MenuItem icon={<FolderOpen />} label="Go to project" onClick={onProject} />
        <MenuItem icon={<Copy />} label="Copy project link" onClick={onCopy} />
        <MenuItem icon={<Scissors />} label="Edit video/audio" onClick={onEdit} />
        <MenuItem icon={<Download />} label="Export download" onClick={onDownload} disabled={!take} />
        <MenuItem icon={<Trash2 />} label="Remove" onClick={onDelete} danger />
      </div>
    )}
  </article>
);

const MenuItem = ({ icon, label, onClick, disabled, danger }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) => (
  <button disabled={disabled} onClick={onClick} className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm disabled:opacity-40 ${danger ? "text-destructive hover:bg-destructive/10" : "hover:bg-muted"}`}>
    {icon}<span>{label}</span>
  </button>
);

const Stat = ({ label, value }: { label: string; value: string }) => <div className="rounded-md border border-border bg-background p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-bold">{value}</div></div>;

const EmptyState = ({ onRecord, onUpload }: { onRecord: () => void; onUpload: () => void }) => (
  <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
    <Clapperboard className="mx-auto mb-4 h-12 w-12 text-primary" />
    <h2 className="text-xl font-bold">Start with one episode</h2>
    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Record live or upload a file. The saved video and audio will appear here as one editable episode.</p>
    <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row"><Button onClick={onRecord}><Video className="mr-2 h-4 w-4" /> Record</Button><Button variant="secondary" onClick={onUpload}><Upload className="mr-2 h-4 w-4" /> Upload</Button></div>
  </div>
);

const Planner = ({ episodes, onOpen }: { episodes: Episode[]; onOpen: (id: string) => void }) => (
  <div className="rounded-lg border border-border bg-card p-4">
    {episodes.length === 0 ? <div className="text-sm text-muted-foreground">No scheduled episodes yet. Use Schedule above to create one.</div> : episodes.map((episode) => (
      <button key={episode.id} onClick={() => onOpen(episode.id)} className="flex w-full items-center justify-between gap-3 border-b border-border py-3 text-left last:border-b-0">
        <span><span className="block font-semibold">{episode.title}</span><span className="block text-xs text-muted-foreground">{episode.scheduled_at ? new Date(episode.scheduled_at).toLocaleString() : "Not scheduled"}</span></span><ChevronDown className="h-4 w-4 -rotate-90 text-muted-foreground" />
      </button>
    ))}
  </div>
);

const formatTime = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds)) % 60).padStart(2, "0")}`;

const LocalRecordingsPanel = ({
  items, onEdit, onDownload, onDelete, onRename, onRefresh,
}: {
  items: FinalRecording[];
  onEdit: (r: FinalRecording) => void;
  onDownload: (r: FinalRecording) => void;
  onDelete: (r: FinalRecording) => void;
  onRename: (r: FinalRecording) => void;
  onRefresh: () => void;
}) => {
  if (!items.length) return null;
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Local recordings</h3>
          <p className="text-xs text-muted-foreground">Auto-saved on this device when you ended a podcast. Publish to share.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh}><Gauge className="mr-2 h-4 w-4" />Refresh</Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((r) => (
          <article key={r.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h4 className="truncate font-semibold">{r.title}{r.edited && <span className="ml-1 text-[10px] font-normal text-primary">· edited</span>}</h4>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString()} · {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {" · "}{formatTime(Math.floor(r.durationMs / 1000))}
                  {" · "}{(r.blob.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button size="sm" onClick={() => onEdit(r)}><Scissors className="mr-1 h-4 w-4" />Edit</Button>
              <Button size="sm" variant="secondary" onClick={() => onDownload(r)}><Download className="mr-1 h-4 w-4" />Download</Button>
              <Button size="sm" variant="outline" onClick={() => onRename(r)}><Edit3 className="mr-1 h-4 w-4" />Rename</Button>
              <Button size="sm" variant="destructive" onClick={() => onDelete(r)}><Trash2 className="mr-1 h-4 w-4" />Delete</Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default LivePodcastLobbyPage;