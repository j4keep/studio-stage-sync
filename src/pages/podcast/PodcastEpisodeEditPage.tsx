import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Sparkles, FileText, Download, Loader2, Mic } from "lucide-react";

type Episode = {
  id: string;
  title: string;
  host_user_id: string;
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
};

type Transcript = {
  id: string;
  recording_id: string | null;
  text: string;
  status: string;
  error: string | null;
};

const SUPABASE_URL = "https://cdcdlqbjyptamtleitdp.supabase.co";

const PodcastEpisodeEditPage = () => {
  const { episodeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [busyRec, setBusyRec] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  const load = async () => {
    if (!episodeId) return;
    const [{ data: ep }, { data: recs }, { data: trs }] = await Promise.all([
      supabase.from("podcast_episodes").select("id,title,host_user_id,ai_summary,ai_chapters,ai_titles,ai_soundbites,ai_show_notes").eq("id", episodeId).maybeSingle(),
      supabase.from("podcast_recordings").select("id,r2_prefix,mime_type,chunk_count,status,duration_seconds,created_at").eq("episode_id", episodeId).order("created_at"),
      supabase.from("podcast_transcripts").select("id,recording_id,text,status,error").eq("episode_id", episodeId),
    ]);
    setEpisode(ep as Episode);
    setRecordings((recs as Recording[]) ?? []);
    setTranscripts((trs as Transcript[]) ?? []);
  };

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 5000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

  const transcribe = async (recordingId: string) => {
    setBusyRec(recordingId);
    try {
      const { error } = await supabase.functions.invoke("transcribe-episode", { body: { recordingId } });
      if (error) throw error;
      toast({ title: "Transcription started", description: "Refreshing every few seconds…" });
      load();
    } catch (e) {
      toast({ title: "Couldn't transcribe", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    } finally {
      setBusyRec(null);
    }
  };

  const generateAi = async () => {
    if (!episodeId) return;
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

  const downloadChunk = (key: string) => {
    const url = `${SUPABASE_URL}/functions/v1/r2-download?key=${encodeURIComponent(key)}`;
    window.open(url, "_blank");
  };

  if (!episode) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const isHost = user?.id === episode.host_user_id;

  return (
    <div className="px-4 pt-4 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate("/tv/podcast")} className="p-2 -ml-2 rounded-full hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-display font-bold text-foreground truncate">{episode.title}</h1>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 mb-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
          <Mic className="w-3.5 h-3.5" /> Recordings
        </div>
        {recordings.length === 0 ? (
          <div className="text-sm text-muted-foreground">No recordings yet. Enter the studio and press Record.</div>
        ) : (
          <div className="space-y-2">
            {recordings.map((r) => {
              const tr = transcripts.find((t) => t.recording_id === r.id);
              return (
                <div key={r.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm">
                      <div className="font-medium text-foreground">{r.chunk_count} chunks • {r.status}</div>
                      <div className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => transcribe(r.id)} disabled={busyRec === r.id || tr?.status === "processing"}>
                        {tr?.status === "processing" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                        <span className="ml-1">Transcribe</span>
                      </Button>
                    </div>
                  </div>
                  {tr?.status === "ready" && (
                    <div className="mt-2 text-xs text-foreground max-h-40 overflow-y-auto whitespace-pre-wrap bg-muted/30 rounded p-2">
                      {tr.text}
                    </div>
                  )}
                  {tr?.status === "failed" && (
                    <div className="mt-2 text-xs text-destructive">Transcription failed: {tr.error}</div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Array.from({ length: r.chunk_count }).map((_, i) => {
                      const key = `${r.r2_prefix}${i.toString().padStart(6, "0")}.webm`;
                      return (
                        <button key={i} onClick={() => downloadChunk(key)} className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/70 flex items-center gap-1">
                          <Download className="w-2.5 h-2.5" /> {i + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> AI Insights
          </div>
          {isHost && (
            <Button size="sm" onClick={generateAi} disabled={aiBusy}>
              {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
              Generate
            </Button>
          )}
        </div>
        {episode.ai_summary ? (
          <div className="space-y-3">
            <section>
              <div className="text-xs font-semibold mb-1">Summary</div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{episode.ai_summary}</p>
            </section>
            {episode.ai_titles && episode.ai_titles.length > 0 && (
              <section>
                <div className="text-xs font-semibold mb-1">Title ideas</div>
                <ul className="text-sm list-disc pl-5 space-y-0.5">
                  {episode.ai_titles.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </section>
            )}
            {episode.ai_chapters && episode.ai_chapters.length > 0 && (
              <section>
                <div className="text-xs font-semibold mb-1">Chapters</div>
                <ul className="text-sm space-y-0.5">
                  {episode.ai_chapters.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-mono text-muted-foreground text-xs">{formatTime(c.start_seconds)}</span>
                      <span>{c.title}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {episode.ai_soundbites && episode.ai_soundbites.length > 0 && (
              <section>
                <div className="text-xs font-semibold mb-1">Soundbites</div>
                <ul className="text-sm list-disc pl-5 space-y-0.5">
                  {episode.ai_soundbites.map((s, i) => <li key={i} className="italic">"{s}"</li>)}
                </ul>
              </section>
            )}
            {episode.ai_show_notes && (
              <section>
                <div className="text-xs font-semibold mb-1">Show notes</div>
                <pre className="text-xs whitespace-pre-wrap text-foreground bg-muted/30 rounded p-2 max-h-72 overflow-y-auto">{episode.ai_show_notes}</pre>
              </section>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Transcribe at least one recording, then click Generate to get a summary, chapters, soundbites, and show notes.</p>
        )}
      </div>
    </div>
  );
};

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
};

export default PodcastEpisodeEditPage;
