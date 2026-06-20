import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Mic, Video as VideoIcon, VideoOff, FolderOpen, LogOut,
  Users, MessageCircle, Sparkles, Captions as CaptionsIcon, Music, Settings as SettingsIcon, HelpCircle,
  Home, ChevronUp, ChevronDown, Circle, Square, Link as LinkIcon, Upload, X,
  Scissors, MousePointer2, ZoomIn, ZoomOut, Download, Pencil, Eraser,
  Play, Pause, SkipBack, SkipForward, Maximize2, Minimize2, ArrowLeftToLine,
  MessageSquare, Smartphone, QrCode, Share2, Send, Image as ImageIcon, Paperclip,
  Maximize, MonitorUp, MonitorOff, ArrowUp, Rss, Tv, User as UserIcon, ChevronDown as ChevronDownIcon,
  Trash2,
} from "lucide-react";
import JhiIcon from "@/components/JhiIcon";
import { supabase } from "@/integrations/supabase/client";
import { usePodcastSession } from "./podcastSessionStore";
import { DawEngine } from "@/wstudio/daw/engine/DawEngine";
import { computePeaks } from "@/wstudio/daw/engine/Peaks";
import { useDawStore, newId } from "@/wstudio/daw/state/DawStore";
import { ArrangeView } from "@/wstudio/daw/ui/ArrangeView";
import { PodcastExportSheet } from "./PodcastExportSheet";
import { usePodcastVideoStore } from "./podcastVideoStore";
import { SegmentedStage } from "./SegmentedStage";
import type { Clip, Track } from "@/wstudio/daw/engine/types";
import studio1 from "@/assets/studio-1.jpg";
import studio2 from "@/assets/studio-2.jpg";
import studio3 from "@/assets/studio-3.jpg";
import studio4 from "@/assets/studio-4.jpg";
import podcast1 from "@/assets/podcast-1.jpg";
import podcast2 from "@/assets/podcast-2.jpg";
import cardPodcasts from "@/assets/card-podcasts.jpg";
import cardRecordingStudio from "@/assets/card-recording-studio.jpg";
import battleStageLights from "@/assets/battle-bg-stage-lights.jpg";
import battleNeonCity from "@/assets/battle-bg-neon-city.jpg";
import wstudioMic from "@/assets/wstudio-orbit-mic.jpg";
import wstudioMixer from "@/assets/wstudio-orbit-mixer.jpg";

type CaptionStyle = "subtitle" | "bold" | "neon" | "bubble" | "minimal" | "karaoke";
const CAPTION_STYLES: { id: CaptionStyle; label: string; className: string }[] = [
  { id: "subtitle", label: "Subtitle", className: "px-3 py-1.5 rounded-md bg-black/75 text-white text-base font-medium" },
  { id: "bold",     label: "Bold",     className: "px-4 py-2 rounded-lg bg-white text-black text-lg font-extrabold tracking-tight uppercase" },
  { id: "neon",     label: "Neon",     className: "px-3 py-1.5 rounded-md bg-black/60 text-cyan-300 text-lg font-bold tracking-wide [text-shadow:_0_0_8px_rgb(34_211_238_/_90%),_0_0_18px_rgb(34_211_238_/_60%)]" },
  { id: "bubble",   label: "Bubble",   className: "px-4 py-2 rounded-full bg-violet-600 text-white text-base font-semibold shadow-lg shadow-violet-900/40" },
  { id: "minimal",  label: "Minimal",  className: "px-2 py-1 text-white text-base font-medium [text-shadow:_0_1px_3px_rgba(0,0,0,0.9)]" },
  { id: "karaoke",  label: "Karaoke",  className: "px-3 py-1.5 rounded-md bg-gradient-to-r from-yellow-300 via-pink-400 to-fuchsia-500 bg-clip-text text-transparent text-xl font-extrabold" },
];

const isInputAudioTrack = (track: Track, allClips: Clip[]) => (
  track.kind === "instrument" || (
    track.kind === "audio"
    && track.inputEnabled !== false
    && !(track.inputEnabled === undefined && allClips.some(c => c.trackId === track.id && c.buffer && c.name !== "Recording"))
  )
);

type RightPanel = null | "people" | "chat" | "effects" | "captions" | "media" | "settings" | "help" | "projects" | "jhi";

type ChatMessage = { id: string; author: string; text?: string; mediaUrl?: string; mediaType?: "image" | "video"; ts: number };

const BG_LIBRARY: { id: string; label: string; url: string }[] = [
  { id: "studio-1", label: "Studio A", url: studio1 },
  { id: "studio-2", label: "Studio B", url: studio2 },
  { id: "studio-3", label: "Studio C", url: studio3 },
  { id: "studio-4", label: "Studio D", url: studio4 },
  { id: "podcast-1", label: "Podcast Set", url: podcast1 },
  { id: "podcast-2", label: "Interview Room", url: podcast2 },
  { id: "creator", label: "Creator Desk", url: cardPodcasts },
  { id: "recording", label: "Recording Room", url: cardRecordingStudio },
  { id: "stage-lights", label: "Stage Lights", url: battleStageLights },
  { id: "neon-city", label: "Neon City", url: battleNeonCity },
  { id: "mic", label: "Mic Booth", url: wstudioMic },
  { id: "mixer", label: "Mixer Room", url: wstudioMixer },
];

const LAYOUTS = [
  { id: "speaker", label: "Speaker", svg: <rect x="2" y="3" width="20" height="14" rx="2" /> },
  { id: "grid2", label: "Split", svg: <><rect x="2" y="3" width="9" height="14" rx="1" /><rect x="13" y="3" width="9" height="14" rx="1" /></> },
  { id: "grid3", label: "Trio", svg: <><rect x="2" y="3" width="6" height="14" rx="1" /><rect x="9" y="3" width="6" height="14" rx="1" /><rect x="16" y="3" width="6" height="14" rx="1" /></> },
  { id: "grid4", label: "Grid", svg: <><rect x="2" y="3" width="9" height="6.5" rx="1" /><rect x="13" y="3" width="9" height="6.5" rx="1" /><rect x="2" y="10.5" width="9" height="6.5" rx="1" /><rect x="13" y="10.5" width="9" height="6.5" rx="1" /></> },
  { id: "pip", label: "PiP", svg: <><rect x="2" y="3" width="20" height="14" rx="2" /><circle cx="18" cy="14" r="3" fill="currentColor" /></> },
  { id: "side", label: "Sidebar", svg: <><rect x="2" y="3" width="14" height="14" rx="1" /><rect x="17" y="3" width="5" height="14" rx="1" /></> },
  { id: "stage", label: "Stage", svg: <><rect x="2" y="3" width="20" height="10" rx="1" /><rect x="2" y="14" width="6" height="3" rx="0.5" /><rect x="9" y="14" width="6" height="3" rx="0.5" /><rect x="16" y="14" width="6" height="3" rx="0.5" /></> },
];

export default function PodcastStudioPage({ activeSessionCode }: { activeSessionCode?: string | null } = {}) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const urlSessionCode = params.get("session");
  const storedSessionCode = usePodcastSession((s) => s.sessionCode);
  const setStoredSessionCode = usePodcastSession((s) => s.setSessionCode);
  const generatedSessionCodeRef = useRef(Math.random().toString(36).slice(2, 8).toUpperCase());
  const sessionCode = (activeSessionCode || urlSessionCode || storedSessionCode || generatedSessionCodeRef.current).trim().toUpperCase();
  const minimizeSession = usePodcastSession((s) => s.minimize);
  const closeSession = usePodcastSession((s) => s.close);
  const isMinimized = usePodcastSession((s) => s.minimized);

  const engineRef = useRef<DawEngine | null>(null);
  const [engineReady, setEngineReady] = useState(false);

  const tracks = useDawStore(s => s.tracks);
  const clips = useDawStore(s => s.clips);
  const setTransport = useDawStore(s => s.setTransport);
  const addClip = useDawStore(s => s.addClip);
  const removeClip = useDawStore(s => s.removeClip);
  const addTrack = useDawStore(s => s.addTrack);
  const updateTrack = useDawStore(s => s.updateTrack);
  const updateClip = useDawStore(s => s.updateClip);
  const selectTrack = useDawStore(s => s.selectTrack);
  const view = useDawStore(s => s.view);
  const isRecording = useDawStore(s => s.transport.isRecording);
  const projectName = useDawStore(s => s.projectName);
  const setProjectName = useDawStore(s => s.setProjectName);
  const tool = useDawStore(s => s.tool);
  const setTool = useDawStore(s => s.setTool);
  const pxPerSec = useDawStore(s => s.pxPerSec);
  const setPxPerSec = useDawStore(s => s.setPxPerSec);

  // UI state
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);
  const [layoutId, setLayoutId] = useState("speaker");
  const [tracksOpen, setTracksOpen] = useState(false);
  const [tracksFull, setTracksFull] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [customBgs, setCustomBgs] = useState<string[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);
  const bgUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setStoredSessionCode(sessionCode); }, [sessionCode, setStoredSessionCode]);

  // Camera state (inline; replaces sidebar)
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTrackIdRef = useRef<string | null>(null);
  const recStartRef = useRef<number>(0);
  const recStopRef = useRef<number | null>(null);
  const lastRecordedClipByTrackRef = useRef<Record<string, { clipId: string; startTime: number; at: number }>>({});
  const videoCompositeRafRef = useRef<number | null>(null);
  const [camOn, setCamOn] = useState(false);
  const [camStream, setCamStream] = useState<MediaStream | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [videoRec, setVideoRec] = useState(false);
  const [mirrored, setMirrored] = useState(true);
  const [resolution, setResolution] = useState<"720p" | "1080p" | "480p">("720p");
  const [frameRate, setFrameRate] = useState<24 | 30 | 60>(30);

  // Captions, chat, screen share, fullscreen
  const [captionsOn, setCaptionsOn] = useState(false);
  const [captionText, setCaptionText] = useState("");
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>("subtitle");
  const recognitionRef = useRef<any>(null);
  const captionHideTimerRef = useRef<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const chatSubscribedRef = useRef(false);
  const chatClientIdRef = useRef(Math.random().toString(36).slice(2));
  const [participants, setParticipants] = useState<string[]>(["You"]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [screenSharing, setScreenSharing] = useState(false);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const setPending = usePodcastVideoStore(s => s.setPending);
  const setVideo = usePodcastVideoStore(s => s.setVideo);
  const removeVideo = usePodcastVideoStore(s => s.removeVideo);

  // Init engine
  useEffect(() => {
    const e = new DawEngine();
    engineRef.current = e;
    e.onPositionChange = (pos) => setTransport({ position: pos });
    e.onRecordedClip = async (trackId, clip) => {
      clip.peaks = computePeaks(clip.buffer!);
      if (useDawStore.getState().clips.some(c => c.id === clip.id)) updateClip(clip.id, clip);
      else addClip(clip);
      lastRecordedClipByTrackRef.current[trackId] = { clipId: clip.id, startTime: clip.startTime, at: Date.now() };
      usePodcastVideoStore.getState().attachPending(trackId, clip.id);
      setTransport({ isRecording: false, isPlaying: false });
    };
    setEngineReady(true);
    return () => { e.dispose(); engineRef.current = null; };
  }, [addClip, setTransport, updateClip]);

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
        video: {
          width: { ideal: dims.width },
          height: { ideal: dims.height },
          frameRate: { ideal: Math.min(frameRate, 30), max: 30 },
          facingMode: "user",
        },
        audio: false,
      });
      camStreamRef.current = stream;
      setCamStream(stream);
      if (previewRef.current) { previewRef.current.srcObject = stream; await previewRef.current.play().catch(() => {}); }
      setCamOn(true);
    } catch (err: any) {
      toast.error(err?.message || "Camera access denied");
    }
  }, [resolution, frameRate]);

  const stopCamera = useCallback(() => {
    try { recorderRef.current?.stop(); } catch {}
    recorderRef.current = null;
    if (videoCompositeRafRef.current) cancelAnimationFrame(videoCompositeRafRef.current);
    videoCompositeRafRef.current = null;
    setVideoRec(false);
    const s = camStreamRef.current;
    if (s) { s.getTracks().forEach(t => t.stop()); camStreamRef.current = null; }
    setCamStream(null);
    if (previewRef.current) previewRef.current.srcObject = null;
    setCamOn(false);
  }, []);

  const makeStageRecordingStream = useCallback((sourceStream: MediaStream) => {
    const videoTrack = sourceStream.getVideoTracks()[0];
    if (!videoTrack) return null;
    if (!bgUrl) return new MediaStream([videoTrack]);

    const canvas = document.createElement("canvas");
    canvas.width = resolution === "1080p" ? 1920 : resolution === "480p" ? 854 : 1280;
    canvas.height = resolution === "1080p" ? 1080 : resolution === "480p" ? 480 : 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const video = document.createElement("video");
    video.srcObject = new MediaStream([videoTrack]);
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => {});

    const bg = new Image();
    bg.crossOrigin = "anonymous";
    let bgReady = false;
    if (bgUrl) {
      bg.onload = () => { bgReady = true; };
      bg.src = bgUrl;
    }

    const drawCover = (img: CanvasImageSource, x: number, y: number, w: number, h: number) => {
      const sw = (img as HTMLVideoElement).videoWidth || (img as HTMLImageElement).naturalWidth || w;
      const sh = (img as HTMLVideoElement).videoHeight || (img as HTMLImageElement).naturalHeight || h;
      const scale = Math.max(w / sw, h / sh);
      const dw = sw * scale;
      const dh = sh * scale;
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    };

    const paint = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, W, H);
      if (bgReady) drawCover(bg, 0, 0, W, H);
      const stageCanvas = bgUrl ? stageContainerRef.current?.querySelector("canvas") : null;
      let drewStage = false;
      if (stageCanvas instanceof HTMLCanvasElement && stageCanvas.width > 0 && stageCanvas.height > 0) {
        try {
          drawCover(stageCanvas, 0, 0, W, H);
          drewStage = true;
        } catch { drewStage = false; }
      }
      if (!drewStage && video.readyState >= 2) {
        if (mirrored) {
          ctx.save();
          ctx.translate(W, 0);
          ctx.scale(-1, 1);
          drawCover(video, 0, 0, W, H);
          ctx.restore();
        } else {
          drawCover(video, 0, 0, W, H);
        }
      }
      videoCompositeRafRef.current = requestAnimationFrame(paint);
    };
    let paintStarted = false;
    const startPaint = () => {
      if (paintStarted) return;
      paintStarted = true;
      paint();
    };
    video.onloadedmetadata = startPaint;
    startPaint();
    return canvas.captureStream(Math.min(frameRate, 30));
  }, [bgUrl, frameRate, mirrored, resolution]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // Re-attach camera stream when layout / bg changes remount the <video> element.
  // Critical for "None" background: switching FROM segmented stage back to raw
  // <video> would otherwise show black until the user toggled cam off/on.
  useEffect(() => {
    const v = previewRef.current;
    const s = camStreamRef.current;
    if (v && s && v.srcObject !== s) {
      v.srcObject = s;
      v.play().catch(() => {});
    }
  }, [layoutId, camOn, tracksFull, bgUrl]);

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
      const stopPosition = e.currentPosition();
      recStopRef.current = stopPosition;
      if (rec && rec.state !== "inactive") {
        await new Promise<void>((res) => {
          const prev = rec.onstop; rec.onstop = (ev) => { try { prev?.call(rec, ev); } finally { res(); } };
          try { rec.requestData(); } catch {}
          try { rec.stop(); } catch { res(); }
        });
      }
      setVideoRec(false);
      e.stopRecording(); e.stop();
      setTransport({ isRecording: false, isPlaying: false, position: stopPosition });
      return;
    }
    if (!camStreamRef.current) { await startCamera(); }
    if (!camStreamRef.current) {
      toast.error("Turn on the camera before recording video");
      return;
    }
    const trackId = ensureRecordTrack();
    useDawStore.getState().tracks.forEach(t => updateTrack(t.id, { armed: t.id === trackId }));
    try {
      await e.resume();
      const startPos = useDawStore.getState().transport.position;
      const recordedClipId = await e.startRecording(trackId, startPos);
      const sampleRate = e.ctx.sampleRate || 48000;
      const placeholder = e.ctx.createBuffer(1, sampleRate, sampleRate);
      if (!useDawStore.getState().clips.some(c => c.id === recordedClipId)) {
        addClip({ id: recordedClipId, trackId, startTime: startPos, duration: 1, offset: 0, buffer: placeholder, peaks: new Float32Array(0), name: "Recording" });
      }
      setTransport({ isRecording: true, isPlaying: true });
      const st = useDawStore.getState();
      e.play({ ...st.transport, isRecording: true, isPlaying: true, position: startPos }, st.tracks, st.clips);

      const cam = camStreamRef.current;
      if (cam) {
        if (videoCompositeRafRef.current) cancelAnimationFrame(videoCompositeRafRef.current);
        const videoOnly = makeStageRecordingStream(cam) ?? new MediaStream(cam.getVideoTracks());
        const videoTracks = videoOnly.getVideoTracks().filter(track => track.readyState === "live");
        if (videoTracks.length === 0) throw new Error("Camera video track was not ready");
        // Store the recorded picture only; the DAW timeline stores audio
        // separately and export recombines them. This prevents audio-only WebM
        // blobs when the browser struggles with a mixed canvas+mic recorder.
        const mixedStream = new MediaStream(videoTracks);
        const mime = [
          "video/webm;codecs=vp9",
          "video/webm;codecs=vp8",
          "video/webm",
          "video/mp4;codecs=avc1.42E01F",
          "video/mp4;codecs=avc1",
          "video/mp4",
        ].find(m => MediaRecorder.isTypeSupported(m)) || "video/webm";
        const mr = new MediaRecorder(mixedStream, { mimeType: mime, videoBitsPerSecond: 4_500_000 });
        recChunksRef.current = [];
        recTrackIdRef.current = trackId;
        recStartRef.current = startPos;
        recStopRef.current = null;
        mr.ondataavailable = (ev) => { if (ev.data?.size) recChunksRef.current.push(ev.data); };
        mr.onerror = () => toast.error("Video recorder stopped unexpectedly");
        mr.onstop = () => {
          if (videoCompositeRafRef.current) cancelAnimationFrame(videoCompositeRafRef.current);
          videoCompositeRafRef.current = null;
          const blob = new Blob(recChunksRef.current, { type: mime });
          recChunksRef.current = [];
          const dur = (recStopRef.current ?? useDawStore.getState().transport.position) - recStartRef.current;
          const pendingTrackId = recTrackIdRef.current!;
          const pendingStart = recStartRef.current;
          const pendingDuration = Math.max(0.1, dur);
          if (blob.size > 0) {
            setVideo(recordedClipId, { blob, mime, durationSec: pendingDuration, participantLabel: "Host" });
          } else {
            toast.error("Video recording did not save. Please try again with camera on.");
          }
          updateClip(recordedClipId, { duration: pendingDuration });
          if (!recordedClipId) {
            setPending(pendingTrackId, {
              trackId: pendingTrackId, startTime: pendingStart,
              blob, mime, durationSec: pendingDuration, participantLabel: "Host",
            });
          }
          window.setTimeout(() => {
            if (recordedClipId) {
              const hasClip = useDawStore.getState().clips.some(c => c.id === recordedClipId);
              if (hasClip) return;
              const ctx = engineRef.current?.ctx;
              if (!ctx) return;
              const silent = ctx.createBuffer(1, Math.max(1, Math.ceil(pendingDuration * ctx.sampleRate)), ctx.sampleRate);
              addClip({ id: recordedClipId, trackId: pendingTrackId, startTime: pendingStart, duration: pendingDuration, offset: 0, buffer: silent, peaks: new Float32Array(0), name: "Recording" });
              return;
            }
            if (!usePodcastVideoStore.getState().pendingByTrack[pendingTrackId]) return;
            const latest = lastRecordedClipByTrackRef.current[pendingTrackId];
            if (latest && Math.abs(latest.startTime - pendingStart) < 0.25 && Date.now() - latest.at < 8000) {
              usePodcastVideoStore.getState().attachPending(pendingTrackId, latest.clipId);
              return;
            }
            const ctx = engineRef.current?.ctx;
            if (!ctx) return;
            const silent = ctx.createBuffer(1, Math.max(1, Math.ceil(pendingDuration * ctx.sampleRate)), ctx.sampleRate);
            const clipId = newId("clip");
            addClip({ id: clipId, trackId: pendingTrackId, startTime: pendingStart, duration: pendingDuration, offset: 0, buffer: silent, peaks: new Float32Array(0), name: "Recording" });
            usePodcastVideoStore.getState().attachPending(pendingTrackId, clipId);
          }, 3000);
        };
        mr.start(250);
        recorderRef.current = mr;
        setVideoRec(true);
      }
    } catch (err: any) {
      toast.error(err?.message || "Could not start recording");
      setTransport({ isRecording: false, isPlaying: false });
    }
  }, [addClip, ensureRecordTrack, makeStageRecordingStream, micOn, setPending, setTransport, setVideo, startCamera, updateClip, updateTrack]);

  const toggleEditorPlayback = useCallback(async () => {
    const e = engineRef.current; if (!e) return;
    const st = useDawStore.getState();
    if (st.transport.isPlaying) {
      e.stop();
      setTransport({ isPlaying: false });
      return;
    }
    await e.resume();
    const fresh = useDawStore.getState();
    setTransport({ isPlaying: true });
    e.play({ ...fresh.transport, isPlaying: true }, fresh.tracks, fresh.clips);
  }, [setTransport]);

  const seekEditorTo = useCallback((position: number) => {
    const pos = Math.max(0, position);
    const e = engineRef.current;
    const wasPlaying = useDawStore.getState().transport.isPlaying;
    if (e) e.stop();
    setTransport({ position: pos, isPlaying: wasPlaying });
    if (wasPlaying && e) {
      requestAnimationFrame(() => {
        const fresh = useDawStore.getState();
        e.play({ ...fresh.transport, position: pos, isPlaying: true }, fresh.tracks, fresh.clips);
      });
    }
  }, [setTransport]);

  const deleteClipFromEditor = useCallback((clipId: string | null) => {
    const st = useDawStore.getState();
    const fallback = st.selectedTrackId
      ? st.clips.find(c => c.trackId === st.selectedTrackId && st.transport.position >= c.startTime && st.transport.position <= c.startTime + c.duration)?.id
      : null;
    const targetId = clipId || fallback;
    if (!targetId) return false;
    const exists = st.clips.some(c => c.id === targetId);
    if (!exists) return false;
    removeVideo(targetId);
    removeClip(targetId);
    return true;
  }, [removeClip, removeVideo]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      if (!tracksOpen) return;
      if (e.code === "Space") {
        e.preventDefault();
        void toggleEditorPlayback();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (deleteClipFromEditor(useDawStore.getState().selectedClipId)) e.preventDefault();
      } else if (e.key === "Enter") {
        const selected = useDawStore.getState().clips.find(c => c.id === useDawStore.getState().selectedClipId);
        e.preventDefault();
        seekEditorTo(selected?.startTime ?? 0);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteClipFromEditor, seekEditorTo, toggleEditorPlayback, tracksOpen]);

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
    const code = sessionCode;
    const url = `${window.location.origin}/#/tv/podcast/join/${code}`;
    navigator.clipboard.writeText(url).catch(() => {});
    toast.success("Magic link copied", { description: url });
  }, [sessionCode]);

  const handleDeleteRecording = useCallback((clipId: string) => {
    const clipExists = useDawStore.getState().clips.some(c => c.id === clipId);
    removeVideo(clipId);
    if (clipExists) removeClip(clipId);
    toast.success("Recording removed");
  }, [removeClip, removeVideo]);

  // Live captions via Web Speech API — auto-hides after ~2s of silence so
  // captions don't linger on screen when the host stops talking.
  const toggleCaptions = useCallback(() => {
    if (captionsOn) {
      try { recognitionRef.current?.stop(); } catch {}
      recognitionRef.current = null;
      if (captionHideTimerRef.current) { window.clearTimeout(captionHideTimerRef.current); captionHideTimerRef.current = null; }
      setCaptionsOn(false);
      setCaptionText("");
      return;
    }
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Live captions need Chrome or Edge"); return; }
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (ev: any) => {
      // Use ONLY the latest result so captions don't grow forever or freeze.
      const last = ev.results[ev.results.length - 1];
      const txt = (last?.[0]?.transcript || "").trim();
      setCaptionText(txt.slice(-160));
      if (captionHideTimerRef.current) window.clearTimeout(captionHideTimerRef.current);
      captionHideTimerRef.current = window.setTimeout(() => setCaptionText(""), 2200);
    };
    r.onerror = () => {};
    // Auto-restart if the browser stops the recognizer (it does so often on Chrome).
    r.onend = () => {
      if (!recognitionRef.current) return;
      try { r.start(); } catch {}
    };
    try { r.start(); recognitionRef.current = r; setCaptionsOn(true); }
    catch { toast.error("Could not start captions"); }
  }, [captionsOn]);

  useEffect(() => () => {
    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;
    if (captionHideTimerRef.current) window.clearTimeout(captionHideTimerRef.current);
  }, []);

  // Screen sharing
  const toggleScreenShare = useCallback(async () => {
    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setScreenSharing(false);
      if (previewRef.current && camStreamRef.current) {
        previewRef.current.srcObject = camStreamRef.current;
        previewRef.current.play().catch(() => {});
      }
      return;
    }
    try {
      const s = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = s;
      if (previewRef.current) { previewRef.current.srcObject = s; previewRef.current.play().catch(() => {}); }
      setScreenSharing(true);
      s.getVideoTracks()[0].addEventListener("ended", () => {
        setScreenSharing(false);
        screenStreamRef.current = null;
        if (previewRef.current && camStreamRef.current) {
          previewRef.current.srcObject = camStreamRef.current;
          previewRef.current.play().catch(() => {});
        }
      });
    } catch (err: any) { toast.error(err?.message || "Screen share denied"); }
  }, [screenSharing]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    const el = stageContainerRef.current;
    if (!document.fullscreenElement && el?.requestFullscreen) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  // Realtime room chat keyed to the podcast session code. If the host hasn't
  // created/shared a session code yet, it still works locally on this device.
  useEffect(() => {
    if (!sessionCode) return;
    const channel = supabase.channel(`podcast-chat-${sessionCode.trim()}`, {
      config: { broadcast: { ack: false, self: false } },
    });
    chatChannelRef.current = channel;
    channel
      .on("broadcast", { event: "message" }, ({ payload }) => {
        const data = payload as ChatMessage & { clientId?: string };
        if (!data?.id || data.clientId === chatClientIdRef.current) return;
        setChatMessages(p => p.some(m => m.id === data.id) ? p : [...p, data]);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ name?: string }>();
        const names = Object.values(state).flat().map((p) => p.name || "Guest");
        setParticipants(["You", ...Array.from(new Set(names)).filter((n) => n !== "You")]);
      })
      .subscribe((status) => {
        chatSubscribedRef.current = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED") void channel.track({ name: "You" });
      });
    return () => {
      chatSubscribedRef.current = false;
      chatChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [sessionCode]);

  const sendChat = useCallback(async (text?: string, file?: File) => {
    const msg: ChatMessage = { id: Math.random().toString(36).slice(2), author: "You", ts: Date.now() };
    if (text?.trim()) msg.text = text.trim();
    if (file) {
      if (file.size > 2_000_000) {
        toast.error("Attach a smaller image or short video for live chat");
        return;
      }
      msg.mediaType = file.type.startsWith("video/") ? "video" : "image";
      try {
        msg.mediaUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Couldn't attach file"));
          reader.readAsDataURL(file);
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't attach file");
        return;
      }
    }
    if (!msg.text && !msg.mediaUrl) return;
    setChatMessages(p => [...p, msg]);
    if (sessionCode) {
      const send = () => chatChannelRef.current?.send({
        type: "broadcast",
        event: "message",
        payload: { ...msg, clientId: chatClientIdRef.current },
      });
      if (chatSubscribedRef.current) void send();
      else window.setTimeout(() => { void send(); }, 200);
    }
  }, [sessionCode]);

  // Share Web Share API for invite link
  const shareSheet = useCallback((url: string) => {
    if ((navigator as any).share) {
      (navigator as any).share({ title: "Join my podcast", text: "Hop into the studio", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copied");
    }
  }, []);

  // Body scroll lock — only when studio is visible (not when minimized).
  useEffect(() => {
    if (isMinimized) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isMinimized]);

  const goTo = useCallback((path: string) => { minimizeSession(); navigate(path); }, [minimizeSession, navigate]);
  const leaveSession = useCallback(() => { closeSession(); navigate("/tv"); }, [closeSession, navigate]);

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

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-neutral-950 text-neutral-100 overflow-hidden">
      {/* Top minimal header */}
      <header className="h-12 shrink-0 flex items-center justify-between px-3 border-b border-neutral-900">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => { minimizeSession(); navigate("/"); }} className="p-1.5 rounded hover:bg-neutral-900" title="Minimize — session keeps recording">
            <ChevronDownIcon className="w-4 h-4 text-neutral-300" />
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
          <div className="flex-1 relative grid place-items-center p-2 md:p-4 min-h-0">
            <div ref={stageContainerRef} className="relative w-full max-w-3xl flex flex-col gap-2 md:gap-3">
              <div className="relative w-full rounded-2xl overflow-hidden border border-violet-500/40 shadow-[0_0_0_2px_rgba(139,92,246,0.15)] aspect-video bg-black">
                <StageLayout
                  layoutId={layoutId}
                  hostVideoRef={previewRef}
                  hostName="jay"
                  camOn={camOn || screenSharing}
                  mirrored={mirrored && !screenSharing}
                  onStartCamera={startCamera}
                  bgUrl={screenSharing ? null : bgUrl}
                  camStream={screenSharing ? null : camStream}
                  guestLabels={participants.slice(1)}
                />
                {videoRec && (
                  <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center gap-1 z-30">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> REC
                  </div>
                )}
                {captionsOn && captionText && (
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 max-w-[88%] z-30 text-center leading-tight pointer-events-none">
                    <span className={CAPTION_STYLES.find(s => s.id === captionStyle)?.className}>
                      {captionText}
                    </span>
                  </div>
                )}
                {/* Floating stage controls (top-right of stage) */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 z-30">
                  <StageBtn onClick={toggleScreenShare} title={screenSharing ? "Stop sharing" : "Share screen"} active={screenSharing}>
                    {screenSharing ? <MonitorOff className="w-4 h-4" /> : <MonitorUp className="w-4 h-4" />}
                  </StageBtn>
                  <StageBtn onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Expand"}>
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </StageBtn>
                </div>
              </div>
              {/* Record bar — sits directly under the video preview. Combines
                  media controls + Projects / J-Hi / Leave + page nav so the user
                  can jump anywhere in the app WITHOUT killing the session. */}
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center justify-center gap-2 md:gap-3 flex-wrap">
                  <button
                    onClick={handleRecord}
                    title={isRecording ? "Stop recording" : "Start recording"}
                    className={`relative w-12 h-12 rounded-full grid place-items-center shadow-lg shadow-red-900/40 transition ${isRecording ? "bg-red-700 hover:bg-red-600 animate-pulse" : "bg-red-600 hover:bg-red-500"}`}
                  >
                    <span className="absolute inset-1.5 rounded-full border-2 border-white/70" />
                    {isRecording
                      ? <Square className="w-4 h-4 fill-white text-white" />
                      : <span className="w-3.5 h-3.5 rounded-full bg-white" />}
                  </button>
                  <button onClick={() => setMicOn(m => !m)} title={micOn ? "Mute mic" : "Unmute mic"} className={`w-10 h-10 rounded-full grid place-items-center ${micOn ? "bg-neutral-800 hover:bg-neutral-700 text-white" : "bg-neutral-900 text-neutral-500"}`}>
                    <Mic className="w-4 h-4" />
                  </button>
                  <button onClick={() => camOn ? stopCamera() : startCamera()} title={camOn ? "Stop camera" : "Start camera"} className={`w-10 h-10 rounded-full grid place-items-center ${camOn ? "bg-neutral-800 hover:bg-neutral-700 text-white" : "bg-neutral-900 text-neutral-500"}`}>
                    {camOn ? <VideoIcon className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  </button>
                  <button onClick={toggleCaptions} title="Live captions" className={`w-10 h-10 rounded-full grid place-items-center ${captionsOn ? "bg-cyan-600 text-white" : "bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white"}`}>
                    <CaptionsIcon className="w-4 h-4" />
                  </button>
                  <div className="w-px h-8 bg-neutral-800 mx-1" />
                  <button onClick={() => setRightPanel(p => p === "projects" ? null : "projects")} title="Recorded projects" className={`w-10 h-10 rounded-full grid place-items-center ${rightPanel === "projects" ? "bg-neutral-700 text-white" : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white"}`}>
                    <FolderOpen className="w-4 h-4" />
                  </button>
                  <button onClick={() => setRightPanel(p => p === "jhi" ? null : "jhi")} title="Ask J-Hi" className={`w-10 h-10 rounded-full grid place-items-center ${rightPanel === "jhi" ? "bg-cyan-600 text-white" : "bg-neutral-900 hover:bg-neutral-800"}`}>
                    <JhiIcon className="w-5 h-5" active />
                  </button>
                  <button onClick={leaveSession} title="Leave — ends the session" className="w-10 h-10 rounded-full grid place-items-center bg-red-600/15 text-red-400 hover:bg-red-600 hover:text-white">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
                <div className="md:hidden flex items-center justify-center gap-1 overflow-x-auto max-w-full px-1">
                  {[
                    { id: "people" as const, icon: Users, label: "People" },
                    { id: "chat" as const, icon: MessageCircle, label: "Chat" },
                    { id: "effects" as const, icon: Sparkles, label: "Effects" },
                    { id: "captions" as const, icon: CaptionsIcon, label: "Captions" },
                    { id: "settings" as const, icon: SettingsIcon, label: "Settings" },
                    { id: "help" as const, icon: HelpCircle, label: "Help" },
                  ].map(({ id, icon: Icon, label }) => (
                    <button key={id} onClick={() => setRightPanel(p => p === id ? null : id)} className={`shrink-0 w-12 h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[9px] ${rightPanel === id ? "bg-neutral-800 text-white" : "bg-neutral-900 text-neutral-400"}`}>
                      <Icon className="w-4 h-4" />{label}
                    </button>
                  ))}
                </div>
                {/* Page nav — minimize the studio (keeps recording!) and jump to another app section */}
                <div className="flex items-center justify-center gap-1 text-[10px] text-neutral-500">
                  <NavPill icon={<Home className="w-3.5 h-3.5" />} label="Home" onClick={() => goTo("/")} />
                  <NavPill icon={<Rss className="w-3.5 h-3.5" />} label="Feed" onClick={() => goTo("/feed")} />
                  <NavPill icon={<Tv className="w-3.5 h-3.5" />} label="TV" onClick={() => goTo("/tv")} />
                  <NavPill icon={<UserIcon className="w-3.5 h-3.5" />} label="Profile" onClick={() => goTo("/profile")} />
                </div>
              </div>
            </div>
          </div>


          {/* Layout strip */}
          <div className="shrink-0 px-2 md:px-4 py-2 md:py-3 flex items-center justify-center gap-2 overflow-x-auto">
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
        <nav className="hidden md:flex shrink-0 w-16 border-l border-neutral-900 flex-col items-center py-3 gap-1">
          {[
            { id: "people" as const, icon: Users, label: "People" },
            { id: "chat" as const, icon: MessageCircle, label: "Chat" },
            { id: "effects" as const, icon: Sparkles, label: "Effects" },
            { id: "captions" as const, icon: CaptionsIcon, label: "Captions" },
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
            <button onClick={() => setRightPanel(p => p === "jhi" ? null : "jhi")} className={`w-10 h-10 rounded grid place-items-center ${rightPanel === "jhi" ? "bg-cyan-600 text-white" : "text-cyan-400 hover:text-cyan-300"}`} title="Ask J-Hi"><JhiIcon className="w-5 h-5" active={rightPanel === "jhi"} /></button>
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
          <aside className="absolute top-0 right-0 md:right-16 h-full w-full max-w-[320px] bg-neutral-950 border-l border-neutral-900 z-30 flex flex-col">
            <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-neutral-900">
              <div className="text-sm font-medium capitalize">{rightPanel === "effects" ? "Visual effects" : rightPanel}</div>
              <button onClick={() => setRightPanel(null)} className="p-1 text-neutral-500 hover:text-neutral-100"><X className="w-4 h-4" /></button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 text-sm">
              {rightPanel === "people" && <PeoplePanel onInvite={inviteGuest} onShare={shareSheet} sessionCode={sessionCode} participants={participants} />}
              {rightPanel === "chat" && <ChatPanel messages={chatMessages} onSend={sendChat} />}
              {rightPanel === "effects" && (
                <EffectsPanel
                  mirrored={mirrored} setMirrored={setMirrored}
                  bgUrl={bgUrl} setBgUrl={setBgUrl}
                  customBgs={customBgs}
                  onAddCustomBg={() => bgUploadRef.current?.click()}
                />
              )}
              {rightPanel === "captions" && <CaptionsPanel on={captionsOn} onToggle={toggleCaptions} text={captionText} style={captionStyle} setStyle={setCaptionStyle} />}
              {rightPanel === "jhi" && <JhiPanel />}
              {rightPanel === "media" && <MediaPanel onImport={() => importInputRef.current?.click()} />}
              {rightPanel === "projects" && (
                <ProjectsPanel
                  onDeleteRecording={handleDeleteRecording}
                  onOpenInEditor={() => { setRightPanel(null); setTracksOpen(true); setTracksFull(true); }}
                />
              )}
              {rightPanel === "settings" && (
                <SettingsPanel
                  resolution={resolution} setResolution={setResolution}
                  frameRate={frameRate} setFrameRate={setFrameRate}
                  micOn={micOn} setMicOn={setMicOn}
                  mirrored={mirrored} setMirrored={setMirrored}
                />
              )}
              {rightPanel === "help" && <div className="text-neutral-500 text-xs">Drop video/audio onto the stage to import. Tap Record to start. Tap Tracks to inspect waveforms.</div>}
            </div>
          </aside>
        )}

        {/* Tracks drawer (slides up from above bottom bar) */}
        <div
          className={`hidden md:block absolute left-0 right-16 bottom-0 bg-neutral-950 border-t border-neutral-900 transition-all duration-300 z-20 ${tracksOpen ? "translate-y-0" : "translate-y-full"}`}
          style={{ height: tracksFull ? "calc(100% - 8px)" : "55%" }}
        >
          <div className="h-10 flex items-center gap-2 px-3 border-b border-neutral-900">
            <div className="text-[11px] uppercase tracking-wider text-neutral-500 mr-2">Edit · {tracks.length} tracks</div>
            <TransportControls engineRef={engineRef} />
            <div className="flex-1" />
            <button onClick={() => setTracksFull(f => !f)} className="p-1 text-neutral-400 hover:text-neutral-100" title={tracksFull ? "Restore" : "Maximize editor"}>
              {tracksFull ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button onClick={() => { setTracksFull(false); setTracksOpen(false); }} className="p-1 text-neutral-500 hover:text-neutral-200" title="Hide editor"><ChevronDown className="w-4 h-4" /></button>
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
            className="hidden md:flex absolute left-3 bottom-3 z-10 h-8 px-3 rounded-full bg-neutral-900/90 border border-neutral-800 text-[11px] text-neutral-300 hover:text-white items-center gap-1.5"
          >
            <ChevronUp className="w-3.5 h-3.5" /> Edit
          </button>
        )}
      </div>

      {/* Footer removed — Projects, J-Hi, Leave and page nav now live in the
          record action row directly under the video preview. */}

      <input
        ref={importInputRef} type="file" multiple
        accept=".wav,.mp3,.ogg,.m4a,.mp4,.webm,.mov,.m4v,audio/*,video/*"
        className="hidden"
        onChange={(e) => e.target.files && importFiles(e.target.files)}
      />
      <input
        ref={bgUploadRef} type="file" accept="image/*,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]; if (!f) return;
          const url = URL.createObjectURL(f);
          setCustomBgs(p => [url, ...p]);
          setBgUrl(url);
          e.target.value = "";
        }}
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

function NavPill({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 px-2.5 py-1 rounded-full hover:bg-neutral-900 hover:text-neutral-200">
      {icon}<span>{label}</span>
    </button>
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

function StageBtn({ children, onClick, title, active }: { children: React.ReactNode; onClick: () => void; title: string; active?: boolean }) {
  return (
    <button onClick={onClick} title={title} className={`w-9 h-9 rounded-full grid place-items-center backdrop-blur ${active ? "bg-cyan-600 text-white" : "bg-black/55 text-white hover:bg-black/75"}`}>
      {children}
    </button>
  );
}

function PeoplePanel({ onInvite, onShare, sessionCode, participants }: { onInvite: () => void; onShare: (url: string) => void; sessionCode: string; participants: string[] }) {
  const code = sessionCode || "SESSION";
  const url = `${window.location.origin}/#/tv/podcast/join/${code}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`;
  const smsHref = `sms:?&body=${encodeURIComponent(`Join my podcast studio: ${url}`)}`;
  const mailHref = `mailto:?subject=${encodeURIComponent("Join my podcast")}&body=${encodeURIComponent(url)}`;
  return (
    <div className="space-y-3">
      <button onClick={onInvite} className="w-full h-10 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium flex items-center justify-center gap-2">
        <LinkIcon className="w-4 h-4" /> Copy magic link
      </button>
      <div className="grid grid-cols-3 gap-2">
        <a href={smsHref} className="h-10 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-[11px] text-neutral-200 flex items-center justify-center gap-1.5">
          <Smartphone className="w-3.5 h-3.5" /> Text
        </a>
        <button onClick={() => onShare(url)} className="h-10 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-[11px] text-neutral-200 flex items-center justify-center gap-1.5">
          <Share2 className="w-3.5 h-3.5" /> Share
        </button>
        <a href={mailHref} className="h-10 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-[11px] text-neutral-200 flex items-center justify-center gap-1.5">
          <Send className="w-3.5 h-3.5" /> Email
        </a>
      </div>
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 flex items-center gap-3">
        <img src={qrUrl} alt="Join QR code" className="w-20 h-20 rounded bg-white p-1" />
        <div className="min-w-0 text-[11px] text-neutral-400 leading-relaxed">
          <div className="flex items-center gap-1 text-neutral-200 mb-1"><QrCode className="w-3 h-3" /> Scan to join</div>
          <div className="break-all text-[10px] text-neutral-500">{url}</div>
        </div>
      </div>
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">In the studio · {Math.max(1, participants.length)}</div>
      {participants.map((name, index) => (
        <div key={`${name}-${index}`} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-neutral-700 grid place-items-center text-xs font-semibold">{name[0] || "G"}</div>
          <div className="min-w-0">
            <div className="text-sm text-neutral-100 truncate">{index === 0 ? "jay (You)" : name}</div>
            <div className="text-[11px] text-neutral-500">{index === 0 ? "Host" : "Guest"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CaptionsPanel({ on, onToggle, text, style, setStyle }: {
  on: boolean; onToggle: () => void; text: string;
  style: CaptionStyle; setStyle: (s: CaptionStyle) => void;
}) {
  return (
    <div className="space-y-4">
      <Row label="Live captions"><Toggle on={on} onChange={onToggle} /></Row>
      <p className="text-[11px] text-neutral-500">Captions auto-hide when you stop speaking and reappear the moment you talk again.</p>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-neutral-500 mb-2">Caption style</div>
        <div className="grid grid-cols-2 gap-2">
          {CAPTION_STYLES.map(s => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              className={`relative h-14 rounded-lg border overflow-hidden grid place-items-center bg-neutral-900 ${
                style === s.id ? "border-cyan-400 ring-2 ring-cyan-500/30" : "border-neutral-800 hover:border-neutral-700"
              }`}
            >
              <span className={s.className} style={{ fontSize: 11 }}>{s.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 min-h-[80px] text-sm text-neutral-200">
        {on ? (text || <span className="text-neutral-500 italic">Listening… start speaking</span>) : <span className="text-neutral-500 italic">Off</span>}
      </div>
    </div>
  );
}

function ChatPanel({ messages, onSend }: { messages: ChatMessage[]; onSend: (text?: string, file?: File) => void }) {
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="flex flex-col h-full -m-4">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && <div className="text-[11px] text-neutral-500 text-center py-8">Say hi 👋 — chat appears here for everyone in the room.</div>}
        {messages.map(m => (
          <div key={m.id} className="rounded-lg bg-neutral-900 border border-neutral-800 p-2">
            <div className="text-[10px] text-neutral-500 mb-1">{m.author}</div>
            {m.text && <div className="text-xs text-neutral-100 break-words whitespace-pre-wrap">{m.text}</div>}
            {m.mediaUrl && m.mediaType === "image" && <img src={m.mediaUrl} alt="" className="mt-1 rounded max-h-48" />}
            {m.mediaUrl && m.mediaType === "video" && <video src={m.mediaUrl} controls className="mt-1 rounded max-h-48 w-full" />}
          </div>
        ))}
      </div>
      <div className="border-t border-neutral-900 p-2 flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onSend(undefined, f); e.target.value = ""; }} />
        <button onClick={() => fileRef.current?.click()} className="p-2 rounded text-neutral-400 hover:text-cyan-300 hover:bg-neutral-900" title="Attach photo or video">
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { onSend(text); setText(""); } }}
          placeholder="Message"
          className="flex-1 h-8 bg-neutral-900 border border-neutral-800 rounded px-2 text-xs text-neutral-100 outline-none focus:border-cyan-500/60"
        />
        <button onClick={() => { onSend(text); setText(""); }} className="h-8 px-3 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs flex items-center gap-1">
          <Send className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

/* ----------------------- Inline J-Hi chat panel ----------------------- */

type JhiMsg = { role: "user" | "assistant"; content: string };
const JHI_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-jhi`;

function JhiPanel() {
  const [messages, setMessages] = useState<JhiMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: JhiMsg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    let soFar = "";
    const upsert = (chunk: string) => {
      soFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: soFar } : m);
        return [...prev, { role: "assistant", content: soFar }];
      });
    };
    try {
      const resp = await fetch(JHI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next }),
      });
      if (!resp.ok || !resp.body) throw new Error("Couldn't reach J-Hi");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { buf = ""; break; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch { /* partial chunk */ }
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "J-Hi error");
      if (!soFar) setMessages(p => p.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  const prompts = [
    "Give me 3 episode title ideas for a podcast about hustle culture",
    "Write a 30-second intro script for me",
    "What questions should I ask my guest?",
  ];

  return (
    <div className="flex flex-col h-full -m-4">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-900">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 grid place-items-center">
          <JhiIcon className="w-5 h-5" active />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-neutral-100">J-Hi</div>
          <div className="text-[10px] text-neutral-500">In-studio assistant</div>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] text-neutral-500 px-1">Ask J-Hi for script help, episode names, guest questions, or studio tips.</p>
            {prompts.map(p => (
              <button key={p} onClick={() => send(p)} className="w-full text-left p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-cyan-500/40 text-[11px] text-neutral-200 leading-snug">
                {p}
              </button>
            ))}
          </div>
        ) : messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
              m.role === "user"
                ? "bg-gradient-to-br from-cyan-600 to-blue-600 text-white rounded-br-md"
                : "bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-bl-md"
            }`}>
              {m.role === "assistant"
                ? <div className="prose prose-sm prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                : m.content}
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl rounded-bl-md px-3 py-2 flex gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/60 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/60 animate-bounce" style={{ animationDelay: "120ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/60 animate-bounce" style={{ animationDelay: "240ms" }} />
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-neutral-900 p-2 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          rows={1}
          placeholder="Ask J-Hi…"
          className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-100 outline-none focus:border-cyan-500/60 resize-none max-h-24"
        />
        <button onClick={() => send(input)} disabled={!input.trim() || loading} className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white grid place-items-center disabled:opacity-40">
          <ArrowUp className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}


function EffectsPanel({
  mirrored, setMirrored, bgUrl, setBgUrl, customBgs, onAddCustomBg,
}: {
  mirrored: boolean; setMirrored: (b: boolean) => void;
  bgUrl: string | null; setBgUrl: (u: string | null) => void;
  customBgs: string[]; onAddCustomBg: () => void;
}) {
  const Cell = ({ url, label, selected, onClick }: { url: string | null; label: string; selected: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`relative aspect-video rounded-md overflow-hidden border transition ${selected ? "border-cyan-400 ring-2 ring-cyan-500/40" : "border-neutral-800 hover:border-neutral-600"}`}
      style={url ? { backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" } : { background: "#0a0a0a" }}
      title={label}
    >
      {!url && <div className="absolute inset-0 grid place-items-center text-[10px] text-neutral-500">None</div>}
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent text-[9px] text-white px-1 py-0.5 truncate">{label}</div>
    </button>
  );
  return (
    <div className="space-y-4">
      <Row label="Mirror my video"><Toggle on={mirrored} onChange={setMirrored} /></Row>
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-neutral-500">Backgrounds</div>
        <button onClick={onAddCustomBg} className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
          <Upload className="w-3 h-3" /> Upload
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Cell url={null} label="None" selected={!bgUrl} onClick={() => setBgUrl(null)} />
        {customBgs.map((u, i) => (
          <Cell key={`c-${i}`} url={u} label={`Custom ${i + 1}`} selected={bgUrl === u} onClick={() => setBgUrl(u)} />
        ))}
        {BG_LIBRARY.map(bg => (
          <Cell key={bg.id} url={bg.url} label={bg.label} selected={bgUrl === bg.url} onClick={() => setBgUrl(bg.url)} />
        ))}
      </div>
      <p className="text-[10px] text-neutral-500">Person-only background replacement is active when your camera is on.</p>
    </div>
  );
}

function ProjectsPanel({ onDeleteRecording, onOpenInEditor }: {
  onDeleteRecording: (clipId: string) => void;
  onOpenInEditor: () => void;
}) {
  const videos = usePodcastVideoStore(s => s.videos);
  const entries = Object.entries(videos);
  return (
    <div className="space-y-3">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">Recorded videos · {entries.length}</div>
      {entries.length === 0 && (
        <div className="text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-lg p-6 text-center">
          No recordings yet. Hit <span className="text-red-400 font-medium">Record</span> to capture your first clip.
        </div>
      )}
      <div className="space-y-3">
        {entries.map(([clipId, v]) => (
          <div key={clipId} className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
            <video src={v.url} controls playsInline className="w-full aspect-video bg-black" />
            <div className="p-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs text-neutral-200 truncate">{v.participantLabel || "Take"}</div>
                <div className="text-[10px] text-neutral-500">{v.durationSec ? `${v.durationSec.toFixed(1)}s` : ""} · {v.mime.split(";")[0]}</div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => onDeleteRecording(clipId)} className="p-1.5 rounded text-neutral-400 hover:text-red-300 hover:bg-red-600/10" title="Delete recording">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={onOpenInEditor} className="h-7 px-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] flex items-center gap-1" title="Open in editor">
                  <ArrowLeftToLine className="w-3 h-3" /> Edit
                </button>
              </div>
            </div>
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
  resolution, setResolution, frameRate, setFrameRate, micOn, setMicOn, mirrored, setMirrored,
}: {
  resolution: "480p" | "720p" | "1080p"; setResolution: (v: any) => void;
  frameRate: 24 | 30 | 60; setFrameRate: (v: any) => void;
  micOn: boolean; setMicOn: (b: boolean) => void;
  mirrored: boolean; setMirrored: (b: boolean) => void;
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

/* ----------------------------- Stage Layout ----------------------------- */

function StageLayout({
  layoutId, hostVideoRef, hostName, camOn, mirrored, onStartCamera, bgUrl, camStream, guestLabels,
}: {
  layoutId: string;
  hostVideoRef: React.RefObject<HTMLVideoElement>;
  hostName: string;
  camOn: boolean;
  mirrored: boolean;
  onStartCamera: () => void;
  bgUrl: string | null;
  camStream: MediaStream | null;
  guestLabels: string[];
}) {
  // When a background is selected, render via the SegmentedStage canvas which
  // uses MediaPipe selfie-segmentation to keep ONLY the person and replace
  // everything else with the chosen background.
  const useSegmenter = !!(bgUrl && camStream && camOn);

  const Host = (
    <div className="relative w-full h-full overflow-hidden bg-black">
      {useSegmenter ? (
        <SegmentedStage
          stream={camStream}
          bgUrl={bgUrl}
          mirrored={mirrored}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <video
          ref={hostVideoRef}
          muted
          playsInline
          className={`relative w-full h-full object-cover ${mirrored ? "scale-x-[-1]" : ""} ${camOn ? "" : "hidden"}`}
        />
      )}
      {!camOn && (
        <div className="absolute inset-0 grid place-items-center text-neutral-500 text-sm gap-3">
          <VideoOff className="w-8 h-8 opacity-40" />
          <button onClick={onStartCamera} className="h-8 px-3 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-medium">
            Turn on camera
          </button>
        </div>
      )}
      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/50 text-white text-xs z-10">{hostName}</div>
    </div>
  );

  const getGuest = (index: number) => guestLabels[index] || `Guest ${index + 1}`;
  const Guest = ({ label }: { label: string }) => (
    <div className="relative w-full h-full bg-neutral-900 grid place-items-center">
      <div className="w-12 h-12 rounded-full bg-neutral-700 grid place-items-center text-sm text-neutral-300 font-semibold">
        {label[0]}
      </div>
      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/50 text-white text-xs">{label}</div>
    </div>
  );

  if (layoutId === "grid2") {
    return <div className="grid grid-cols-2 gap-1 w-full h-full">{Host}<Guest label={getGuest(0)} /></div>;
  }
  if (layoutId === "grid3") {
    return <div className="grid grid-cols-3 gap-1 w-full h-full">{Host}<Guest label={getGuest(0)} /><Guest label={getGuest(1)} /></div>;
  }
  if (layoutId === "grid4") {
    return <div className="grid grid-cols-2 grid-rows-2 gap-1 w-full h-full">{Host}<Guest label={getGuest(0)} /><Guest label={getGuest(1)} /><Guest label={getGuest(2)} /></div>;
  }
  if (layoutId === "pip") {
    return (
      <div className="relative w-full h-full">
        <Guest label={getGuest(0)} />
        <div className="absolute bottom-3 right-3 w-1/4 aspect-video rounded-lg overflow-hidden border-2 border-white/30 shadow-xl">
          {Host}
        </div>
      </div>
    );
  }
  if (layoutId === "side") {
    return (
      <div className="grid w-full h-full" style={{ gridTemplateColumns: "1fr 25%", gap: 4 }}>
        {Host}
        <div className="grid grid-rows-3 gap-1"><Guest label={getGuest(0)} /><Guest label={getGuest(1)} /><Guest label={getGuest(2)} /></div>
      </div>
    );
  }
  if (layoutId === "stage") {
    return (
      <div className="grid w-full h-full" style={{ gridTemplateRows: "1fr 25%", gap: 4 }}>
        {Host}
        <div className="grid grid-cols-3 gap-1"><Guest label={getGuest(0)} /><Guest label={getGuest(1)} /><Guest label={getGuest(2)} /></div>
      </div>
    );
  }
  return Host;
}

/* --------------------------- Transport Controls ------------------------- */

function TransportControls({ engineRef }: { engineRef: React.MutableRefObject<DawEngine | null> }) {
  const transport = useDawStore(s => s.transport);
  const setTransport = useDawStore(s => s.setTransport);
  const tracks = useDawStore(s => s.tracks);
  const clips = useDawStore(s => s.clips);

  const onPlay = useCallback(async () => {
    const e = engineRef.current; if (!e) return;
    if (transport.isPlaying) {
      e.stop();
      setTransport({ isPlaying: false });
    } else {
      await e.resume();
      const t = useDawStore.getState().transport;
      setTransport({ isPlaying: true });
      e.play({ ...t, isPlaying: true }, tracks, clips);
    }
  }, [transport.isPlaying, setTransport, tracks, clips, engineRef]);

  const onStop = useCallback(() => {
    const e = engineRef.current; if (!e) return;
    e.stop();
    setTransport({ isPlaying: false, position: 0 });
  }, [setTransport, engineRef]);

  const onRewind = useCallback(() => {
    setTransport({ position: Math.max(0, transport.position - 5) });
  }, [transport.position, setTransport]);

  const onForward = useCallback(() => {
    setTransport({ position: transport.position + 5 });
  }, [transport.position, setTransport]);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const cs = Math.floor((s % 1) * 100);
    return `${m}:${sec.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-1">
      <button onClick={onRewind} title="Back 5s" className="w-8 h-7 rounded grid place-items-center text-neutral-300 hover:bg-neutral-800 hover:text-white">
        <SkipBack className="w-4 h-4" />
      </button>
      <button onClick={onPlay} title={transport.isPlaying ? "Pause" : "Play"} className={`w-9 h-7 rounded grid place-items-center ${transport.isPlaying ? "bg-cyan-600 text-white" : "bg-neutral-800 text-neutral-100 hover:bg-neutral-700"}`}>
        {transport.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
      </button>
      <button onClick={onStop} title="Stop" className="w-8 h-7 rounded grid place-items-center text-neutral-300 hover:bg-neutral-800 hover:text-white">
        <Square className="w-3.5 h-3.5 fill-current" />
      </button>
      <button onClick={onForward} title="Forward 5s" className="w-8 h-7 rounded grid place-items-center text-neutral-300 hover:bg-neutral-800 hover:text-white">
        <SkipForward className="w-4 h-4" />
      </button>
      <span className="ml-2 px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-[11px] font-mono text-neutral-300 tabular-nums">
        {fmt(transport.position)}
      </span>
    </div>
  );
}
