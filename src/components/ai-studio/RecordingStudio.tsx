import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useRecordingEngine } from "@/hooks/use-recording-engine";
import WStudioNav, { type WStudioScreen } from "./studio/WStudioNav";
import HomeScreen from "./studio/HomeScreen";
import DAWScreen, { type TakeLocal } from "./studio/DAWScreen";
import MixerScreen from "./studio/MixerScreen";
import ExportScreen from "./studio/ExportScreen";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Upload, Image, Music } from "lucide-react";

/* ═══ Helpers ═══ */
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
  } catch { return null; }
}

function getR2Url(key: string): string {
  return `${SUPABASE_URL}/functions/v1/r2-download?key=${encodeURIComponent(key)}`;
}

async function generateWaveformFromUrl(url: string): Promise<number[]> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const samples = 100;
    const blockSize = Math.floor(channelData.length / samples);
    const peaks: number[] = [];
    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) sum += Math.abs(channelData[i * blockSize + j]);
      peaks.push(Math.min((sum / blockSize) * 3, 1));
    }
    audioCtx.close();
    return peaks;
  } catch { return []; }
}

/* ═══ Types ═══ */
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

/* ═══ Main Component ═══ */
const RecordingStudio = () => {
  const { user, session, loading: authLoading } = useAuth();
  const engine = useRecordingEngine();

  // Navigation
  const [screen, setScreen] = useState<WStudioScreen | "create">("home");

  // Sessions
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [exports, setExports] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Create session form
  const [sessionName, setSessionName] = useState("");
  const [beatFile, setBeatFile] = useState<File | null>(null);
  const [beatName, setBeatName] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Active session
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSessionName, setActiveSessionName] = useState("");
  const [beatUrl, setBeatUrl] = useState<string | null>(null);
  const [beatWaveform, setBeatWaveform] = useState<number[]>([]);
  const [takes, setTakes] = useState<TakeLocal[]>([]);
  const [activeTakeId, setActiveTakeId] = useState<string | null>(null);

  // Mixer
  const [beatVolume, setBeatVolume] = useState(80);
  const [beatPan, setBeatPan] = useState(0);
  const [masterVolume, setMasterVolume] = useState(100);

  // Export
  const [isExporting, setIsExporting] = useState(false);

  const beatInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // ── Beat waveform ──
  useEffect(() => {
    if (beatUrl) {
      generateWaveformFromUrl(beatUrl).then(peaks => {
        setBeatWaveform(peaks.length > 0 ? peaks : Array.from({ length: 100 }, () => 0.15 + Math.random() * 0.65));
      });
    } else setBeatWaveform([]);
  }, [beatUrl]);

  // ── Load sessions ──
  const loadSessions = useCallback(async () => {
    if (!user) return;
    setLoadingSessions(true);
    try {
      const { data } = await supabase.from("recording_sessions" as any).select("*")
        .eq("user_id", user.id).order("created_at", { ascending: false });
      if (data) {
        const ids = (data as any[]).map((s: any) => s.id);
        let counts: Record<string, number> = {};
        if (ids.length > 0) {
          const { data: td } = await supabase.from("recording_takes" as any).select("session_id").in("session_id", ids);
          if (td) (td as any[]).forEach((t: any) => { counts[t.session_id] = (counts[t.session_id] || 0) + 1; });
        }
        setSessions((data as any[]).map((s: any) => ({ ...s, takesCount: counts[s.id] || 0 })));
      }
    } catch {}
    setLoadingSessions(false);
  }, [user]);

  const loadExports = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("recording_exports" as any).select("*")
      .eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setExports(data as any[]);
  }, [user]);

  useEffect(() => {
    if (user && screen === "home") { loadSessions(); loadExports(); }
  }, [user, screen, loadSessions, loadExports]);

  // ── Load takes ──
  const loadTakes = useCallback(async (sessionId: string) => {
    if (!user) return;
    const { data } = await supabase.from("recording_takes" as any).select("*")
      .eq("session_id", sessionId).order("created_at", { ascending: true });
    if (data) {
      const loaded: TakeLocal[] = (data as any[]).map((t: any) => ({
        id: t.id, name: t.name,
        audioUrl: t.audio_url ? getR2Url(t.audio_url) : "",
        duration: t.duration, muted: t.muted, solo: t.solo,
        trimStart: t.trim_start, trimEnd: t.trim_end,
        waveform: Array.isArray(t.waveform_data) ? t.waveform_data : [],
        createdAt: t.created_at, persisted: true, volume: 100, pan: 0,
      }));
      setTakes(loaded);
      setActiveTakeId(loaded[0]?.id || null);
    }
  }, [user]);

  // ── Open session ──
  const openSession = useCallback(async (s: SessionRecord) => {
    setActiveSessionId(s.id);
    setActiveSessionName(s.name);
    setBeatUrl(s.beat_url ? getR2Url(s.beat_url) : null);
    setBeatName(s.beat_name);
    await loadTakes(s.id);
    setScreen("studio");
  }, [loadTakes]);

  // ── Delete session ──
  const deleteSession = useCallback(async (id: string) => {
    if (!user) return;
    await supabase.from("recording_takes" as any).delete().eq("session_id", id);
    await supabase.from("recording_sessions" as any).delete().eq("id", id);
    setSessions(prev => prev.filter(s => s.id !== id));
    toast({ title: "Session deleted" });
  }, [user]);

  // ── Create session ──
  const handleCreateSession = useCallback(async () => {
    if (!sessionName.trim() || isCreating) return;
    const currentUser = user ?? session?.user ?? null;
    if (!currentUser) { toast({ title: "Please sign in", variant: "destructive" }); return; }
    setIsCreating(true);
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      const active = refreshed.session ?? session ?? null;
      if (!active?.user) { toast({ title: "Session expired", variant: "destructive" }); return; }

      const { data, error } = await supabase.from("recording_sessions" as any)
        .insert({ user_id: active.user.id, name: sessionName.trim(), beat_name: beatName, is_draft: true } as any)
        .select().maybeSingle();

      if (error || !data) { toast({ title: "Failed", variant: "destructive" }); return; }

      const created = data as any;
      setActiveSessionId(created.id);
      setActiveSessionName(created.name);
      setTakes([]);
      setActiveTakeId(null);
      setScreen("studio");
      toast({ title: "Session created!" });

      // Background upload
      if (beatFile || coverFile) {
        const uid = active.user.id;
        const sid = created.id;
        (async () => {
          const patch: any = {};
          if (beatFile) {
            const key = await uploadToR2(beatFile, `studio/${uid}`, `beat-${Date.now()}-${beatFile.name}`);
            if (key) { patch.beat_url = key; setBeatUrl(getR2Url(key)); }
          }
          if (coverFile) {
            const key = await uploadToR2(coverFile, `studio/${uid}`, `cover-${Date.now()}-${coverFile.name}`);
            if (key) patch.cover_url = key;
          }
          if (Object.keys(patch).length) await supabase.from("recording_sessions" as any).update(patch).eq("id", sid);
        })();
      }

      if (beatFile) setBeatUrl(URL.createObjectURL(beatFile));
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setIsCreating(false); }
  }, [sessionName, isCreating, user, session, beatName, beatFile, coverFile]);

  // ── Recording ──
  const startRecording = useCallback(async () => {
    if (!activeSessionId || !user) return;
    const result = await engine.startRecording(beatUrl, beatVolume);
    if (!result) { toast({ title: "Mic access denied", variant: "destructive" }); return; }

    const takeNum = takes.length + 1;
    const takeName = `Take ${takeNum}`;
    const audioKey = await uploadToR2(result.blob, `studio/${user.id}`, `take-${activeSessionId}-${Date.now()}.webm`);

    if (!audioKey) {
      const newTake: TakeLocal = {
        id: crypto.randomUUID(), name: takeName, audioUrl: URL.createObjectURL(result.blob),
        blob: result.blob, duration: result.duration, muted: false, solo: false,
        trimStart: 0, trimEnd: 100, waveform: result.waveform,
        createdAt: new Date().toISOString(), persisted: false, volume: 100, pan: 0,
      };
      setTakes(prev => [...prev, newTake]);
      setActiveTakeId(newTake.id);
      toast({ title: "Take saved locally" });
      return;
    }

    const wf = result.waveform.length > 100
      ? Array.from({ length: 100 }, (_, i) => result.waveform[Math.floor(i * result.waveform.length / 100)])
      : result.waveform;

    const { data, error } = await supabase.from("recording_takes" as any)
      .insert({ session_id: activeSessionId, user_id: user.id, name: takeName, audio_url: audioKey, duration: result.duration, waveform_data: wf } as any)
      .select().single();

    if (error || !data) { toast({ title: "Failed to save", variant: "destructive" }); return; }
    const saved = data as any;
    const newTake: TakeLocal = {
      id: saved.id, name: saved.name, audioUrl: getR2Url(audioKey),
      duration: saved.duration, muted: false, solo: false,
      trimStart: 0, trimEnd: 100, waveform: wf,
      createdAt: saved.created_at, persisted: true, volume: 100, pan: 0,
    };
    setTakes(prev => [...prev, newTake]);
    setActiveTakeId(newTake.id);
    toast({ title: `🎙️ ${takeName} saved!` });
  }, [beatUrl, beatVolume, activeSessionId, user, takes.length, engine]);

  // ── Playback ──
  const getPlayableTakes = useCallback((src: TakeLocal[]) => {
    const soloed = src.filter(t => !t.muted && t.solo);
    const soloIds = new Set(soloed.map(t => t.id));
    const hasSolo = soloIds.size > 0;
    return src.map(t => ({
      id: t.id, audioUrl: t.audioUrl,
      volume: hasSolo ? (soloIds.has(t.id) ? t.volume : 0) : (t.muted ? 0 : t.volume),
      pan: t.pan, trimStart: t.trimStart, trimEnd: t.trimEnd,
    }));
  }, []);

  const playAll = useCallback((loop = false) => {
    if (engine.isPlaying) { engine.pausePlayback(); return; }
    const playable = getPlayableTakes(takes);
    if (playable.length > 0 || beatUrl) {
      engine.playAudio({ beatUrl, beatVolume, beatPan, loop, masterVolume, takes: playable, effects: { eqLow: 0, eqMid: 0, eqHigh: 0, compressionAmount: 18, reverbMix: 8, reverbDecay: 1.1, delayTime: 0.2, delayFeedback: 10, delayMix: 0, outputGain: 80 } });
    }
  }, [engine, takes, beatUrl, beatVolume, beatPan, masterVolume, getPlayableTakes]);

  // Sync mixer changes during playback
  useEffect(() => {
    if (!engine.isPlaying) return;
    engine.updatePlaybackMix?.({ masterVolume, beatVolume, beatPan, takes: getPlayableTakes(takes), effects: { eqLow: 0, eqMid: 0, eqHigh: 0, compressionAmount: 18, reverbMix: 8, reverbDecay: 1.1, delayTime: 0.2, delayFeedback: 10, delayMix: 0, outputGain: 80 } });
  }, [engine, masterVolume, beatVolume, beatPan, takes, getPlayableTakes]);

  // ── Mute/Solo/Volume ──
  const toggleMute = useCallback((id: string) => {
    setTakes(prev => prev.map(t => t.id === id ? { ...t, muted: !t.muted } : t));
  }, []);
  const toggleSolo = useCallback((id: string) => {
    setTakes(prev => prev.map(t => t.id === id ? { ...t, solo: !t.solo } : t));
  }, []);
  const updateTakeVolume = useCallback((id: string, volume: number) => {
    setTakes(prev => prev.map(t => t.id === id ? { ...t, volume } : t));
  }, []);
  const updateTakePan = useCallback((id: string, pan: number) => {
    setTakes(prev => prev.map(t => t.id === id ? { ...t, pan } : t));
  }, []);

  // ── Export ──
  const handleExport = useCallback(async (title: string, artist: string, format: string, artwork: File | null) => {
    if (!activeTakeId || !user) { toast({ title: "Select a take first", variant: "destructive" }); return; }
    const take = takes.find(t => t.id === activeTakeId);
    if (!take) return;
    setIsExporting(true);
    try {
      const dlRes = await fetch(take.audioUrl);
      const audioBlob = await dlRes.blob();

      let coverKey: string | null = null;
      if (artwork) coverKey = await uploadToR2(artwork, `studio/${user.id}`, `export-cover-${Date.now()}.jpg`);

      await supabase.from("recording_exports" as any).insert({
        session_id: activeSessionId, user_id: user.id,
        title: title || activeSessionName || "Untitled",
        artist_name: artist || null,
        audio_url: take.audioUrl.includes("r2-download") ? take.audioUrl.split("key=")[1] : null,
        cover_url: coverKey,
      } as any);

      await supabase.from("ai_generations").insert({
        user_id: user.id, title: title || "Untitled", type: "Recording",
        production_notes: `Recorded in W.Studio`,
      });

      const a = document.createElement("a");
      a.href = URL.createObjectURL(audioBlob);
      a.download = `${title || "recording"}.webm`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: "🎵 Exported!" });
    } catch { toast({ title: "Export failed", variant: "destructive" }); }
    setIsExporting(false);
  }, [activeTakeId, takes, activeSessionId, activeSessionName, user]);

  // ── Form handlers ──
  const handleBeatUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBeatFile(file);
    setBeatName(file.name);
    setBeatUrl(URL.createObjectURL(file));
  };
  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };
  const resetForm = () => {
    setSessionName(""); setBeatFile(null); setBeatUrl(null); setBeatName(null);
    setCoverFile(null); setCoverPreview(null);
  };

  // ── Navigate ──
  const navScreen = screen === "create" ? "home" : screen;
  const handleNav = (s: WStudioScreen) => {
    if (s === "studio" && !activeSessionId) {
      toast({ title: "Open or create a session first" });
      return;
    }
    setScreen(s);
  };

  /* ═══ CREATE SESSION SCREEN ═══ */
  if (screen === "create") {
    return (
      <div className="flex flex-col h-full" style={{ background: "#111122" }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#333]" style={{ background: "#1a1a2e" }}>
          <button onClick={() => setScreen("home")} className="p-1">
            <ArrowLeft className="w-5 h-5 text-[#888]" />
          </button>
          <h1 className="text-lg font-bold text-white">New Song</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#888] uppercase tracking-wider">Session Name</label>
            <Input value={sessionName} onChange={e => setSessionName(e.target.value)}
              placeholder="My New Track"
              className="h-12 rounded-xl text-base border-[#333] text-white placeholder:text-[#555]"
              style={{ background: "#1a1a2e" }} />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[#888] uppercase tracking-wider">Upload Beat</label>
            <input ref={beatInputRef} type="file" accept="audio/*,.mp3,.wav,.ogg,.flac,.aac,.m4a" onChange={handleBeatUpload} className="hidden" />
            <button onClick={() => beatInputRef.current?.click()}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-dashed border-[#444] active:scale-[0.98] transition-transform"
              style={{ background: "#1a1a2e" }}>
              <Upload className="w-5 h-5 text-[#63b3ed]" />
              <div className="text-left">
                <p className="text-sm font-semibold text-white">{beatName || "Choose audio file"}</p>
                <p className="text-xs text-[#666]">MP3, WAV, OGG, FLAC</p>
              </div>
            </button>
            {beatUrl && (
              <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "#1a1a2e" }}>
                <Music className="w-4 h-4 text-[#63b3ed]" />
                <span className="text-xs text-[#ccc] truncate flex-1">{beatName}</span>
                <span className="text-[10px] text-[#22c55e]">✓ Loaded</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[#888] uppercase tracking-wider">Cover Image (optional)</label>
            <input ref={coverInputRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
            <button onClick={() => coverInputRef.current?.click()}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-dashed border-[#444] active:scale-[0.98] transition-transform"
              style={{ background: "#1a1a2e" }}>
              {coverPreview ? <img src={coverPreview} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <Image className="w-5 h-5 text-[#63b3ed]" />}
              <p className="text-sm font-semibold text-white">{coverFile ? coverFile.name : "Add cover art"}</p>
            </button>
          </div>

          <button onClick={handleCreateSession}
            disabled={!sessionName.trim() || !user || isCreating}
            className="w-full py-3.5 rounded-xl text-base font-bold text-white disabled:opacity-40 active:scale-[0.98] transition-transform"
            style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)", boxShadow: "0 4px 15px #3b82f640" }}>
            {isCreating ? "Creating..." : "Start Recording"}
          </button>
        </div>
      </div>
    );
  }

  /* ═══ MAIN LAYOUT ═══ */
  return (
    <div className="flex flex-col h-full" style={{ background: "#111122" }}>
      {screen === "home" && (
        <HomeScreen
          sessions={sessions}
          exports={exports}
          loading={loadingSessions}
          onOpenSession={openSession}
          onDeleteSession={deleteSession}
          onNewSong={() => { resetForm(); setScreen("create"); }}
        />
      )}

      {screen === "studio" && (
        <DAWScreen
          sessionName={activeSessionName}
          beatName={beatName}
          beatUrl={beatUrl}
          beatWaveform={beatWaveform}
          takes={takes}
          activeTakeId={activeTakeId}
          isRecording={engine.isRecording}
          isPlaying={engine.isPlaying}
          recordTime={engine.recordTime}
          playbackTime={engine.playbackTime}
          playbackDuration={engine.playbackDuration}
          liveWaveform={engine.liveWaveform}
          onStartRecording={startRecording}
          onStopRecording={() => engine.stopRecording()}
          onPlayAll={playAll}
          onStopPlayback={() => engine.stopPlayback()}
          onBack={() => setScreen("home")}
          onAddTrack={() => {
            if (!activeSessionId) { toast({ title: "Create a session first" }); return; }
            startRecording();
          }}
          onDeleteTake={(id: string) => {
            setTakes(prev => prev.filter(t => t.id !== id));
            if (activeTakeId === id) setActiveTakeId(null);
          }}
          onImportAudio={() => {
            // Trigger the beat file input for importing additional audio
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "audio/*,.mp3,.wav,.ogg,.flac,.aac,.m4a";
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (!file || !user || !activeSessionId) return;
              const blobUrl = URL.createObjectURL(file);
              const wf = await generateWaveformFromUrl(blobUrl);
              const audio = new Audio(blobUrl);
              audio.onloadedmetadata = () => {
                const dur = audio.duration === Infinity ? 30 : audio.duration;
                const newTake: TakeLocal = {
                  id: crypto.randomUUID(), name: file.name.replace(/\.[^.]+$/, ""),
                  audioUrl: blobUrl, blob: file, duration: dur,
                  muted: false, solo: false, trimStart: 0, trimEnd: 100,
                  waveform: wf.length > 0 ? wf : Array.from({ length: 100 }, () => Math.random() * 0.8),
                  createdAt: new Date().toISOString(), persisted: false, volume: 100, pan: 0,
                };
                setTakes(prev => [...prev, newTake]);
                setActiveTakeId(newTake.id);
                toast({ title: `🎵 Imported ${file.name}` });
              };
            };
            input.click();
          }}
        />
      )}

      {screen === "mixer" && (
        <MixerScreen
          beatName={beatName}
          takes={takes}
          beatVolume={beatVolume}
          setBeatVolume={setBeatVolume}
          beatPan={beatPan}
          setBeatPan={setBeatPan}
          masterVolume={masterVolume}
          setMasterVolume={setMasterVolume}
          onToggleMute={toggleMute}
          onToggleSolo={toggleSolo}
          onUpdateTakeVolume={updateTakeVolume}
          onUpdateTakePan={updateTakePan}
          isPlaying={engine.isPlaying}
        />
      )}

      {screen === "export" && (
        <ExportScreen
          sessionName={activeSessionName}
          takes={takes}
          activeTakeId={activeTakeId}
          isExporting={isExporting}
          onExport={handleExport}
          onBack={() => setScreen("studio")}
        />
      )}

      <WStudioNav active={navScreen as WStudioScreen} onNavigate={handleNav} />
    </div>
  );
};

export default RecordingStudio;
