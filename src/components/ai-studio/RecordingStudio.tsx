import { useState, useRef, useCallback, useEffect } from "react";
import {
  Mic, Play, Pause, Square, Save, Plus, Trash2, Music,
  Upload, Image, Headphones, Download,
  Scissors, Edit3, Check, X, FolderOpen,
  FileText, Clock, Layers, Sliders, ArrowLeft
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useRecordingEngine } from "@/hooks/use-recording-engine";
import StudioDAWView from "./studio/StudioDAWView";

interface TakeLocal {
  id: string;
  name: string;
  audioUrl: string;
  blob?: Blob;
  duration: number;
  muted: boolean;
  solo: boolean;
  trimStart: number;
  trimEnd: number;
  waveform: number[];
  createdAt: string;
  persisted: boolean;
}

interface SessionRecord {
  id: string;
  name: string;
  beat_url: string | null;
  beat_name: string | null;
  cover_url: string | null;
  is_draft: boolean;
  created_at: string;
  takesCount?: number;
}

type Screen = "home" | "create" | "record" | "takes" | "effects" | "export";

const EFFECT_PRESETS = [
  { id: "clean", label: "Clean Vocal", icon: "🎤" },
  { id: "warm", label: "Warm Vocal", icon: "🔥" },
  { id: "reverb", label: "Reverb", icon: "🏛️" },
  { id: "delay", label: "Delay", icon: "🔁" },
  { id: "punchy", label: "Punchy", icon: "💥" },
] as const;

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function uploadToR2(blob: Blob, folder: string, fileName: string): Promise<string | null> {
  try {
    const key = `${folder}/${fileName}`;
    const buffer = await blob.arrayBuffer();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/r2-upload`, {
      method: "POST",
      headers: {
        "x-upload-key": key,
        "x-upload-content-type": blob.type || "audio/webm",
        "Content-Length": buffer.byteLength.toString(),
        "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
      body: buffer,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? key : null;
  } catch {
    return null;
  }
}

function getR2Url(key: string): string {
  return `${SUPABASE_URL}/functions/v1/r2-download?key=${encodeURIComponent(key)}`;
}

const RecordingStudio = () => {
  const { user } = useAuth();
  const engine = useRecordingEngine();

  const [screen, setScreen] = useState<Screen>("home");
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [exports, setExports] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const [sessionName, setSessionName] = useState("");
  const [beatFile, setBeatFile] = useState<File | null>(null);
  const [beatUrl, setBeatUrl] = useState<string | null>(null);
  const [beatName, setBeatName] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionName, setActiveSessionName] = useState("");
  const [activeSessionBeatName, setActiveSessionBeatName] = useState<string | null>(null);

  const [beatVolume, setBeatVolume] = useState(80);
  const [vocalVolume, setVocalVolume] = useState(100);
  const [takes, setTakes] = useState<TakeLocal[]>([]);
  const [activeTakeId, setActiveTakeId] = useState<string | null>(null);
  const [editingTakeId, setEditingTakeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingTake, setSavingTake] = useState(false);

  const [activeEffect, setActiveEffect] = useState<string>("clean");
  const [vocalGain, setVocalGain] = useState(80);
  const [beatGain, setBeatGain] = useState(80);
  const [beatPan, setBeatPan] = useState(0);
  const [vocalPan, setVocalPan] = useState(0);

  const [exportTitle, setExportTitle] = useState("");
  const [exportArtist, setExportArtist] = useState("");
  const [exportArtwork, setExportArtwork] = useState<File | null>(null);
  const [exportArtworkPreview, setExportArtworkPreview] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const beatInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const artworkInputRef = useRef<HTMLInputElement>(null);

  // Load sessions from DB
  const loadSessions = useCallback(async () => {
    if (!user) return;
    setLoadingSessions(true);
    try {
      const { data } = await supabase
        .from("recording_sessions" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) {
        // Get takes counts
        const sessionIds = (data as any[]).map((s: any) => s.id);
        let takesCounts: Record<string, number> = {};
        if (sessionIds.length > 0) {
          const { data: takesData } = await supabase
            .from("recording_takes" as any)
            .select("session_id")
            .in("session_id", sessionIds);
          if (takesData) {
            (takesData as any[]).forEach((t: any) => {
              takesCounts[t.session_id] = (takesCounts[t.session_id] || 0) + 1;
            });
          }
        }
        setSessions((data as any[]).map((s: any) => ({ ...s, takesCount: takesCounts[s.id] || 0 })));
      }
    } catch {}
    setLoadingSessions(false);
  }, [user]);

  const loadExports = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("recording_exports" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setExports(data as any[]);
  }, [user]);

  useEffect(() => {
    if (user && screen === "home") {
      loadSessions();
      loadExports();
    }
  }, [user, screen, loadSessions, loadExports]);

  // Load takes for active session
  const loadTakes = useCallback(async (sessionId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from("recording_takes" as any)
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (data) {
      const loaded: TakeLocal[] = (data as any[]).map((t: any) => ({
        id: t.id,
        name: t.name,
        audioUrl: t.audio_url ? getR2Url(t.audio_url) : "",
        duration: t.duration,
        muted: t.muted,
        solo: t.solo,
        trimStart: t.trim_start,
        trimEnd: t.trim_end,
        waveform: Array.isArray(t.waveform_data) ? t.waveform_data : [],
        createdAt: t.created_at,
        persisted: true,
      }));
      setTakes(loaded);
      setActiveTakeId(loaded[0]?.id || null);
    }
  }, [user]);

  const handleBeatUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBeatFile(file);
    setBeatName(file.name);
    setBeatUrl(URL.createObjectURL(file));
  }, []);

  const handleCoverUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }, []);

  const handleArtworkUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExportArtwork(file);
    setExportArtworkPreview(URL.createObjectURL(file));
  }, []);

  function resetForm() {
    setSessionName("");
    setBeatFile(null);
    setBeatUrl(null);
    setBeatName(null);
    setCoverFile(null);
    setCoverPreview(null);
  }

  const handleCreateSession = useCallback(async () => {
    if (!sessionName.trim() || !user) {
      toast({ title: !user ? "Sign in to create sessions" : "Enter a session name", variant: "destructive" });
      return;
    }

    // Upload beat to R2 if provided
    let beatR2Key: string | null = null;
    if (beatFile) {
      const key = await uploadToR2(beatFile, `studio/${user.id}`, `beat-${Date.now()}-${beatFile.name}`);
      beatR2Key = key;
    }

    // Upload cover to R2 if provided
    let coverR2Key: string | null = null;
    if (coverFile) {
      const key = await uploadToR2(coverFile, `studio/${user.id}`, `cover-${Date.now()}-${coverFile.name}`);
      coverR2Key = key;
    }

    const { data, error } = await supabase
      .from("recording_sessions" as any)
      .insert({
        user_id: user.id,
        name: sessionName.trim(),
        beat_url: beatR2Key,
        beat_name: beatName,
        cover_url: coverR2Key,
        is_draft: true,
      } as any)
      .select()
      .single();

    if (error || !data) {
      toast({ title: "Failed to create session", variant: "destructive" });
      return;
    }

    const session = data as any;
    setActiveSessionId(session.id);
    setActiveSessionName(session.name);
    setActiveSessionBeatName(session.beat_name);
    // Keep the local beatUrl for playback during recording
    if (beatR2Key && !beatUrl) {
      setBeatUrl(getR2Url(beatR2Key));
    }
    setTakes([]);
    setActiveTakeId(null);
    setScreen("record");
    toast({ title: "Session created!" });
  }, [sessionName, beatFile, coverFile, beatName, beatUrl, user]);

  const openSession = useCallback(async (session: SessionRecord) => {
    setActiveSessionId(session.id);
    setActiveSessionName(session.name);
    setActiveSessionBeatName(session.beat_name);
    setBeatUrl(session.beat_url ? getR2Url(session.beat_url) : null);
    setBeatName(session.beat_name);
    await loadTakes(session.id);
    setScreen("record");
  }, [loadTakes]);

  const startRecording = useCallback(async () => {
    const result = engine.startRecording(beatUrl, beatVolume);
    
    const recording = await result;
    if (!recording) {
      toast({ title: "Mic access denied", description: "Allow microphone to record", variant: "destructive" });
      return;
    }

    // Save take
    if (!activeSessionId || !user) return;
    setSavingTake(true);

    const takeNum = takes.length + 1;
    const takeName = `Take ${takeNum}`;
    
    // Upload audio to R2
    const audioKey = await uploadToR2(
      recording.blob,
      `studio/${user.id}`,
      `take-${activeSessionId}-${Date.now()}.webm`
    );

    if (!audioKey) {
      // Save locally only
      const localUrl = URL.createObjectURL(recording.blob);
      const newTake: TakeLocal = {
        id: crypto.randomUUID(),
        name: takeName,
        audioUrl: localUrl,
        blob: recording.blob,
        duration: recording.duration,
        muted: false,
        solo: false,
        trimStart: 0,
        trimEnd: 100,
        waveform: recording.waveform,
        createdAt: new Date().toISOString(),
        persisted: false,
      };
      setTakes(prev => [...prev, newTake]);
      setActiveTakeId(newTake.id);
      setSavingTake(false);
      toast({ title: "Take saved locally (upload failed)" });
      return;
    }

    // Downsample waveform to max 120 points for storage
    const wf = recording.waveform;
    const downsampled = wf.length > 120
      ? Array.from({ length: 120 }, (_, i) => wf[Math.floor(i * wf.length / 120)])
      : wf;

    const { data, error } = await supabase
      .from("recording_takes" as any)
      .insert({
        session_id: activeSessionId,
        user_id: user.id,
        name: takeName,
        audio_url: audioKey,
        duration: recording.duration,
        waveform_data: downsampled,
      } as any)
      .select()
      .single();

    if (error || !data) {
      toast({ title: "Failed to save take", variant: "destructive" });
      setSavingTake(false);
      return;
    }

    const saved = data as any;
    const newTake: TakeLocal = {
      id: saved.id,
      name: saved.name,
      audioUrl: getR2Url(audioKey),
      duration: saved.duration,
      muted: false,
      solo: false,
      trimStart: 0,
      trimEnd: 100,
      waveform: downsampled,
      createdAt: saved.created_at,
      persisted: true,
    };
    setTakes(prev => [...prev, newTake]);
    setActiveTakeId(newTake.id);
    setSavingTake(false);
    toast({ title: `🎙️ ${takeName} saved!` });
  }, [beatUrl, beatVolume, activeSessionId, user, takes.length, engine]);

  const stopRecording = useCallback(() => {
    engine.stopRecording();
  }, [engine]);

  const playTake = useCallback((take: TakeLocal) => {
    if (take.muted) return;
    engine.playAudio(take.audioUrl, beatUrl, beatVolume, vocalVolume);
    setActiveTakeId(take.id);
  }, [engine, beatUrl, beatVolume, vocalVolume]);

  const stopTakePlayback = useCallback(() => {
    engine.stopPlayback();
  }, [engine]);

  const pauseTakePlayback = useCallback(() => {
    engine.pausePlayback();
  }, [engine]);

  const deleteTake = useCallback(async (id: string) => {
    const take = takes.find(t => t.id === id);
    if (!take) return;
    if (take.persisted) {
      await supabase.from("recording_takes" as any).delete().eq("id", id);
    }
    setTakes(prev => prev.filter(t => t.id !== id));
    if (activeTakeId === id) setActiveTakeId(null);
    toast({ title: "Take deleted" });
  }, [activeTakeId, takes]);

  const toggleMuteTake = useCallback(async (id: string) => {
    setTakes(prev => prev.map(t => {
      if (t.id !== id) return t;
      const updated = { ...t, muted: !t.muted };
      if (t.persisted) {
        supabase.from("recording_takes" as any).update({ muted: updated.muted } as any).eq("id", id).then(() => {});
      }
      return updated;
    }));
  }, []);

  const toggleSoloTake = useCallback(async (id: string) => {
    setTakes(prev => prev.map(t => {
      if (t.id !== id) return t;
      const updated = { ...t, solo: !t.solo };
      if (t.persisted) {
        supabase.from("recording_takes" as any).update({ solo: updated.solo } as any).eq("id", id).then(() => {});
      }
      return updated;
    }));
  }, []);

  const renameTake = useCallback(async (id: string, name: string) => {
    setTakes(prev => prev.map(t => t.id === id ? { ...t, name } : t));
    setEditingTakeId(null);
    const take = takes.find(t => t.id === id);
    if (take?.persisted) {
      await supabase.from("recording_takes" as any).update({ name } as any).eq("id", id);
    }
  }, [takes]);

  const updateTrimStart = useCallback(async (id: string, val: number) => {
    setTakes(prev => prev.map(t => t.id === id ? { ...t, trimStart: val } : t));
    const take = takes.find(t => t.id === id);
    if (take?.persisted) {
      supabase.from("recording_takes" as any).update({ trim_start: val } as any).eq("id", id).then(() => {});
    }
  }, [takes]);

  const updateTrimEnd = useCallback(async (id: string, val: number) => {
    setTakes(prev => prev.map(t => t.id === id ? { ...t, trimEnd: val } : t));
    const take = takes.find(t => t.id === id);
    if (take?.persisted) {
      supabase.from("recording_takes" as any).update({ trim_end: val } as any).eq("id", id).then(() => {});
    }
  }, [takes]);

  const saveSession = useCallback(async () => {
    if (!activeSessionId) return;
    await supabase.from("recording_sessions" as any).update({ is_draft: true, updated_at: new Date().toISOString() } as any).eq("id", activeSessionId);
    toast({ title: "Session saved!" });
  }, [activeSessionId]);

  const handleExport = useCallback(async () => {
    if (!activeTakeId || !user) {
      toast({ title: "Select a take to export", variant: "destructive" });
      return;
    }
    const take = takes.find(t => t.id === activeTakeId);
    if (!take) return;

    setIsExporting(true);

    try {
      // Download the take audio for local download
      const downloadResponse = await fetch(take.audioUrl);
      const audioBlob = await downloadResponse.blob();

      // Upload artwork if provided
      let coverKey: string | null = null;
      if (exportArtwork) {
        coverKey = await uploadToR2(exportArtwork, `studio/${user.id}`, `export-cover-${Date.now()}.jpg`);
      }

      // Create export record
      const { error } = await supabase
        .from("recording_exports" as any)
        .insert({
          session_id: activeSessionId,
          user_id: user.id,
          title: exportTitle || activeSessionName || "Untitled",
          artist_name: exportArtist || null,
          audio_url: take.audioUrl.includes("r2-download") ? take.audioUrl.split("key=")[1] : null,
          cover_url: coverKey,
        } as any);

      // Also save to ai_generations for library
      await supabase.from("ai_generations").insert({
        user_id: user.id,
        title: exportTitle || activeSessionName || "Untitled",
        type: "Recording",
        production_notes: `Recorded in W.Studio. Artist: ${exportArtist || "Unknown"}`,
      });

      // Mark session as not draft
      if (activeSessionId) {
        await supabase.from("recording_sessions" as any).update({ is_draft: false } as any).eq("id", activeSessionId);
      }

      // Trigger download
      const a = document.createElement("a");
      a.href = URL.createObjectURL(audioBlob);
      a.download = `${exportTitle || activeSessionName || "recording"}.webm`;
      a.click();
      URL.revokeObjectURL(a.href);

      if (error) {
        toast({ title: "Exported! (Save to library failed)", variant: "destructive" });
      } else {
        toast({ title: "🎵 Exported & saved to Library!" });
      }
    } catch (err) {
      toast({ title: "Export failed", variant: "destructive" });
    }

    setIsExporting(false);
  }, [activeTakeId, takes, exportTitle, exportArtist, exportArtwork, activeSessionId, activeSessionName, user]);

  const handleSaveDraft = useCallback(() => {
    saveSession();
  }, [saveSession]);

  const activeTake = takes.find(t => t.id === activeTakeId);
  const drafts = sessions.filter(s => s.is_draft);
  const exportsCount = exports.length;

  /* ═══ HOME ═══ */
  if (screen === "home") {
    return (
      <div className="px-4 pt-4 pb-24 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold text-foreground">Recording Studio</h1>
          <p className="text-sm text-muted-foreground mt-1">Create, record, and mix your music</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "New Session", icon: Plus, action: () => { resetForm(); setScreen("create"); }, accent: true },
            { label: "My Sessions", icon: FolderOpen, action: () => {}, badge: sessions.length },
            { label: "Drafts", icon: FileText, action: () => {}, badge: drafts.length },
            { label: "Exports", icon: Download, action: () => {}, badge: exportsCount },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={btn.action}
              className={`relative flex flex-col items-center gap-2 p-5 rounded-2xl border transition-all active:scale-95 ${
                btn.accent ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border text-foreground"
              }`}
            >
              <btn.icon className="w-6 h-6" />
              <span className="text-sm font-semibold">{btn.label}</span>
              {btn.badge ? (
                <span className="absolute top-2 right-2 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">{btn.badge}</span>
              ) : null}
            </button>
          ))}
        </div>

        {sessions.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" /> Recent Sessions
            </h2>
            <div className="space-y-2">
              {sessions.slice(0, 5).map(session => (
                <button
                  key={session.id}
                  onClick={() => openSession(session)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border active:scale-[0.98] transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Music className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{session.name}</p>
                    <p className="text-xs text-muted-foreground">{session.takesCount || 0} takes · {session.beat_name || "No beat"}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    session.is_draft ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"
                  }`}>
                    {session.is_draft ? "Draft" : "Done"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {loadingSessions && (
          <div className="text-center py-4">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}
      </div>
    );
  }

  /* ═══ CREATE SESSION ═══ */
  if (screen === "create") {
    return (
      <div className="px-4 pt-4 pb-24 space-y-5">
        <button onClick={() => setScreen("home")} className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-xl font-display font-bold text-foreground">Create Session</h1>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Session Name</label>
          <Input value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="My New Track" className="bg-card border-border text-foreground h-12 rounded-xl text-base" />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Upload Beat</label>
          <input ref={beatInputRef} type="file" accept="audio/*,.mp3,.wav,.ogg,.flac,.aac,.m4a" onChange={handleBeatUpload} className="hidden" />
          <button onClick={() => beatInputRef.current?.click()} className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-border bg-card active:scale-[0.98] transition-all">
            <Upload className="w-5 h-5 text-primary" />
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">{beatName || "Choose audio file"}</p>
              <p className="text-xs text-muted-foreground">MP3, WAV, OGG, FLAC</p>
            </div>
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cover Image (optional)</label>
          <input ref={coverInputRef} type="file" accept="image/*,.jpg,.jpeg,.png,.webp" onChange={handleCoverUpload} className="hidden" />
          <button onClick={() => coverInputRef.current?.click()} className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-border bg-card active:scale-[0.98] transition-all">
            {coverPreview ? (
              <img src={coverPreview} alt="Cover" className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <Image className="w-5 h-5 text-primary" />
            )}
            <p className="text-sm font-semibold text-foreground">{coverFile ? coverFile.name : "Add cover art"}</p>
          </button>
        </div>

        <Button onClick={handleCreateSession} className="w-full h-12 rounded-xl text-base font-bold" disabled={!sessionName.trim() || !user}>
          Continue to Studio
        </Button>
      </div>
    );
  }

  /* ═══ RECORDING SCREEN (DAW View) ═══ */
  if (screen === "record") {
    return (
      <StudioDAWView
        sessionName={activeSessionName}
        beatName={activeSessionBeatName}
        beatUrl={beatUrl}
        takes={takes}
        activeTakeId={activeTakeId}
        setActiveTakeId={setActiveTakeId}
        isRecording={engine.isRecording}
        isPlaying={engine.isPlaying}
        recordTime={engine.recordTime}
        playbackTime={engine.playbackTime}
        playbackDuration={engine.playbackDuration}
        liveWaveform={engine.liveWaveform}
        beatVolume={beatVolume}
        setBeatVolume={setBeatVolume}
        vocalVolume={vocalVolume}
        setVocalVolume={setVocalVolume}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onPlayActiveTake={() => {
          if (activeTake) {
            if (engine.isPlaying) pauseTakePlayback();
            else playTake(activeTake);
          }
        }}
        onStopPlayback={stopTakePlayback}
        onPausePlayback={pauseTakePlayback}
        onToggleMute={toggleMuteTake}
        onToggleSolo={toggleSoloTake}
        onSave={saveSession}
        savingTake={savingTake}
        onNavigate={(s) => {
          if (s === "export") setExportTitle(activeSessionName || "");
          setScreen(s as Screen);
        }}
        onBack={() => { engine.stopPlayback(); setScreen("home"); }}
        beatPan={beatPan}
        setBeatPan={setBeatPan}
        vocalPan={vocalPan}
        setVocalPan={setVocalPan}
      />
    );
  }

  /* ═══ TAKES MANAGEMENT ═══ */
  if (screen === "takes") {
    return (
      <div className="px-4 pt-4 pb-24 space-y-4">
        <button onClick={() => setScreen("record")} className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Studio
        </button>
        <h1 className="text-xl font-display font-bold text-foreground">Takes</h1>

        {takes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Mic className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No takes yet. Go record!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {takes.map(take => (
              <div key={take.id} className={`p-4 rounded-2xl border space-y-3 ${activeTakeId === take.id ? "bg-primary/5 border-primary/30" : "bg-card border-border"}`}>
                <div className="flex items-center justify-between">
                  {editingTakeId === take.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input value={editingName} onChange={e => setEditingName(e.target.value)} className="h-8 text-sm bg-background" autoFocus />
                      <button onClick={() => renameTake(take.id, editingName)} className="text-green-400"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingTakeId(null)} className="text-red-400"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setActiveTakeId(take.id)} className={`w-3 h-3 rounded-full ${activeTakeId === take.id ? "bg-primary" : "bg-muted-foreground/30"}`} />
                      <span className="text-sm font-bold text-foreground">{take.name}</span>
                      <span className="text-xs text-muted-foreground">{fmt(take.duration)}</span>
                    </div>
                  )}
                  {editingTakeId !== take.id && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditingTakeId(take.id); setEditingName(take.name); }} className="p-1.5 rounded-lg hover:bg-muted"><Edit3 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                      <button onClick={() => deleteTake(take.id)} className="p-1.5 rounded-lg hover:bg-destructive/10"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
                    </div>
                  )}
                </div>

                {/* Waveform preview */}
                {take.waveform.length > 0 && (
                  <div className="flex items-end gap-0.5 h-8 w-full">
                    {take.waveform.slice(0, 60).map((peak, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-sm ${activeTakeId === take.id ? "bg-primary/60" : "bg-muted-foreground/30"}`}
                        style={{ height: `${Math.max(peak * 100, 8)}%` }}
                      />
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => toggleMuteTake(take.id)} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${take.muted ? "bg-red-500/20 text-red-400" : "bg-muted text-muted-foreground"}`}>
                    {take.muted ? "Muted" : "Mute"}
                  </button>
                  <button onClick={() => toggleSoloTake(take.id)} className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${take.solo ? "bg-yellow-500/20 text-yellow-400" : "bg-muted text-muted-foreground"}`}>
                    {take.solo ? "Solo ✓" : "Solo"}
                  </button>
                  <button onClick={() => playTake(take)} className="flex-1 py-2 rounded-xl text-xs font-bold bg-primary/10 text-primary">
                    Play ▶
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Scissors className="w-3 h-3" /> Trim</p>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground w-8">Start</span>
                    <Slider value={[take.trimStart]} onValueChange={([v]) => updateTrimStart(take.id, v)} max={100} step={1} className="flex-1" />
                    <span className="text-[10px] text-muted-foreground w-8">{take.trimStart}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground w-8">End</span>
                    <Slider value={[take.trimEnd]} onValueChange={([v]) => updateTrimEnd(take.id, v)} max={100} step={1} className="flex-1" />
                    <span className="text-[10px] text-muted-foreground w-8">{take.trimEnd}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ═══ EFFECTS / MIX ═══ */
  if (screen === "effects") {
    return (
      <div className="px-4 pt-4 pb-24 space-y-5">
        <button onClick={() => setScreen("record")} className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Studio
        </button>
        <h1 className="text-xl font-display font-bold text-foreground">Effects & Mix</h1>

        <div className="space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Vocal Presets</h3>
          <div className="grid grid-cols-3 gap-2">
            {EFFECT_PRESETS.map(preset => (
              <button key={preset.id} onClick={() => setActiveEffect(preset.id)} className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl border transition-all active:scale-95 ${activeEffect === preset.id ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border text-foreground"}`}>
                <span className="text-xl">{preset.icon}</span>
                <span className="text-[11px] font-semibold">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Mix Controls</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground flex items-center gap-2"><Mic className="w-4 h-4 text-primary" /> Vocal Gain</span>
              <span className="text-sm text-muted-foreground">{vocalGain}%</span>
            </div>
            <Slider value={[vocalGain]} onValueChange={([v]) => setVocalGain(v)} max={150} step={1} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground flex items-center gap-2"><Music className="w-4 h-4 text-primary" /> Beat Gain</span>
              <span className="text-sm text-muted-foreground">{beatGain}%</span>
            </div>
            <Slider value={[beatGain]} onValueChange={([v]) => setBeatGain(v)} max={150} step={1} />
          </div>
        </div>
      </div>
    );
  }

  /* ═══ EXPORT ═══ */
  if (screen === "export") {
    return (
      <div className="px-4 pt-4 pb-24 space-y-5">
        <button onClick={() => setScreen("record")} className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Studio
        </button>
        <h1 className="text-xl font-display font-bold text-foreground">Export Track</h1>

        {activeTake && (
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Headphones className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{activeTake.name}</p>
              <p className="text-xs text-muted-foreground">{fmt(activeTake.duration)} · {activeSessionBeatName || "No beat"}</p>
            </div>
            <button onClick={() => playTake(activeTake)} className="p-2 rounded-full bg-primary/10">
              <Play className="w-4 h-4 text-primary" />
            </button>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Song Title</label>
            <Input value={exportTitle} onChange={e => setExportTitle(e.target.value)} placeholder="My Song" className="h-12 rounded-xl bg-card border-border text-base" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Artist Name</label>
            <Input value={exportArtist} onChange={e => setExportArtist(e.target.value)} placeholder="Your Name" className="h-12 rounded-xl bg-card border-border text-base" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Artwork (optional)</label>
            <input ref={artworkInputRef} type="file" accept="image/*,.jpg,.jpeg,.png,.webp" onChange={handleArtworkUpload} className="hidden" />
            <button onClick={() => artworkInputRef.current?.click()} className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-border bg-card active:scale-[0.98] transition-all">
              {exportArtworkPreview ? (
                <img src={exportArtworkPreview} alt="Art" className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <Image className="w-5 h-5 text-primary" />
              )}
              <p className="text-sm font-semibold text-foreground">{exportArtwork ? exportArtwork.name : "Add artwork"}</p>
            </button>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 p-3 rounded-xl bg-card border border-border text-center">
              <p className="text-xs text-muted-foreground">WebM</p>
              <p className="text-sm font-bold text-foreground">Available</p>
            </div>
            <div className="flex-1 p-3 rounded-xl bg-muted border border-border text-center opacity-50">
              <p className="text-xs text-muted-foreground">WAV</p>
              <p className="text-sm font-bold text-muted-foreground">Soon</p>
            </div>
            <div className="flex-1 p-3 rounded-xl bg-muted border border-border text-center opacity-50">
              <p className="text-xs text-muted-foreground">MP3</p>
              <p className="text-sm font-bold text-muted-foreground">Soon</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Button onClick={handleExport} disabled={isExporting || !activeTakeId} className="w-full h-12 rounded-xl text-base font-bold gap-2">
            {isExporting ? <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <Download className="w-5 h-5" />}
            Export Audio
          </Button>
          <Button variant="outline" onClick={handleSaveDraft} className="w-full h-12 rounded-xl text-base font-bold gap-2">
            <Save className="w-5 h-5" /> Save Draft
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

export default RecordingStudio;
