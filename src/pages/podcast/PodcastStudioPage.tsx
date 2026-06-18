import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Mic, Video as VideoIcon, VideoOff, Share2, Smile, FileText, LayoutGrid, LogOut,
  Users, MessageCircle, Sparkles, Type, Music, Settings as SettingsIcon, HelpCircle,
  Home, ChevronUp, ChevronDown, Circle, Square, Link as LinkIcon, Upload, X,
  Scissors, MousePointer2, ZoomIn, ZoomOut, Download, Pencil, Eraser, Save,
  Play, Pause, SkipBack, SkipForward,
} from "lucide-react";
import { DawEngine } from "@/wstudio/daw/engine/DawEngine";
import { computePeaks } from "@/wstudio/daw/engine/Peaks";
import { useDawStore, newId } from "@/wstudio/daw/state/DawStore";
import { ArrangeView } from "@/wstudio/daw/ui/ArrangeView";
import { PodcastExportSheet } from "./PodcastExportSheet";
import { usePodcastVideoStore } from "./podcastVideoStore";
import type { Clip, Track } from "@/wstudio/daw/engine/types";
import { saveProjectTo, openProject } from "@/wstudio/daw/lib/projectIO";

const isInputAudioTrack = (track: Track, allClips: Clip[]) => (
  track.kind === "instrument" || (
    track.kind === "audio"
    && track.inputEnabled !== false
    && !(track.inputEnabled === undefined && allClips.some(c => c.trackId === track.id && c.buffer && c.name !== "Recording"))
  )
);

type RightPanel = null | "people" | "chat" | "effects" | "text" | "media" | "settings" | "help";

const LAYOUTS = [
  { id: "speaker", label: "Speaker", svg: <rect x="2" y="3" width="20" height="14" rx="2" /> },
  { id: "grid2", label: "Split", svg: <><rect x="2" y="3" width="9" height="14" rx="1" /><rect x="13" y="3" width="9" height="14" rx="1" /></> },
  { id: "grid3", label: "Trio", svg: <><rect x="2" y="3" width="6" height="14" rx="1" /><rect x="9" y="3" width="6" height="14" rx="1" /><rect x="16" y="3" width="6" height="14" rx="1" /></> },
  { id: "grid4", label: "Grid", svg: <><rect x="2" y="3" width="9" height="6.5" rx="1" /><rect x="13" y="3" width="9" height="6.5" rx="1" /><rect x="2" y="10.5" width="9" height="6.5" rx="1" /><rect x="13" y="10.5" width="9" height="6.5" rx="1" /></> },
  { id: "pip", label: "PiP", svg: <><rect x="2" y="3" width="20" height="14" rx="2" /><circle cx="18" cy="14" r="3" fill="currentColor" /></> },
  { id: "side", label: "Sidebar", svg: <><rect x="2" y="3" width="14" height="14" rx="1" /><rect x="17" y="3" width="5" height="14" rx="1" /></> },
  { id: "stage", label: "Stage", svg: <><rect x="2" y="3" width="20" height="10" rx="1" /><rect x="2" y="14" width="6" height="3" rx="0.5" /><rect x="9" y="14" width="6" height="3" rx="0.5" /><rect x="16" y="14" width="6" height="3" rx="0.5" /></> },
];

export default function PodcastStudioPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionCode = params.get("session");

  const engineRef = useRef<DawEngine | null>(null);
  const [engineReady, setEngineReady] = useState(false);

  const tracks = useDawStore(s => s.tracks);
  const clips = useDawStore(s => s.clips);
  const setTransport = useDawStore(s => s.setTransport);
  const addClip = useDawStore(s => s.addClip);
  const addTrack = useDawStore(s => s.addTrack);
  const updateTrack = useDawStore(s => s.updateTrack);
  const selectTrack = useDawStore(s => s.selectTrack);
  const view = useDawStore(s => s.view);
  const projectName = useDawStore(s => s.projectName);
  const setProjectName = useDawStore(s => s.setProjectName);
  const projectFileHandle = useDawStore(s => s.projectFileHandle);
  const setProjectFileHandle = useDawStore(s => s.setProjectFileHandle);
  const loadProject = useDawStore(s => s.loadProject);
  const tool = useDawStore(s => s.tool);
  const setTool = useDawStore(s => s.setTool);
  const pxPerSec = useDawStore(s => s.pxPerSec);
  const setPxPerSec = useDawStore(s => s.setPxPerSec);

  // UI state
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);
  const [layoutId, setLayoutId] = useState("speaker");
  const [tracksOpen, setTracksOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Camera state (inline; replaces sidebar)
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTrackIdRef = useRef<string | null>(null);
  const recStartRef = useRef<number>(0);
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [videoRec, setVideoRec] = useState(false);
  const [mirrored, setMirrored] = useState(true);
  const [resolution, setResolution] = useState<"720p" | "1080p" | "480p">("720p");
  const [frameRate, setFrameRate] = useState<24 | 30 | 60>(30);
  const setPending = usePodcastVideoStore(s => s.setPending);
  const setVideo = usePodcastVideoStore(s => s.setVideo);

  // Init engine
  useEffect(() => {
    const e = new DawEngine();
    engineRef.current = e;
    e.onPositionChange = (pos) => setTransport({ position: pos });
    e.onRecordedClip = async (trackId, clip) => {
      clip.peaks = computePeaks(clip.buffer!);
      addClip(clip);
      usePodcastVideoStore.getState().attachPending(trackId, clip.id);
      setTransport({ isRecording: false, isPlaying: false });
    };
    setEngineReady(true);
    return () => { e.dispose(); engineRef.current = null; };
  }, [addClip, setTransport]);

  useEffect(() => {
    const e = engineRef.current; if (!e) return;
    tracks.forEach(t => e.ensureTrackChain(t));
    e.syncInputMonitoring(tracks);
  }, [tracks]);

  // Camera lifecycle
  const startCamera = useCallback(async () => {
    try {
      const dims = resolution === "1080p" ? { width: 1920, height: 1080 } : resolution === "480p" ? { width: 854, height: 480 } : { width: 1280, height: 720 };
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { ...dims, frameRate: { ideal: frameRate }, facingMode: "user" },
        audio: false,
      });
      camStreamRef.current = stream;
      if (previewRef.current) { previewRef.current.srcObject = stream; await previewRef.current.play().catch(() => {}); }
      setCamOn(true);
    } catch (err: any) {
      toast.error(err?.message || "Camera access denied");
    }
  }, [resolution, frameRate]);

  const stopCamera = useCallback(() => {
    try { recorderRef.current?.stop(); } catch {}
    recorderRef.current = null;
    setVideoRec(false);
    const s = camStreamRef.current;
    if (s) { s.getTracks().forEach(t => t.stop()); camStreamRef.current = null; }
    if (previewRef.current) previewRef.current.srcObject = null;
    setCamOn(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const ensureRecordTrack = useCallback(() => {
    const audioTrack = tracks.find(t => t.kind === "audio");
    if (audioTrack) { selectTrack(audioTrack.id); return audioTrack.id; }
    const id = addTrack("audio", "Host");
    selectTrack(id);
    return id;
  }, [tracks, addTrack, selectTrack]);

  const handleRecord = useCallback(async () => {
    const e = engineRef.current; if (!e) return;
    if (useDawStore.getState().transport.isRecording) {
      // STOP everything
      const rec = recorderRef.current; recorderRef.current = null;
      if (rec && rec.state !== "inactive") {
        await new Promise<void>((res) => {
          const prev = rec.onstop; rec.onstop = (ev) => { try { prev?.call(rec, ev); } finally { res(); } };
          try { rec.stop(); } catch { res(); }
        });
      }
      setVideoRec(false);
      e.stopRecording(); e.stop();
      setTransport({ isRecording: false, isPlaying: false });
      return;
    }
    if (!camStreamRef.current) { await startCamera(); }
    const trackId = ensureRecordTrack();
    useDawStore.getState().tracks.forEach(t => updateTrack(t.id, { armed: t.id === trackId }));
    try {
      await e.resume();
      const startPos = useDawStore.getState().transport.position;
      await e.startRecording(trackId, startPos);
      setTransport({ isRecording: true, isPlaying: true });
      const st = useDawStore.getState();
      e.play({ ...st.transport, isRecording: true, isPlaying: true, position: startPos }, st.tracks, st.clips);

      const cam = camStreamRef.current;
      if (cam) {
        const videoOnly = new MediaStream(cam.getVideoTracks());
        const mime = ["video/webm;codecs=vp8", "video/webm;codecs=vp9", "video/webm"].find(m => MediaRecorder.isTypeSupported(m)) || "video/webm";
        const mr = new MediaRecorder(videoOnly, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
        recChunksRef.current = [];
        recTrackIdRef.current = trackId;
        recStartRef.current = startPos;
        mr.ondataavailable = (ev) => { if (ev.data?.size) recChunksRef.current.push(ev.data); };
        mr.onstop = () => {
          const blob = new Blob(recChunksRef.current, { type: mime });
          recChunksRef.current = [];
          const dur = useDawStore.getState().transport.position - recStartRef.current;
          setPending(recTrackIdRef.current!, {
            trackId: recTrackIdRef.current!, startTime: recStartRef.current,
            blob, mime, durationSec: Math.max(0.1, dur), participantLabel: "Host",
          });
        };
        mr.start(250);
        recorderRef.current = mr;
        setVideoRec(true);
      }
    } catch (err: any) {
      toast.error(err?.message || "Could not start recording");
      setTransport({ isRecording: false, isPlaying: false });
    }
  }, [ensureRecordTrack, setPending, setTransport, startCamera, updateTrack]);

  const importFiles = useCallback(async (files: FileList) => {
    const e = engineRef.current; if (!e) return;
    for (const file of Array.from(files)) {
      try {
        const buffer = await e.decodeFile(file);
        const trackId = addTrack("audio", file.name.replace(/\.[^.]+$/, ""), { inputEnabled: false });
        await new Promise(r => setTimeout(r, 30));
        const peaks = computePeaks(buffer);
        const clipId = newId("clip");
        addClip({ id: clipId, trackId, startTime: useDawStore.getState().transport.position, duration: buffer.duration, offset: 0, buffer, peaks, name: file.name });
        if (file.type.startsWith("video/")) {
          setVideo(clipId, { blob: file, mime: file.type, durationSec: buffer.duration, participantLabel: file.name });
        }
      } catch { toast.error(`Couldn't import ${file.name}`); }
    }
  }, [addTrack, addClip, setVideo]);

  const inviteGuest = useCallback(() => {
    const code = sessionCode || Math.random().toString(36).slice(2, 8).toUpperCase();
    const url = `${window.location.origin}/#/tv/podcast/join/${code}`;
    navigator.clipboard.writeText(url).catch(() => {});
    toast.success("Magic link copied", { description: url });
  }, [sessionCode]);

  const handleSave = useCallback(async () => {
    try {
      toast.loading("Saving…", { id: "save" });
      const handle = await saveProjectTo(projectFileHandle, {
        name: projectName, tracks, clips,
        transport: useDawStore.getState().transport,
        pxPerSec, verticalZoom: useDawStore.getState().verticalZoom,
      });
      if (handle) setProjectFileHandle(handle);
      toast.success("Project saved to your device", { id: "save" });
    } catch { toast.error("Couldn't save", { id: "save" }); }
  }, [projectFileHandle, projectName, tracks, clips, pxPerSec, setProjectFileHandle]);

  const handleOpen = useCallback(async () => {
    const e = engineRef.current; if (!e) return;
    try {
      const r = await openProject(e);
      if (!r) return;
      loadProject(r.parsed); setProjectFileHandle(r.handle);
      toast.success(`Opened "${r.parsed.name}"`);
    } catch { toast.error("Couldn't open project"); }
  }, [loadProject, setProjectFileHandle]);

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Drag-drop
  useEffect(() => {
    const drop = (e: DragEvent) => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); importFiles(e.dataTransfer.files); };
    const over = (e: DragEvent) => e.preventDefault();
    window.addEventListener("drop", drop); window.addEventListener("dragover", over);
    return () => { window.removeEventListener("drop", drop); window.removeEventListener("dragover", over); };
  }, [importFiles]);

  if (!engineReady || !engineRef.current) {
    return <div className="min-h-screen bg-black grid place-items-center text-neutral-400">Loading studio…</div>;
  }

  const isRecording = useDawStore.getState().transport.isRecording;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-neutral-950 text-neutral-100 overflow-hidden">
      {/* Top minimal header */}
      <header className="h-12 shrink-0 flex items-center justify-between px-3 border-b border-neutral-900">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => navigate("/tv/podcast")} className="p-1.5 rounded hover:bg-neutral-900" title="Lobby">
            <Home className="w-4 h-4 text-neutral-300" />
          </button>
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            spellCheck={false}
            className="bg-transparent text-sm text-neutral-200 outline-none border border-transparent hover:border-neutral-800 focus:border-cyan-500/60 rounded px-2 py-0.5 min-w-0 truncate"
            title="Recording name"
          />
        </div>
        <button
          onClick={() => toast.message("Live stream — coming soon")}
          className="h-8 px-3 rounded-full bg-neutral-900 hover:bg-neutral-800 text-xs font-medium text-neutral-200 flex items-center gap-1.5"
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" /> Live stream
        </button>
      </header>

      {/* Main: stage + right rail */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Stage (center) */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          <div className="flex-1 relative grid place-items-center p-4 min-h-0">
            <div className={`relative w-full max-w-3xl bg-black rounded-2xl overflow-hidden border border-violet-500/40 shadow-[0_0_0_2px_rgba(139,92,246,0.15)] aspect-video`}>
              <StageLayout
                layoutId={layoutId}
                hostVideoRef={previewRef}
                hostName="jay"
                camOn={camOn}
                mirrored={mirrored}
                onStartCamera={startCamera}
              />
              {videoRec && (
                <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center gap-1 z-30">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> REC
                </div>
              )}
            </div>
          </div>

          {/* Layout strip */}
          <div className="shrink-0 px-4 py-3 flex items-center justify-center gap-2 overflow-x-auto">
            {LAYOUTS.map(l => (
              <button
                key={l.id}
                onClick={() => setLayoutId(l.id)}
                title={l.label}
                className={`shrink-0 w-14 h-9 rounded-md grid place-items-center border transition ${
                  layoutId === l.id
                    ? "bg-violet-600/20 border-violet-500 text-violet-200"
                    : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-neutral-200"
                }`}
              >
                <svg viewBox="0 0 24 20" className="w-7 h-5" fill="none" stroke="currentColor" strokeWidth="1.2">
                  {l.svg}
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Right rail icons */}
        <nav className="shrink-0 w-16 border-l border-neutral-900 flex flex-col items-center py-3 gap-1">
          {[
            { id: "people" as const, icon: Users, label: "People" },
            { id: "chat" as const, icon: MessageCircle, label: "Chat" },
            { id: "effects" as const, icon: Sparkles, label: "Effects" },
            { id: "text" as const, icon: Type, label: "Text" },
            { id: "media" as const, icon: Music, label: "Media" },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setRightPanel(p => p === id ? null : id)}
              className={`w-12 h-14 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[10px] ${
                rightPanel === id ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900"
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
          <div className="flex-1" />

          {/* Tool / zoom / export rail (moved from top) */}
          <div className="flex flex-col items-center gap-1 mb-1">
            <button onClick={() => setTool("pointer")} className={`w-10 h-10 rounded grid place-items-center ${tool === "pointer" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-100"}`} title="Select"><MousePointer2 className="w-4 h-4" /></button>
            <button onClick={() => setTool("scissors")} className={`w-10 h-10 rounded grid place-items-center ${tool === "scissors" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-100"}`} title="Split"><Scissors className="w-4 h-4" /></button>
            <button onClick={() => setTool("pencil")} className={`w-10 h-10 rounded grid place-items-center ${tool === "pencil" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-100"}`} title="Pencil"><Pencil className="w-4 h-4" /></button>
            <button onClick={() => setTool("eraser")} className={`w-10 h-10 rounded grid place-items-center ${tool === "eraser" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-100"}`} title="Erase"><Eraser className="w-4 h-4" /></button>
            <button onClick={() => setPxPerSec(Math.min(800, pxPerSec * 1.25))} className="w-10 h-10 rounded grid place-items-center text-neutral-400 hover:text-neutral-100" title="Zoom in"><ZoomIn className="w-4 h-4" /></button>
            <button onClick={() => setPxPerSec(Math.max(20, pxPerSec / 1.25))} className="w-10 h-10 rounded grid place-items-center text-neutral-400 hover:text-neutral-100" title="Zoom out"><ZoomOut className="w-4 h-4" /></button>
            <button onClick={handleSave} className="w-10 h-10 rounded grid place-items-center text-neutral-400 hover:text-neutral-100" title="Save to device"><Save className="w-4 h-4" /></button>
            <button onClick={() => clips.length ? setExportOpen(true) : toast.error("Nothing to export")} className="w-10 h-10 rounded grid place-items-center text-neutral-400 hover:text-neutral-100" title="Export"><Download className="w-4 h-4" /></button>
          </div>

          <button
            onClick={() => setRightPanel(p => p === "settings" ? null : "settings")}
            className={`w-12 h-14 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[10px] ${
              rightPanel === "settings" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900"
            }`}
          >
            <SettingsIcon className="w-5 h-5" />
            Settings
          </button>
          <button
            onClick={() => setRightPanel(p => p === "help" ? null : "help")}
            className={`w-12 h-14 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[10px] ${
              rightPanel === "help" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900"
            }`}
          >
            <HelpCircle className="w-5 h-5" />
            Help
          </button>
        </nav>

        {/* Side panel */}
        {rightPanel && (
          <aside className="absolute top-0 right-16 h-full w-[320px] bg-neutral-950 border-l border-neutral-900 z-30 flex flex-col">
            <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-neutral-900">
              <div className="text-sm font-medium capitalize">{rightPanel === "effects" ? "Visual effects" : rightPanel}</div>
              <button onClick={() => setRightPanel(null)} className="p-1 text-neutral-500 hover:text-neutral-100"><X className="w-4 h-4" /></button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 text-sm">
              {rightPanel === "people" && <PeoplePanel onInvite={inviteGuest} />}
              {rightPanel === "chat" && <div className="text-neutral-500 text-xs">Chat coming soon.</div>}
              {rightPanel === "effects" && <EffectsPanel mirrored={mirrored} setMirrored={setMirrored} />}
              {rightPanel === "text" && <div className="text-neutral-500 text-xs">Lower-thirds & captions.</div>}
              {rightPanel === "media" && <MediaPanel onImport={() => importInputRef.current?.click()} />}
              {rightPanel === "settings" && (
                <SettingsPanel
                  resolution={resolution} setResolution={setResolution}
                  frameRate={frameRate} setFrameRate={setFrameRate}
                  micOn={micOn} setMicOn={setMicOn}
                  mirrored={mirrored} setMirrored={setMirrored}
                  onOpenProject={handleOpen}
                />
              )}
              {rightPanel === "help" && <div className="text-neutral-500 text-xs">Drop video/audio onto the stage to import. Tap Record to start. Tap Tracks to inspect waveforms.</div>}
            </div>
          </aside>
        )}

        {/* Tracks drawer (slides up from above bottom bar) */}
        <div
          className={`absolute left-0 right-16 bottom-0 bg-neutral-950 border-t border-neutral-900 transition-transform duration-300 z-20 ${tracksOpen ? "translate-y-0" : "translate-y-full"}`}
          style={{ height: "55%" }}
        >
          <div className="h-10 flex items-center gap-2 px-3 border-b border-neutral-900">
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 mr-2">Tracks · {tracks.length}</div>
            <TransportControls engineRef={engineRef} />
            <div className="flex-1" />
            <button onClick={() => setTracksOpen(false)} className="p-1 text-neutral-500 hover:text-neutral-200"><ChevronDown className="w-4 h-4" /></button>
          </div>
          <div className="h-[calc(100%-2.5rem)]">
            {view === "arrange" && (
              <ArrangeView
                onArmToggle={(id) => { const t = tracks.find(x => x.id === id); if (t) updateTrack(id, { armed: !t.armed }); }}
                onSeek={(p) => setTransport({ position: Math.max(0, p) })}
                engine={engineRef.current}
                onOpenInstrumentEditor={() => {}}
                onImportFilesAt={async () => {}}
              />
            )}
          </div>
        </div>

        {/* Toggle to peek tracks */}
        {!tracksOpen && (
          <button
            onClick={() => setTracksOpen(true)}
            className="absolute left-3 bottom-3 z-10 h-8 px-3 rounded-full bg-neutral-900/90 border border-neutral-800 text-[11px] text-neutral-300 hover:text-white flex items-center gap-1.5"
          >
            <ChevronUp className="w-3.5 h-3.5" /> Tracks
          </button>
        )}
      </div>

      {/* Bottom bar — Riverside-style */}
      <footer className="shrink-0 h-20 border-t border-neutral-900 flex items-center justify-center gap-2 px-3 bg-neutral-950">
        <BottomAction
          big
          active={isRecording}
          onClick={handleRecord}
          icon={isRecording ? <Square className="w-5 h-5 fill-white" /> : <Circle className="w-5 h-5 fill-white text-white" />}
          label={isRecording ? "Stop" : "Record"}
        />
        <BottomAction onClick={() => setMicOn(m => !m)} icon={<Mic className={`w-5 h-5 ${micOn ? "" : "opacity-40"}`} />} label="Audio" />
        <BottomAction onClick={() => camOn ? stopCamera() : startCamera()} icon={camOn ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />} label="Video" />
        <BottomAction onClick={inviteGuest} icon={<Share2 className="w-5 h-5" />} label="Share" />
        <BottomAction onClick={() => toast.message("Reactions coming soon")} icon={<Smile className="w-5 h-5" />} label="React" />
        <BottomAction onClick={() => toast.message("Script coming soon")} icon={<FileText className="w-5 h-5" />} label="Script" />
        <BottomAction onClick={() => setRightPanel("people")} icon={<LayoutGrid className="w-5 h-5" />} label="Layout" />
        <BottomAction onClick={() => navigate("/tv/podcast")} icon={<LogOut className="w-5 h-5 text-red-400" />} label="Leave" />
      </footer>

      <input
        ref={importInputRef} type="file" multiple
        accept=".wav,.mp3,.ogg,.m4a,.mp4,.webm,.mov,.m4v,audio/*,video/*"
        className="hidden"
        onChange={(e) => e.target.files && importFiles(e.target.files)}
      />

      <PodcastExportSheet
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        engine={engineRef.current}
        tracks={tracks}
        clips={clips}
        projectName={projectName}
      />
    </div>
  );
}

function BottomAction({ icon, label, onClick, active, big }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; big?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg group ${big ? "" : "hover:bg-neutral-900"}`}
    >
      <span className={`grid place-items-center rounded-full ${big ? `w-14 h-14 ${active ? "bg-red-700" : "bg-red-600"} text-white shadow-lg shadow-red-900/40` : "w-11 h-11 bg-neutral-900 text-neutral-200 group-hover:bg-neutral-800"}`}>
        {icon}
      </span>
      <span className="text-[10px] text-neutral-400">{label}</span>
    </button>
  );
}

function PeoplePanel({ onInvite }: { onInvite: () => void }) {
  return (
    <div className="space-y-3">
      <button onClick={onInvite} className="w-full h-10 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium flex items-center justify-center gap-2">
        <LinkIcon className="w-4 h-4" /> Invite via magic link
      </button>
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">In the studio · 1</div>
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-neutral-700 grid place-items-center text-xs font-semibold">J</div>
        <div className="min-w-0">
          <div className="text-sm text-neutral-100 truncate">jay (You)</div>
          <div className="text-[11px] text-neutral-500">Host</div>
        </div>
      </div>
    </div>
  );
}

function EffectsPanel({ mirrored, setMirrored }: { mirrored: boolean; setMirrored: (b: boolean) => void }) {
  return (
    <div className="space-y-4">
      <Row label="Mirror my video">
        <Toggle on={mirrored} onChange={setMirrored} />
      </Row>
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">Backgrounds</div>
      <div className="grid grid-cols-3 gap-2">
        {[null, "blur", "studio", "warm", "cool", "books"].map((bg, i) => (
          <div key={i} className="aspect-video rounded-md border border-neutral-800 bg-neutral-900 grid place-items-center text-[10px] text-neutral-500">
            {bg ?? "None"}
          </div>
        ))}
      </div>
    </div>
  );
}

function MediaPanel({ onImport }: { onImport: () => void }) {
  return (
    <div className="space-y-2">
      <button onClick={onImport} className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-xs flex items-center justify-center gap-2">
        <Upload className="w-4 h-4" /> Import file
      </button>
      <p className="text-[11px] text-neutral-500">Drop audio or video anywhere on the stage. Files become tracks you can edit.</p>
    </div>
  );
}

function SettingsPanel({
  resolution, setResolution, frameRate, setFrameRate, micOn, setMicOn, mirrored, setMirrored, onOpenProject,
}: {
  resolution: "480p" | "720p" | "1080p"; setResolution: (v: any) => void;
  frameRate: 24 | 30 | 60; setFrameRate: (v: any) => void;
  micOn: boolean; setMicOn: (b: boolean) => void;
  mirrored: boolean; setMirrored: (b: boolean) => void;
  onOpenProject: () => void;
}) {
  return (
    <div className="space-y-4">
      <Row label="Recording resolution">
        <select value={resolution} onChange={(e) => setResolution(e.target.value as any)} className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs">
          <option value="480p">480p</option><option value="720p">720p</option><option value="1080p">1080p</option>
        </select>
      </Row>
      <Row label="Frame rate">
        <select value={frameRate} onChange={(e) => setFrameRate(Number(e.target.value) as any)} className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs">
          <option value={24}>24 FPS</option><option value={30}>30 FPS</option><option value={60}>60 FPS</option>
        </select>
      </Row>
      <Row label="Microphone"><Toggle on={micOn} onChange={setMicOn} /></Row>
      <Row label="Mirror my video"><Toggle on={mirrored} onChange={setMirrored} /></Row>
      <div className="pt-3 border-t border-neutral-900 space-y-2">
        <button onClick={onOpenProject} className="w-full h-9 rounded bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-xs">Open project from device</button>
        <p className="text-[10px] text-neutral-500">Projects save to your device — not the cloud.</p>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-neutral-300">{label}</span>
      {children}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (b: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={`w-9 h-5 rounded-full transition relative ${on ? "bg-cyan-500" : "bg-neutral-700"}`}>
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}
