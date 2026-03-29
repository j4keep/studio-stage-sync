import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Mic, Play, Pause, Square, Save, Plus, Trash2, Music,
  Upload, Image, Headphones, Download, SkipBack, Settings,
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

const EFFECT_SETTINGS: Record<string, {
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  reverbMix: number;
  reverbDecay: number;
  delayTime: number;
  delayFeedback: number;
  delayMix: number;
}> = {
  clean: { eqLow: 0, eqMid: 0, eqHigh: 1, reverbMix: 8, reverbDecay: 1.1, delayTime: 0.2, delayFeedback: 10, delayMix: 0 },
  warm: { eqLow: 2, eqMid: 1, eqHigh: -1, reverbMix: 14, reverbDecay: 1.5, delayTime: 0.22, delayFeedback: 12, delayMix: 4 },
  reverb: { eqLow: 0, eqMid: 0, eqHigh: 2, reverbMix: 32, reverbDecay: 2.8, delayTime: 0.25, delayFeedback: 10, delayMix: 0 },
  delay: { eqLow: 0, eqMid: 1, eqHigh: 1, reverbMix: 10, reverbDecay: 1.4, delayTime: 0.32, delayFeedback: 28, delayMix: 24 },
  punchy: { eqLow: 1, eqMid: 3, eqHigh: 2, reverbMix: 6, reverbDecay: 0.9, delayTime: 0.18, delayFeedback: 8, delayMix: 0 },
};

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

/** Generate a waveform from an audio URL using Web Audio API */
async function generateWaveformFromUrl(url: string): Promise<number[]> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const samples = 120;
    const blockSize = Math.floor(channelData.length / samples);
    const peaks: number[] = [];
    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(channelData[i * blockSize + j]);
      }
      peaks.push(Math.min((sum / blockSize) * 3, 1));
    }
    audioCtx.close();
    return peaks;
  } catch {
    return [];
  }
}

const RecordingStudio = () => {
  const { user, session, loading: authLoading } = useAuth();
  const engine = useRecordingEngine();

  const [screen, setScreen] = useState<Screen>("home");
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [exports, setExports] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [deletedSessionIds, setDeletedSessionIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

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
  const [masterVolume, setMasterVolume] = useState(100);
  
  // EQ state (allow manual override beyond presets)
  const [eqLow, setEqLow] = useState(0);
  const [eqMid, setEqMid] = useState(0);
  const [eqHigh, setEqHigh] = useState(0);
  const [reverbMix, setReverbMix] = useState(8);
  const [delayMix, setDelayMix] = useState(0);

  const [exportTitle, setExportTitle] = useState("");
  const [exportArtist, setExportArtist] = useState("");
  const [exportArtwork, setExportArtwork] = useState<File | null>(null);
  const [exportArtworkPreview, setExportArtworkPreview] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Beat waveform (generated from actual audio)
  const [beatWaveform, setBeatWaveform] = useState<number[]>([]);

  const beatInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const artworkInputRef = useRef<HTMLInputElement>(null);

  const playbackEffects = useMemo(() => {
    return {
      eqLow,
      eqMid,
      eqHigh,
      reverbMix,
      reverbDecay: EFFECT_SETTINGS[activeEffect]?.reverbDecay ?? 1.1,
      delayTime: EFFECT_SETTINGS[activeEffect]?.delayTime ?? 0.2,
      delayFeedback: EFFECT_SETTINGS[activeEffect]?.delayFeedback ?? 10,
      delayMix,
      outputGain: vocalGain,
    };
  }, [activeEffect, vocalGain, eqLow, eqMid, eqHigh, reverbMix, delayMix]);

  const getPlayableTakes = useCallback((sourceTakes: TakeLocal[]) => {
    const soloed = sourceTakes.filter((take) => !take.muted && take.solo);
    const audible = soloed.length > 0 ? soloed : sourceTakes.filter((take) => !take.muted);

    return audible.map((take) => ({
      id: take.id,
      audioUrl: take.audioUrl,
      volume: vocalVolume,
      pan: vocalPan,
      trimStart: take.trimStart,
      trimEnd: take.trimEnd,
    }));
  }, [vocalPan, vocalVolume]);

  // Generate beat waveform when beat URL changes
  useEffect(() => {
    if (beatUrl) {
      generateWaveformFromUrl(beatUrl).then(peaks => {
        if (peaks.length > 0) setBeatWaveform(peaks);
        else setBeatWaveform(Array.from({ length: 100 }, () => 0.15 + Math.random() * 0.65));
      });
    } else {
      setBeatWaveform([]);
    }
  }, [beatUrl]);

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
    if (!sessionName.trim() || authLoading || isCreating) return;

    const currentUser = user ?? session?.user ?? null;
    if (!currentUser) {
      toast({ title: "Please sign in to create a session", variant: "destructive" });
      return;
    }

    setIsCreating(true);

    try {
      const { data: refreshedSession, error: refreshError } = await supabase.auth.refreshSession();
      const activeSession = refreshedSession.session ?? session ?? null;

      if (refreshError) {
        console.warn("Session refresh warning:", refreshError);
      }

      if (!activeSession?.user) {
        toast({ title: "Session expired — please sign in again", variant: "destructive" });
        return;
      }

      const { data, error } = await supabase
        .from("recording_sessions" as any)
        .insert({
          user_id: activeSession.user.id,
          name: sessionName.trim(),
          beat_url: null,
          beat_name: beatName,
          cover_url: null,
          is_draft: true,
        } as any)
        .select()
        .maybeSingle();

      if (error || !data) {
        console.error("Session create error:", error);
        toast({ title: "Failed to create session", variant: "destructive" });
        return;
      }

      const createdSession = data as any;
      setActiveSessionId(createdSession.id);
      setActiveSessionName(createdSession.name);
      setActiveSessionBeatName(createdSession.beat_name);
      setTakes([]);
      setActiveTakeId(null);
      setScreen("record");
      toast({ title: "Session created!" });

      const ownerId = activeSession.user.id;
      const sessionId = createdSession.id;
      (async () => {
        try {
          let beatR2Key: string | null = null;
          if (beatFile) {
            beatR2Key = await uploadToR2(beatFile, `studio/${ownerId}`, `beat-${Date.now()}-${beatFile.name}`);
          }
          let coverR2Key: string | null = null;
          if (coverFile) {
            coverR2Key = await uploadToR2(coverFile, `studio/${ownerId}`, `cover-${Date.now()}-${coverFile.name}`);
          }
          if (beatR2Key || coverR2Key) {
            const patch: any = {};
            if (beatR2Key) patch.beat_url = beatR2Key;
            if (coverR2Key) patch.cover_url = coverR2Key;
            await supabase.from("recording_sessions" as any).update(patch).eq("id", sessionId);
          }
        } catch (e) {
          console.warn("Background file upload failed:", e);
        }
      })();
    } catch (e) {
      console.error("Create session error:", e);
      toast({ title: "Failed to create session", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  }, [sessionName, authLoading, isCreating, user, session, beatName, beatFile, coverFile]);

  const openSession = useCallback(async (session: SessionRecord) => {
    setActiveSessionId(session.id);
    setActiveSessionName(session.name);
    setActiveSessionBeatName(session.beat_name);
    setBeatUrl(session.beat_url ? getR2Url(session.beat_url) : null);
    setBeatName(session.beat_name);
    await loadTakes(session.id);
    setScreen("record");
  }, [loadTakes]);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!user) return;
    // Delete takes first
    await supabase.from("recording_takes" as any).delete().eq("session_id", sessionId);
    await supabase.from("recording_sessions" as any).delete().eq("id", sessionId);
    setDeletedSessionIds(prev => [...prev, sessionId]);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    toast({ title: "Session deleted" });
  }, [user]);

  const startRecording = useCallback(async () => {
    if (!beatUrl && !activeSessionId) return;
    const result = engine.startRecording(beatUrl, beatVolume);
    
    const recording = await result;
    if (!recording) {
      toast({ title: "Mic access denied", description: "Allow microphone to record", variant: "destructive" });
      return;
    }

    if (!activeSessionId || !user) return;
    setSavingTake(true);

    const takeNum = takes.length + 1;
    const takeName = `Take ${takeNum}`;
    
    const audioKey = await uploadToR2(
      recording.blob,
      `studio/${user.id}`,
      `take-${activeSessionId}-${Date.now()}.webm`
    );

    if (!audioKey) {
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

  // Play all tracks (beat + all audible takes)
  const playAll = useCallback(() => {
    if (engine.isPlaying) {
      engine.pausePlayback();
      return;
    }
    const playableTakes = getPlayableTakes(takes);
    if (playableTakes.length > 0 || beatUrl) {
      engine.playAudio({
        beatUrl,
        beatVolume,
        beatPan,
        masterVolume,
        takes: playableTakes,
        effects: playbackEffects,
      });
    }
  }, [engine, takes, beatUrl, beatVolume, beatPan, masterVolume, getPlayableTakes, playbackEffects]);

  // Play beat only
  const playBeatOnly = useCallback(() => {
    if (engine.isPlaying) {
      engine.pausePlayback();
      return;
    }
    if (beatUrl) {
      engine.playAudio({
        beatUrl,
        beatVolume,
        beatPan,
        masterVolume,
        takes: [],
        effects: playbackEffects,
      });
    }
  }, [engine, beatUrl, beatVolume, beatPan, masterVolume, playbackEffects]);

  // Play a specific take (with beat)
  const playTake = useCallback((take: TakeLocal) => {
    if (take.muted) return;
    if (engine.isPlaying) {
      engine.pausePlayback();
      return;
    }
    setActiveTakeId(take.id);
    engine.playAudio({
      beatUrl,
      beatVolume: beatGain,
      beatPan,
      masterVolume: 100,
      takes: getPlayableTakes([take]),
      effects: playbackEffects,
    });
  }, [engine, beatUrl, beatGain, beatPan, getPlayableTakes, playbackEffects]);

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
      const downloadResponse = await fetch(take.audioUrl);
      const audioBlob = await downloadResponse.blob();

      let coverKey: string | null = null;
      if (exportArtwork) {
        coverKey = await uploadToR2(exportArtwork, `studio/${user.id}`, `export-cover-${Date.now()}.jpg`);
      }

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

      await supabase.from("ai_generations").insert({
        user_id: user.id,
        title: exportTitle || activeSessionName || "Untitled",
        type: "Recording",
        production_notes: `Recorded in W.Studio. Artist: ${exportArtist || "Unknown"}`,
      });

      if (activeSessionId) {
        await supabase.from("recording_sessions" as any).update({ is_draft: false } as any).eq("id", activeSessionId);
      }

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
  const visibleSessions = sessions.filter(s => !deletedSessionIds.includes(s.id));

  /* ═══ HOME ═══ */
  if (screen === "home") {
    return (
      <div className="px-4 pt-6 pb-24 space-y-6 h-full overflow-y-auto" style={{ background: "#2a2a2a" }}>
        {/* Song Browser header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => toast({ title: "Studio Settings", description: "Settings panel coming soon" })} className="p-1 hover:bg-[#444] rounded">
              <Settings className="w-5 h-5 text-[#888]" />
            </button>
            <h1 className="text-lg font-bold text-[#ddd]">Song Browser</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => toast({ title: "Help", description: "W.Studio Help – Create a new song, upload a beat, and record your vocals!" })} className="text-[#888] text-sm hover:text-[#ccc] transition-colors">?</button>
            <button onClick={() => toast({ title: "Open Files", description: "Import audio files from your device" })} className="p-1 hover:bg-[#444] rounded">
              <FolderOpen className="w-5 h-5 text-[#888]" />
            </button>
          </div>
        </div>

        {/* New Song + Collab */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => { resetForm(); setScreen("create"); }}
            className="flex flex-col items-center gap-3 py-6 rounded-xl active:scale-95 transition-all"
            style={{ background: "transparent" }}
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#555" }}>
              <Plus className="w-8 h-8 text-[#ddd]" />
            </div>
            <span className="text-sm font-semibold text-[#ddd]">New song</span>
          </button>
          <button
            onClick={() => toast({ title: "Collab", description: "Collaboration features coming soon!" })}
            className="flex flex-col items-center gap-3 py-6 rounded-xl active:scale-95 transition-all"
            style={{ background: "transparent" }}
          >
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#555" }}>
              <Layers className="w-8 h-8 text-[#8ab4f8]" />
            </div>
            <span className="text-sm font-semibold text-[#ddd]">Collab</span>
          </button>
        </div>

        {/* Session grid */}
        {visibleSessions.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold text-[#888] uppercase tracking-wider">Your Sessions</h2>
            <div className="grid grid-cols-2 gap-3">
              {visibleSessions.map((session, idx) => (
                <div key={session.id} className="relative group">
                  <button
                    onClick={() => openSession(session)}
                    className="flex flex-col items-center gap-2 w-full active:scale-[0.97] transition-all"
                  >
                    {/* Thumbnail with unique color based on index */}
                    <div className="w-full aspect-video rounded-lg border border-[#555] overflow-hidden relative"
                      style={{ background: "#1e1e1e" }}>
                      <div className="absolute inset-0 flex flex-col">
                        <div className="h-1 w-full" style={{ background: ["#4fd1c5", "#63b3ed", "#b794f4", "#f59e0b"][idx % 4] }} />
                        <div className="flex-1 flex items-center px-1">
                          {Array.from({ length: 30 }, (_, i) => {
                            // Use session name hash for unique waveform per session
                            const hash = session.name.charCodeAt(i % session.name.length) + idx;
                            return (
                              <div key={i} className="flex-1 mx-[0.5px]" style={{
                                height: `${20 + ((hash * 17 + i * 31) % 50)}%`,
                                background: ["#4fd1c5", "#63b3ed", "#b794f4", "#f59e0b"][idx % 4],
                                opacity: 0.5,
                                borderRadius: 1,
                              }} />
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-1 px-1 py-0.5" style={{ background: "#333" }}>
                          <div className="w-2 h-2 rounded-full" style={{ background: session.is_draft ? "#eab308" : "#22c55e" }} />
                          <Play className="w-2 h-2 text-[#aaa]" />
                          <span className="text-[5px] font-mono text-[#888] ml-auto">
                            {session.takesCount || 0} take{(session.takesCount || 0) !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-[#ccc] truncate w-full text-center">{session.name}</span>
                  </button>
                  {/* Delete button on hover/long-press */}
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#333]/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-[#999]" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trash */}
        {deletedSessionIds.length > 0 && (
          <div className="flex flex-col items-center gap-2 pt-4">
            <button onClick={() => toast({ title: "Trash", description: `${deletedSessionIds.length} deleted session(s). Permanently removed.` })} className="flex flex-col items-center gap-2 hover:opacity-80 transition-opacity">
              <Trash2 className="w-8 h-8 text-[#666]" />
              <span className="text-sm text-[#666]">Trash ({deletedSessionIds.length})</span>
            </button>
          </div>
        )}

        {loadingSessions && (
          <div className="text-center py-4">
            <div className="w-6 h-6 border-2 border-[#4fd1c5] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {!loadingSessions && visibleSessions.length === 0 && (
          <div className="text-center py-8">
            <Music className="w-10 h-10 mx-auto mb-3 text-[#555]" />
            <p className="text-sm text-[#888]">No sessions yet</p>
            <p className="text-xs text-[#666] mt-1">Tap "New song" to get started</p>
          </div>
        )}
      </div>
    );
  }

  /* ═══ CREATE SESSION ═══ */
  if (screen === "create") {
    return (
      <div className="px-4 pt-4 pb-24 space-y-5 h-full overflow-y-auto" style={{ background: "#2a2a2a" }}>
        <button onClick={() => setScreen("home")} className="flex items-center gap-1 text-sm text-[#888] mb-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-xl font-bold text-[#ddd]">Start your song...</h1>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#888] uppercase tracking-wider">Session Name</label>
          <Input value={sessionName} onChange={e => setSessionName(e.target.value)} placeholder="My New Track" 
            className="h-12 rounded-xl text-base border-[#555] text-[#ddd] placeholder:text-[#666]"
            style={{ background: "#333" }} />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#888] uppercase tracking-wider">Upload Beat</label>
          <input ref={beatInputRef} type="file" accept="audio/*,.mp3,.wav,.ogg,.flac,.aac,.m4a" onChange={handleBeatUpload} className="hidden" />
          <button onClick={() => beatInputRef.current?.click()} className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-[#555] active:scale-[0.98] transition-all"
            style={{ background: "#333" }}>
            <Upload className="w-5 h-5 text-[#4fd1c5]" />
            <div className="text-left">
              <p className="text-sm font-semibold text-[#ddd]">{beatName || "Choose audio file"}</p>
              <p className="text-xs text-[#888]">MP3, WAV, OGG, FLAC</p>
            </div>
          </button>
          {beatUrl && (
            <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "#333" }}>
              <Music className="w-4 h-4 text-[#4fd1c5]" />
              <span className="text-xs text-[#ccc] truncate flex-1">{beatName}</span>
              <span className="text-[10px] text-[#22c55e]">✓ Loaded</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#888] uppercase tracking-wider">Cover Image (optional)</label>
          <input ref={coverInputRef} type="file" accept="image/*,.jpg,.jpeg,.png,.webp" onChange={handleCoverUpload} className="hidden" />
          <button onClick={() => coverInputRef.current?.click()} className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-[#555] active:scale-[0.98] transition-all"
            style={{ background: "#333" }}>
            {coverPreview ? (
              <img src={coverPreview} alt="Cover" className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <Image className="w-5 h-5 text-[#4fd1c5]" />
            )}
            <p className="text-sm font-semibold text-[#ddd]">{coverFile ? coverFile.name : "Add cover art"}</p>
          </button>
        </div>

        <button onClick={handleCreateSession} disabled={!sessionName.trim() || !user || isCreating}
          className="w-full h-12 rounded-xl text-base font-bold text-white disabled:opacity-40 active:scale-[0.98] transition-all"
          style={{ background: "linear-gradient(180deg, #4fd1c5 0%, #38b2ac 100%)" }}>
          {isCreating ? "Creating…" : "Continue to Studio"}
        </button>
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
        onPlayAll={playAll}
        onPlayBeatOnly={playBeatOnly}
        onPlayTake={playTake}
        onStopPlayback={stopTakePlayback}
        onPausePlayback={pauseTakePlayback}
        onToggleMute={toggleMuteTake}
        onToggleSolo={toggleSoloTake}
        onDeleteTake={deleteTake}
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
        beatWaveform={beatWaveform}
      />
    );
  }

  /* ═══ TAKES MANAGEMENT ═══ */
  if (screen === "takes") {
    return (
      <div className="px-4 pt-4 pb-24 space-y-4 h-full overflow-y-auto" style={{ background: "#2a2a2a" }}>
        <button onClick={() => setScreen("record")} className="flex items-center gap-1 text-sm text-[#888] mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Studio
        </button>
        <h1 className="text-xl font-bold text-[#ddd]">Takes</h1>

        {takes.length === 0 ? (
          <div className="text-center py-12 text-[#666]">
            <Mic className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No takes yet. Go record!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {takes.map(take => (
              <div key={take.id} className={`p-4 rounded-xl border space-y-3 ${activeTakeId === take.id ? "border-[#4fd1c5]/40" : "border-[#444]"}`}
                style={{ background: activeTakeId === take.id ? "#2e3a3a" : "#333" }}>
                <div className="flex items-center justify-between">
                  {editingTakeId === take.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input value={editingName} onChange={e => setEditingName(e.target.value)} className="h-8 text-sm border-[#555] text-[#ddd]" style={{ background: "#222" }} autoFocus />
                      <button onClick={() => renameTake(take.id, editingName)} className="text-green-400"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingTakeId(null)} className="text-red-400"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setActiveTakeId(take.id)} className={`w-3 h-3 rounded-full ${activeTakeId === take.id ? "bg-[#4fd1c5]" : "bg-[#555]"}`} />
                      <span className="text-sm font-bold text-[#ddd]">{take.name}</span>
                      <span className="text-xs text-[#888]">{fmt(take.duration)}</span>
                    </div>
                  )}
                  {editingTakeId !== take.id && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditingTakeId(take.id); setEditingName(take.name); }} className="p-1.5 rounded-lg hover:bg-[#444]"><Edit3 className="w-3.5 h-3.5 text-[#888]" /></button>
                      <button onClick={() => deleteTake(take.id)} className="p-1.5 rounded-lg hover:bg-red-500/20"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                    </div>
                  )}
                </div>

                {take.waveform.length > 0 && (
                  <div className="flex items-end gap-0.5 h-8 w-full">
                    {take.waveform.slice(0, 60).map((peak, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm"
                        style={{
                          height: `${Math.max(peak * 100, 8)}%`,
                          background: activeTakeId === take.id ? "#4fd1c5" : "#555",
                          opacity: activeTakeId === take.id ? 0.7 : 0.4,
                        }}
                      />
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={() => toggleMuteTake(take.id)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${take.muted ? "bg-red-500/20 text-red-400 border-red-500/30" : "text-[#aaa] border-[#555]"}`}
                    style={{ background: take.muted ? undefined : "#444" }}>
                    {take.muted ? "Muted" : "Mute"}
                  </button>
                  <button onClick={() => toggleSoloTake(take.id)} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${take.solo ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" : "text-[#aaa] border-[#555]"}`}
                    style={{ background: take.solo ? undefined : "#444" }}>
                    {take.solo ? "Solo ✓" : "Solo"}
                  </button>
                  <button onClick={() => playTake(take)} className="flex-1 py-2 rounded-lg text-xs font-bold text-[#4fd1c5] border border-[#4fd1c5]/30"
                    style={{ background: "#2a3a3a" }}>
                    Play ▶
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#888] flex items-center gap-1"><Scissors className="w-3 h-3" /> Trim</p>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[#888] w-8">Start</span>
                    <Slider value={[take.trimStart]} onValueChange={([v]) => updateTrimStart(take.id, v)} max={100} step={1} className="flex-1" />
                    <span className="text-[10px] text-[#888] w-8">{take.trimStart}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[#888] w-8">End</span>
                    <Slider value={[take.trimEnd]} onValueChange={([v]) => updateTrimEnd(take.id, v)} max={100} step={1} className="flex-1" />
                    <span className="text-[10px] text-[#888] w-8">{take.trimEnd}%</span>
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
      <div className="px-4 pt-4 pb-24 space-y-5 h-full overflow-y-auto" style={{ background: "#2a2a2a" }}>
        <button onClick={() => setScreen("record")} className="flex items-center gap-1 text-sm text-[#888] mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Studio
        </button>
        <h1 className="text-xl font-bold text-[#ddd]">Effects & Mix</h1>

        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#888] uppercase tracking-wider">Vocal Presets</h3>
          <div className="grid grid-cols-3 gap-2">
            {EFFECT_PRESETS.map(preset => (
              <button key={preset.id} onClick={() => setActiveEffect(preset.id)}
                className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all active:scale-95 ${
                  activeEffect === preset.id ? "border-[#4fd1c5]/50 text-[#4fd1c5]" : "border-[#555] text-[#ccc]"
                }`}
                style={{ background: activeEffect === preset.id ? "#2a3a3a" : "#333" }}>
                <span className="text-xl">{preset.icon}</span>
                <span className="text-[11px] font-semibold">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-5 space-y-5 border border-[#444]" style={{ background: "#333" }}>
          <h3 className="text-xs font-bold text-[#888] uppercase tracking-wider">Mix Controls</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#ddd] flex items-center gap-2"><Mic className="w-4 h-4 text-[#4fd1c5]" /> Vocal Gain</span>
              <span className="text-sm text-[#888]">{vocalGain}%</span>
            </div>
            <Slider value={[vocalGain]} onValueChange={([v]) => setVocalGain(v)} max={150} step={1} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#ddd] flex items-center gap-2"><Music className="w-4 h-4 text-[#4fd1c5]" /> Beat Gain</span>
              <span className="text-sm text-[#888]">{beatGain}%</span>
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
      <div className="px-4 pt-4 pb-24 space-y-5 h-full overflow-y-auto" style={{ background: "#2a2a2a" }}>
        <button onClick={() => setScreen("record")} className="flex items-center gap-1 text-sm text-[#888] mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Studio
        </button>
        <h1 className="text-xl font-bold text-[#ddd]">Export Track</h1>

        {activeTake && (
          <div className="rounded-xl p-4 flex items-center gap-3 border border-[#444]" style={{ background: "#333" }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "#2a3a3a" }}>
              <Headphones className="w-6 h-6 text-[#4fd1c5]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#ddd] truncate">{activeTake.name}</p>
              <p className="text-xs text-[#888]">{fmt(activeTake.duration)} · {activeSessionBeatName || "No beat"}</p>
            </div>
            <button onClick={() => playTake(activeTake)} className="p-2 rounded-full" style={{ background: "#2a3a3a" }}>
              <Play className="w-4 h-4 text-[#4fd1c5]" />
            </button>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#888] uppercase tracking-wider">Song Title</label>
            <Input value={exportTitle} onChange={e => setExportTitle(e.target.value)} placeholder="My Song"
              className="h-12 rounded-xl text-base border-[#555] text-[#ddd] placeholder:text-[#666]"
              style={{ background: "#333" }} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#888] uppercase tracking-wider">Artist Name</label>
            <Input value={exportArtist} onChange={e => setExportArtist(e.target.value)} placeholder="Your Name"
              className="h-12 rounded-xl text-base border-[#555] text-[#ddd] placeholder:text-[#666]"
              style={{ background: "#333" }} />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#888] uppercase tracking-wider">Artwork (optional)</label>
            <input ref={artworkInputRef} type="file" accept="image/*,.jpg,.jpeg,.png,.webp" onChange={handleArtworkUpload} className="hidden" />
            <button onClick={() => artworkInputRef.current?.click()} className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-[#555] active:scale-[0.98] transition-all"
              style={{ background: "#333" }}>
              {exportArtworkPreview ? (
                <img src={exportArtworkPreview} alt="Art" className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <Image className="w-5 h-5 text-[#4fd1c5]" />
              )}
              <p className="text-sm font-semibold text-[#ddd]">{exportArtwork ? exportArtwork.name : "Add artwork"}</p>
            </button>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 p-3 rounded-xl border border-[#555] text-center" style={{ background: "#333" }}>
              <p className="text-xs text-[#888]">WebM</p>
              <p className="text-sm font-bold text-[#ddd]">Available</p>
            </div>
            <div className="flex-1 p-3 rounded-xl border border-[#444] text-center opacity-50" style={{ background: "#2a2a2a" }}>
              <p className="text-xs text-[#666]">WAV</p>
              <p className="text-sm font-bold text-[#666]">Soon</p>
            </div>
            <div className="flex-1 p-3 rounded-xl border border-[#444] text-center opacity-50" style={{ background: "#2a2a2a" }}>
              <p className="text-xs text-[#666]">MP3</p>
              <p className="text-sm font-bold text-[#666]">Soon</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button onClick={handleExport} disabled={isExporting || !activeTakeId}
            className="w-full h-12 rounded-xl text-base font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-all"
            style={{ background: "linear-gradient(180deg, #4fd1c5 0%, #38b2ac 100%)" }}>
            {isExporting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download className="w-5 h-5" />}
            Export Audio
          </button>
          <button onClick={handleSaveDraft}
            className="w-full h-12 rounded-xl text-base font-bold text-[#ccc] flex items-center justify-center gap-2 border border-[#555] active:scale-[0.98] transition-all"
            style={{ background: "#333" }}>
            <Save className="w-5 h-5" /> Save Draft
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default RecordingStudio;
