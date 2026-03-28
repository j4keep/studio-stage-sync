import { useState, useRef, useCallback, useEffect } from "react";
import {
  Mic, Play, Pause, Square, Save, Plus, Trash2,  Music,
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

interface Take {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  duration: number;
  muted: boolean;
  solo: boolean;
  trimStart: number;
  trimEnd: number;
}

interface Session {
  id: string;
  name: string;
  beatUrl: string | null;
  beatName: string | null;
  coverUrl: string | null;
  takes: Take[];
  createdAt: string;
  isDraft: boolean;
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

const RecordingStudio = () => {
  const { user } = useAuth();
  const [screen, setScreen] = useState<Screen>("home");
  const [sessions, setSessions] = useState<Session[]>(() => {
    try {
      const raw = localStorage.getItem("wstudio_sessions");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const [sessionName, setSessionName] = useState("");
  const [beatFile, setBeatFile] = useState<File | null>(null);
  const [beatUrl, setBeatUrl] = useState<string | null>(null);
  const [beatName, setBeatName] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [beatVolume, setBeatVolume] = useState(80);
  const [vocalVolume, setVocalVolume] = useState(100);
  const [takes, setTakes] = useState<Take[]>([]);
  const [activeTakeId, setActiveTakeId] = useState<string | null>(null);
  const [editingTakeId, setEditingTakeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const [activeEffect, setActiveEffect] = useState<string>("clean");
  const [vocalGain, setVocalGain] = useState(80);
  const [beatGain, setBeatGain] = useState(80);

  const [exportTitle, setExportTitle] = useState("");
  const [exportArtist, setExportArtist] = useState("");
  const [exportArtwork, setExportArtwork] = useState<File | null>(null);
  const [exportArtworkPreview, setExportArtworkPreview] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const beatAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const beatInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const artworkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const meta = sessions.map(s => ({
      ...s,
      takes: s.takes.map(t => ({ ...t, blob: undefined, url: "" })),
    }));
    localStorage.setItem("wstudio_sessions", JSON.stringify(meta));
  }, [sessions]);

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

  const handleCreateSession = useCallback(() => {
    if (!sessionName.trim()) {
      toast({ title: "Enter a session name", variant: "destructive" });
      return;
    }
    const session: Session = {
      id: crypto.randomUUID(),
      name: sessionName.trim(),
      beatUrl,
      beatName,
      coverUrl: coverPreview,
      takes: [],
      createdAt: new Date().toISOString(),
      isDraft: true,
    };
    setActiveSession(session);
    setSessions(prev => [session, ...prev]);
    setTakes([]);
    setActiveTakeId(null);
    setScreen("record");
  }, [sessionName, beatUrl, beatName, coverPreview]);

  const openSession = useCallback((session: Session) => {
    setActiveSession(session);
    setTakes(session.takes);
    setActiveTakeId(session.takes[0]?.id || null);
    setBeatUrl(session.beatUrl);
    setBeatName(session.beatName);
    setScreen("record");
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (beatUrl && beatAudioRef.current) {
        beatAudioRef.current.currentTime = 0;
        beatAudioRef.current.volume = beatVolume / 100;
        beatAudioRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm"
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      const takeCount = takes.length;
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        const newTake: Take = {
          id: crypto.randomUUID(),
          name: `Take ${takeCount + 1}`,
          blob,
          url,
          duration: recordTime,
          muted: false,
          solo: false,
          trimStart: 0,
          trimEnd: 100,
        };
        setTakes(prev => [...prev, newTake]);
        setActiveTakeId(newTake.id);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordTime(0);
      timerRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    } catch {
      toast({ title: "Mic access denied", description: "Allow microphone to record", variant: "destructive" });
    }
  }, [beatUrl, beatVolume, takes.length, recordTime]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (beatAudioRef.current) {
      beatAudioRef.current.pause();
      beatAudioRef.current.currentTime = 0;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setIsPlaying(false);
  }, []);

  const playTake = useCallback((take: Take) => {
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
    }
    const audio = new Audio(take.url);
    playbackAudioRef.current = audio;
    audio.play();
    if (beatUrl && beatAudioRef.current) {
      beatAudioRef.current.currentTime = 0;
      beatAudioRef.current.volume = beatVolume / 100;
      beatAudioRef.current.play();
    }
    setIsPlaying(true);
    audio.onended = () => {
      setIsPlaying(false);
      if (beatAudioRef.current) beatAudioRef.current.pause();
    };
  }, [beatUrl, beatVolume]);

  const deleteTake = useCallback((id: string) => {
    setTakes(prev => prev.filter(t => t.id !== id));
    if (activeTakeId === id) setActiveTakeId(null);
  }, [activeTakeId]);

  const toggleMuteTake = useCallback((id: string) => {
    setTakes(prev => prev.map(t => t.id === id ? { ...t, muted: !t.muted } : t));
  }, []);

  const toggleSoloTake = useCallback((id: string) => {
    setTakes(prev => prev.map(t => t.id === id ? { ...t, solo: !t.solo } : t));
  }, []);

  const renameTake = useCallback((id: string, name: string) => {
    setTakes(prev => prev.map(t => t.id === id ? { ...t, name } : t));
    setEditingTakeId(null);
  }, []);

  const updateTrimStart = useCallback((id: string, val: number) => {
    setTakes(prev => prev.map(t => t.id === id ? { ...t, trimStart: val } : t));
  }, []);

  const updateTrimEnd = useCallback((id: string, val: number) => {
    setTakes(prev => prev.map(t => t.id === id ? { ...t, trimEnd: val } : t));
  }, []);

  const saveSession = useCallback(() => {
    if (!activeSession) return;
    const updated = { ...activeSession, takes, isDraft: true };
    setActiveSession(updated);
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
    toast({ title: "Session saved!" });
  }, [activeSession, takes]);

  const handleExport = useCallback(async () => {
    if (!activeTakeId) {
      toast({ title: "Select a take to export", variant: "destructive" });
      return;
    }
    const take = takes.find(t => t.id === activeTakeId);
    if (!take) return;

    setIsExporting(true);
    const a = document.createElement("a");
    a.href = take.url;
    a.download = `${exportTitle || activeSession?.name || "recording"}.webm`;
    a.click();

    if (user) {
      try {
        await supabase.from("ai_generations").insert({
          user_id: user.id,
          title: exportTitle || activeSession?.name || "Untitled",
          type: "Recording",
          genre: null,
          mood: null,
          production_notes: `Recorded in W.Studio. Artist: ${exportArtist || "Unknown"}`,
        });
        toast({ title: "🎵 Exported & saved to Library!" });
      } catch {
        toast({ title: "Exported! (Library save failed)", variant: "destructive" });
      }
    }
    setIsExporting(false);
  }, [activeTakeId, takes, exportTitle, exportArtist, activeSession, user]);

  const handleSaveDraft = useCallback(() => {
    saveSession();
  }, [saveSession]);

  const activeTake = takes.find(t => t.id === activeTakeId);
  const drafts = sessions.filter(s => s.isDraft);
  const exportsCount = sessions.filter(s => !s.isDraft).length;

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
                    <p className="text-xs text-muted-foreground">{session.takes.length} takes · {session.beatName || "No beat"}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    session.isDraft ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"
                  }`}>
                    {session.isDraft ? "Draft" : "Done"}
                  </span>
                </button>
              ))}
            </div>
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

        <Button onClick={handleCreateSession} className="w-full h-12 rounded-xl text-base font-bold" disabled={!sessionName.trim()}>
          Continue to Studio
        </Button>
      </div>
    );
  }

  /* ═══ RECORDING SCREEN ═══ */
  if (screen === "record") {
    return (
      <div className="px-4 pt-4 pb-24 space-y-4">
        {beatUrl && <audio ref={beatAudioRef} src={beatUrl} preload="auto" />}

        <div className="flex items-center justify-between">
          <button onClick={() => setScreen("home")} className="flex items-center gap-1 text-sm text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="text-sm font-bold text-foreground truncate max-w-[50%]">{activeSession?.name}</h2>
          <button onClick={saveSession} className="text-xs font-bold text-primary">Save</button>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 h-32 flex items-center justify-center relative overflow-hidden">
          {isRecording ? (
            <div className="flex items-end gap-1 h-16">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="w-1.5 bg-primary rounded-full animate-pulse" style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 0.05}s`, animationDuration: `${0.3 + Math.random() * 0.5}s` }} />
              ))}
            </div>
          ) : takes.length > 0 ? (
            <div className="flex items-end gap-0.5 h-16 w-full">
              {Array.from({ length: 60 }).map((_, i) => (
                <div key={i} className="flex-1 bg-primary/40 rounded-sm" style={{ height: `${20 + Math.random() * 80}%` }} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Waveform will appear here</p>
          )}
          <div className="absolute bottom-2 right-3 text-xs font-mono text-muted-foreground bg-background/80 px-2 py-0.5 rounded">
            {fmt(recordTime)}
          </div>
        </div>

        <div className="flex items-center justify-center gap-6">
          {!isRecording ? (
            <>
              {activeTake && (
                <button onClick={() => playTake(activeTake)} className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center active:scale-90 transition-all">
                  {isPlaying ? <Pause className="w-5 h-5 text-foreground" /> : <Play className="w-5 h-5 text-foreground" />}
                </button>
              )}
              <button onClick={startRecording} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 active:scale-90 transition-all">
                <Mic className="w-7 h-7 text-white" />
              </button>
              <button onClick={() => setRecordTime(0)} className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center active:scale-90 transition-all">
                <Square className="w-5 h-5 text-foreground" />
              </button>
            </>
          ) : (
            <button onClick={stopRecording} className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 animate-pulse active:scale-90 transition-all">
              <Square className="w-8 h-8 text-white" />
            </button>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Music className="w-3 h-3" /> Beat Volume</span>
              <span className="text-xs text-muted-foreground">{beatVolume}%</span>
            </div>
            <Slider value={[beatVolume]} onValueChange={([v]) => { setBeatVolume(v); if (beatAudioRef.current) beatAudioRef.current.volume = v / 100; }} max={100} step={1} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Mic className="w-3 h-3" /> Vocal Volume</span>
              <span className="text-xs text-muted-foreground">{vocalVolume}%</span>
            </div>
            <Slider value={[vocalVolume]} onValueChange={([v]) => setVocalVolume(v)} max={100} step={1} />
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-11 rounded-xl text-xs font-bold gap-1" onClick={() => setScreen("takes")}>
            <Layers className="w-4 h-4" /> Takes ({takes.length})
          </Button>
          <Button variant="outline" className="flex-1 h-11 rounded-xl text-xs font-bold gap-1" onClick={() => setScreen("effects")}>
            <Sliders className="w-4 h-4" /> Effects
          </Button>
          <Button variant="outline" className="flex-1 h-11 rounded-xl text-xs font-bold gap-1" onClick={() => { setExportTitle(activeSession?.name || ""); setScreen("export"); }}>
            <Download className="w-4 h-4" /> Export
          </Button>
        </div>

        {takes.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Takes</h3>
            {takes.map(take => (
              <button key={take.id} onClick={() => setActiveTakeId(take.id)} className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${activeTakeId === take.id ? "bg-primary/10 border-primary/30" : "bg-card border-border"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeTakeId === take.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <Mic className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{take.name}</p>
                  <p className="text-xs text-muted-foreground">{fmt(take.duration)}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); playTake(take); }} className="p-2">
                  <Play className="w-4 h-4 text-primary" />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>
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
              <p className="text-xs text-muted-foreground">{fmt(activeTake.duration)} · {activeSession?.beatName || "No beat"}</p>
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
