import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  BadgeCheck,
  Clapperboard,
  Copy,
  Download,
  Film,
  FileText,
  Gauge,
  LayoutTemplate,
  Loader2,
  Mic,
  MonitorUp,
  Plus,
  Radio as RadioIcon,
  Scissors,
  Settings2,
  Sparkles,
  Trash2,
  Type,
  Wand2,
  Waves,
} from "lucide-react";

type Episode = {
  id: string;
  title: string;
  host_user_id: string;
  is_streaming: boolean;
  ai_summary: string | null;
  ai_chapters: { title: string; start_seconds: number }[] | null;
  ai_titles: string[] | null;
  ai_soundbites: string[] | null;
  ai_show_notes: string | null;
};

type Recording = {
  id: string;
  r2_prefix: string;
  mime_type: string;
  chunk_count: number;
  status: string;
  duration_seconds: number | null;
  created_at: string;
  processed_audio_key: string | null;
  magic_audio_status: string | null;
};

type Transcript = {
  id: string;
  recording_id: string | null;
  text: string;
  status: string;
  error: string | null;
};

type Clip = {
  id: string;
  title: string | null;
  start_seconds: number;
  end_seconds: number;
  format: string;
};

type Destination = {
  id: string;
  platform: string;
  rtmp_url: string;
  stream_key: string;
  enabled: boolean;
};

const SUPABASE_URL = "https://cdcdlqbjyptamtleitdp.supabase.co";

const PodcastEpisodeEditPage = () => {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [busyRec, setBusyRec] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [clipsBusy, setClipsBusy] = useState(false);
  const [newDest, setNewDest] = useState({ platform: "youtube", rtmp_url: "", stream_key: "" });
  const [manualClip, setManualClip] = useState({ title: "", start: "0", end: "60", format: "9x16" });
  const [videoSettings, setVideoSettings] = useState({ quality: "4K", layout: "Auto grid", captions: true, noise: true, loudness: "Podcast" });

  const load = async () => {
    if (!episodeId) return;
    const [{ data: ep }, { data: recs }, { data: trs }, { data: cls }, { data: dsts }] = await Promise.all([
      supabase.from("podcast_episodes").select("id,title,host_user_id,is_streaming,ai_summary,ai_chapters,ai_titles,ai_soundbites,ai_show_notes").eq("id", episodeId).maybeSingle(),
      supabase.from("podcast_recordings").select("id,r2_prefix,mime_type,chunk_count,status,duration_seconds,created_at,processed_audio_key,magic_audio_status").eq("episode_id", episodeId).order("created_at"),
      supabase.from("podcast_transcripts").select("id,recording_id,text,status,error").eq("episode_id", episodeId),
      supabase.from("podcast_clips").select("id,title,start_seconds,end_seconds,format").eq("episode_id", episodeId).order("start_seconds"),
      supabase.from("podcast_stream_destinations").select("id,platform,rtmp_url,stream_key,enabled").eq("episode_id", episodeId),
    ]);
    setEpisode(ep as Episode);
    setRecordings((recs as Recording[]) ?? []);
    setTranscripts((trs as Transcript[]) ?? []);
    setClips((cls as Clip[]) ?? []);
    setDestinations((dsts as Destination[]) ?? []);
  };

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 5000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

  const readyTranscript = transcripts.find((t) => t.status === "ready" && t.text.trim());
  const totalDuration = useMemo(() => recordings.reduce((sum, r) => sum + (r.duration_seconds ?? Math.max(30, r.chunk_count * 5)), 0), [recordings]);
  const isHost = user?.id === episode?.host_user_id;

  const transcribe = async (recordingId: string) => {
    setBusyRec(recordingId);
    try {
      const { error } = await supabase.functions.invoke("transcribe-episode", { body: { recordingId } });
      if (error) throw error;
      toast({ title: "Transcription started" });
      load();
    } catch (e) {
      toast({ title: "Couldn't transcribe", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    } finally {
      setBusyRec(null);
    }
  };

  const generateAi = async () => {
    if (!episodeId) return;
    if (!readyTranscript) {
      toast({ title: "Transcript needed for AI writing", description: "Editing, trimming, clips, and Magic Audio work without transcripts." });
      return;
    }
    setAiBusy(true);
    try {
      const { error, data } = await supabase.functions.invoke("generate-podcast-ai", { body: { episodeId } });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast({ title: "AI insights generated" });
      load();
    } catch (e) {
      toast({ title: "AI failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    } finally {
      setAiBusy(false);
    }
  };

  const generateClips = async () => {
    if (!episodeId) return;
    setClipsBusy(true);
    try {
      if (readyTranscript) {
        const { error, data } = await supabase.functions.invoke("generate-podcast-clips", { body: { episodeId, count: 5 } });
        if (error) throw error;
        if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
        toast({ title: "Magic clips ready", description: `${(data as { count: number }).count} moments picked.` });
      } else {
        const base = Math.max(180, totalDuration || 300);
        const rows = [0.08, 0.28, 0.48, 0.68, 0.84].map((point, i) => {
          const start = Math.max(0, Math.floor(base * point));
          return { episode_id: episodeId, title: `Draft clip ${i + 1}`, start_seconds: start, end_seconds: Math.min(Math.floor(base), start + 45), format: i % 2 ? "16x9" : "9x16" };
        });
        const { error } = await supabase.from("podcast_clips").insert(rows);
        if (error) throw error;
        toast({ title: "Draft clips created", description: "Fine-tune the clip timing in the editor." });
      }
      load();
    } catch (e) {
      toast({ title: "Clip generation failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    } finally {
      setClipsBusy(false);
    }
  };

  const addManualClip = async () => {
    if (!episodeId) return;
    const start = Number(manualClip.start);
    const end = Number(manualClip.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      toast({ title: "Clip timing needs a valid start and end", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("podcast_clips").insert({
      episode_id: episodeId,
      title: manualClip.title || "Manual clip",
      start_seconds: start,
      end_seconds: end,
      format: manualClip.format,
    });
    if (error) {
      toast({ title: "Couldn't add clip", description: error.message, variant: "destructive" });
      return;
    }
    setManualClip({ title: "", start: String(Math.max(0, end)), end: String(end + 60), format: manualClip.format });
    load();
  };

  const downloadKey = async (key: string) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/r2-download?key=${encodeURIComponent(key)}`);
      if (!res.ok) throw new Error(await res.text().catch(() => `Download failed: ${res.status}`));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = key.split("/").pop() || "podcast-recording.webm";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: "Download not available", description: e instanceof Error ? e.message : "The file was not found in storage.", variant: "destructive" });
    }
  };

  const addDestination = async () => {
    if (!episodeId || !newDest.rtmp_url || !newDest.stream_key) {
      toast({ title: "RTMP URL and stream key required", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("podcast_stream_destinations").insert({ episode_id: episodeId, ...newDest });
    if (error) {
      toast({ title: "Couldn't add destination", description: error.message, variant: "destructive" });
      return;
    }
    setNewDest({ platform: "youtube", rtmp_url: "", stream_key: "" });
    load();
  };

  const copyExportPlan = async () => {
    await navigator.clipboard.writeText(`${videoSettings.quality} • ${videoSettings.layout} • captions ${videoSettings.captions ? "on" : "off"} • ${videoSettings.loudness} loudness`);
    toast({ title: "Export settings copied" });
  };

  if (!episode) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <button onClick={() => navigate("/tv/podcast")} className="p-2 -ml-2 rounded-md hover:bg-muted" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Podcast production</div>
            <h1 className="text-xl font-display font-bold truncate">{episode.title}</h1>
          </div>
          {episode.is_streaming && <span className="rounded-md bg-destructive px-2 py-1 text-xs font-bold text-destructive-foreground">LIVE</span>}
          <Button onClick={() => navigate(`/tv/podcast/${episode.id}`)}>
            <MonitorUp className="w-4 h-4 mr-2" /> Studio
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[1.45fr_0.9fr]">
        <section className="space-y-4 min-w-0">
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric icon={<Mic />} label="Recordings" value={String(recordings.length)} />
            <Metric icon={<Scissors />} label="Clips" value={String(clips.length)} />
            <Metric icon={<Gauge />} label="Runtime" value={formatTime(totalDuration)} />
            <Metric icon={<BadgeCheck />} label="Quality" value={videoSettings.quality} />
          </div>

          <Panel icon={<Clapperboard className="w-4 h-4" />} title="Video Studio" action={<Button size="sm" variant="secondary" onClick={copyExportPlan}><Copy className="w-4 h-4 mr-1" /> Copy preset</Button>}>
            <div className="grid gap-3 md:grid-cols-5">
              <Control label="Export quality">
                <Segment value={videoSettings.quality} options={["720p", "1080p", "4K"]} onChange={(quality) => setVideoSettings((s) => ({ ...s, quality }))} />
              </Control>
              <Control label="Canvas">
                <Segment value={videoSettings.layout} options={["Auto grid", "Speaker", "Split"]} onChange={(layout) => setVideoSettings((s) => ({ ...s, layout }))} />
              </Control>
              <Control label="Format">
                <Segment value={manualClip.format} options={["9x16", "16x9", "1x1"]} onChange={(format) => setManualClip((s) => ({ ...s, format }))} />
              </Control>
              <Control label="Captions">
                <div className="flex h-10 items-center justify-between rounded-md border border-border px-3"><span className="text-sm">Burn in</span><Switch checked={videoSettings.captions} onCheckedChange={(captions) => setVideoSettings((s) => ({ ...s, captions }))} /></div>
              </Control>
              <Control label="Audio clean-up">
                <div className="flex h-10 items-center justify-between rounded-md border border-border px-3"><span className="text-sm">Magic</span><Switch checked={videoSettings.noise} onCheckedChange={(noise) => setVideoSettings((s) => ({ ...s, noise }))} /></div>
              </Control>
            </div>
          </Panel>

          <Panel icon={<Film className="w-4 h-4" />} title="Saved timeline">
            <ProductionTimeline recordings={recordings} clips={clips} duration={Math.max(totalDuration, 60)} />
          </Panel>

          <Panel icon={<Mic className="w-4 h-4" />} title="Recordings">
            {recordings.length === 0 ? (
              <Empty title="No recordings yet" body="Enter the studio and press Record." />
            ) : (
              <div className="space-y-3">
                {recordings.map((r) => {
                  const tr = transcripts.find((t) => t.recording_id === r.id);
                  return (
                    <div key={r.id} className="rounded-lg border border-border bg-muted/25 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold">Recording {recordings.indexOf(r) + 1}</div>
                          <div className="text-xs text-muted-foreground">{r.chunk_count} chunks · {r.status} · {new Date(r.created_at).toLocaleString()}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={() => navigate(`/tv/podcast/${episodeId}/recording/${r.id}/editor`)}>
                            <Settings2 className="w-4 h-4 mr-1" /> Edit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => transcribe(r.id)} disabled={busyRec === r.id || tr?.status === "processing"}>
                            {tr?.status === "processing" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileText className="w-4 h-4 mr-1" />} Transcribe
                          </Button>
                          {r.processed_audio_key && <Button size="sm" variant="outline" onClick={() => downloadKey(r.processed_audio_key!)}><Waves className="w-4 h-4 mr-1" /> Audio</Button>}
                        </div>
                      </div>
                      {tr?.status === "ready" && <div className="mt-3 line-clamp-3 rounded-md bg-background/60 p-2 text-xs text-muted-foreground">{tr.text}</div>}
                      {tr?.status === "failed" && <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">Transcription failed. The model is now updated — click Transcribe again.</div>}
                      <div className="mt-3 flex flex-wrap gap-1">
                        {Array.from({ length: r.chunk_count }).map((_, i) => (
                          <button key={i} onClick={() => downloadKey(`${r.r2_prefix}${i.toString().padStart(6, "0")}.webm`)} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs hover:bg-secondary">
                            <Download className="w-3 h-3" /> {i + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </section>

        <aside className="space-y-4 min-w-0">
          <Panel icon={<Scissors className="w-4 h-4" />} title="Clips" action={isHost && <Button size="sm" onClick={generateClips} disabled={clipsBusy}>{clipsBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1" />} Magic</Button>}>
            <div className="grid grid-cols-[1fr_72px_72px] gap-2">
              <Input placeholder="Clip title" value={manualClip.title} onChange={(e) => setManualClip((s) => ({ ...s, title: e.target.value }))} />
              <Input value={manualClip.start} onChange={(e) => setManualClip((s) => ({ ...s, start: e.target.value }))} />
              <Input value={manualClip.end} onChange={(e) => setManualClip((s) => ({ ...s, end: e.target.value }))} />
            </div>
            <Button className="mt-2 w-full" variant="secondary" onClick={addManualClip}><Plus className="w-4 h-4 mr-1" /> Add manual clip</Button>
            <div className="mt-3 space-y-2">
              {clips.length === 0 ? <Empty title="No clips yet" body="Add clips manually or use Magic to draft moments." /> : clips.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.title || "Clip"}</div>
                    <div className="text-xs text-muted-foreground">{formatTime(c.start_seconds)} → {formatTime(c.end_seconds)} · {c.format}</div>
                  </div>
                  <button className="rounded p-2 text-muted-foreground hover:bg-muted" onClick={async () => { await supabase.from("podcast_clips").delete().eq("id", c.id); load(); }}><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </Panel>

          <Panel icon={<Sparkles className="w-4 h-4" />} title="AI Notes" action={isHost && <Button size="sm" onClick={generateAi} disabled={aiBusy}>{aiBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />} Generate</Button>}>
            {episode.ai_summary ? (
              <div className="space-y-3 text-sm">
                <Sub label="Summary"><p className="whitespace-pre-wrap text-muted-foreground">{episode.ai_summary}</p></Sub>
                {episode.ai_titles?.length ? <Sub label="Titles"><ul className="list-disc pl-5 text-muted-foreground">{episode.ai_titles.map((t, i) => <li key={i}>{t}</li>)}</ul></Sub> : null}
                {episode.ai_chapters?.length ? <Sub label="Chapters"><ul className="space-y-1 text-muted-foreground">{episode.ai_chapters.map((c, i) => <li key={i}><span className="font-mono text-xs">{formatTime(c.start_seconds)}</span> {c.title}</li>)}</ul></Sub> : null}
              </div>
            ) : <Empty title="Transcript-powered notes" body="AI notes need transcript text. Editing tools do not." />}
          </Panel>

          {isHost && (
            <Panel icon={<RadioIcon className="w-4 h-4" />} title="RTMP Live">
              <div className="space-y-2">
                {destinations.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                    <div className="min-w-0 flex-1"><div className="text-sm font-medium capitalize">{d.platform}</div><div className="truncate text-xs text-muted-foreground">{d.rtmp_url}</div></div>
                    <Switch checked={d.enabled} onCheckedChange={async () => { await supabase.from("podcast_stream_destinations").update({ enabled: !d.enabled }).eq("id", d.id); load(); }} />
                    <button className="rounded p-2 text-muted-foreground hover:bg-muted" onClick={async () => { await supabase.from("podcast_stream_destinations").delete().eq("id", d.id); load(); }}><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2 rounded-lg border border-border p-3">
                <select value={newDest.platform} onChange={(e) => setNewDest((d) => ({ ...d, platform: e.target.value }))} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
                  <option value="youtube">YouTube</option><option value="twitch">Twitch</option><option value="custom">Custom RTMP</option>
                </select>
                <Input placeholder="RTMP URL" value={newDest.rtmp_url} onChange={(e) => setNewDest((d) => ({ ...d, rtmp_url: e.target.value }))} />
                <Input placeholder="Stream key" value={newDest.stream_key} onChange={(e) => setNewDest((d) => ({ ...d, stream_key: e.target.value }))} />
                <Button className="w-full" onClick={addDestination}><Plus className="w-4 h-4 mr-1" /> Add destination</Button>
              </div>
            </Panel>
          )}
        </aside>
      </main>
    </div>
  );
};

const Panel = ({ icon, title, action, children }: { icon: ReactNode; title: string; action?: ReactNode; children: ReactNode }) => (
  <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold"><span className="text-primary">{icon}</span>{title}</div>
      {action}
    </div>
    {children}
  </section>
);

const Metric = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => (
  <div className="rounded-lg border border-border bg-card p-3">
    <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-muted text-primary">{icon}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-lg font-bold">{value}</div>
  </div>
);

const Control = ({ label, children }: { label: string; children: ReactNode }) => <label className="block text-xs font-semibold text-muted-foreground"><span className="mb-1 block">{label}</span>{children}</label>;

const Segment = ({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) => (
  <div className="grid h-10 grid-cols-3 rounded-md border border-border bg-background p-1">
    {options.map((option) => <button key={option} onClick={() => onChange(option)} className={`rounded text-xs font-semibold ${value === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{option}</button>)}
  </div>
);

const ProductionTimeline = ({ recordings, clips, duration }: { recordings: Recording[]; clips: Clip[]; duration: number }) => (
  <div className="space-y-3">
    <div className="relative h-24 overflow-hidden rounded-lg border border-border bg-background">
      <div className="absolute inset-x-3 top-4 flex h-10 items-end gap-1">
        {Array.from({ length: 72 }).map((_, i) => <span key={i} className="w-full rounded-sm bg-primary/30" style={{ height: `${10 + ((i * 11) % 30)}px` }} />)}
      </div>
      {clips.map((clip) => (
        <div key={clip.id} className="absolute bottom-8 h-8 rounded-sm border border-primary bg-primary/25" style={{ left: `${Math.max(0, (clip.start_seconds / duration) * 100)}%`, width: `${Math.max(2, ((clip.end_seconds - clip.start_seconds) / duration) * 100)}%` }} />
      ))}
      <div className="absolute bottom-2 left-3 text-xs text-muted-foreground">0:00</div>
      <div className="absolute bottom-2 right-3 text-xs text-muted-foreground">{formatTime(duration)}</div>
    </div>
    <div className="grid gap-2 sm:grid-cols-3">
      {recordings.map((recording, i) => (
        <div key={recording.id} className="rounded-md border border-border p-2 text-xs">
          <div className="font-semibold">Recording {i + 1}</div>
          <div className="text-muted-foreground">{formatTime(recording.duration_seconds ?? recording.chunk_count * 5)} · {recording.status}</div>
        </div>
      ))}
      {recordings.length === 0 && <div className="text-sm text-muted-foreground">Saved recordings appear here immediately after you stop recording.</div>}
    </div>
  </div>
);

const Empty = ({ title, body }: { title: string; body: string }) => <div className="rounded-lg border border-dashed border-border p-4 text-sm"><div className="font-medium">{title}</div><div className="mt-1 text-muted-foreground">{body}</div></div>;

const Sub = ({ label, children }: { label: string; children: ReactNode }) => <section><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>{children}</section>;

const formatTime = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(safe / 60);
  const s = String(safe % 60).padStart(2, "0");
  return `${m}:${s}`;
};

export default PodcastEpisodeEditPage;