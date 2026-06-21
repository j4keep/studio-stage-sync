import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Share2, Circle, Square,
  Pause, Play, Users, MessageSquare, FolderDown, Settings as SettingsIcon,
  Download, Trash2, Edit3, Check, ArrowLeft, Wifi, AlertTriangle, RotateCcw,
  Shield, X, LayoutGrid, Captions, Image as ImageIcon, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import PodcastEditorPro from "./PodcastEditorPro";
import { usePodcastLiveRoom, type RoomParticipant } from "./usePodcastLiveRoom";
import { PodcastRecovery, PodcastFinals, type RecoverySessionRow } from "./podcastRecoveryStore";
import { supabase } from "@/integrations/supabase/client";
import PodcastInviteSheet, { type PodcastSecurity } from "./PodcastInviteSheet";
import { usePodcastDoorman } from "./usePodcastDoorman";
import { PodcastSessionStore, evaluateJoinGate, type ScheduledPodcastSession } from "./podcastSessionStore";

type LocalRecording = {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  mime: string;
  createdAt: number;
  durationMs: number;
  trimStart: number;
  trimEnd: number;
  recovered?: boolean;
};

type Tab = "people" | "chat" | "files" | "tools";

const LAYOUTS: { id: string; label: string }[] = [
  { id: "auto", label: "Auto grid" },
  { id: "speaker", label: "Speaker focus" },
  { id: "split", label: "Side-by-side" },
  { id: "3up", label: "3-up row" },
  { id: "pip", label: "Picture-in-picture" },
  { id: "screen", label: "Screen-share priority" },
];

const BACKGROUNDS: { id: string; label: string; preview: string }[] = [
  { id: "none", label: "None", preview: "transparent" },
  { id: "blur", label: "Blur", preview: "linear-gradient(135deg,#1f2937,#374151)" },
  { id: "studio-purple", label: "Studio Purple", preview: "linear-gradient(135deg,#3b0764,#9333ea)" },
  { id: "midnight", label: "Midnight", preview: "linear-gradient(135deg,#020617,#1e293b)" },
  { id: "sunset", label: "Sunset", preview: "linear-gradient(135deg,#7c2d12,#f59e0b)" },
  { id: "ocean", label: "Ocean", preview: "linear-gradient(135deg,#0c4a6e,#06b6d4)" },
  { id: "forest", label: "Forest", preview: "linear-gradient(135deg,#14532d,#22c55e)" },
  { id: "neon", label: "Neon", preview: "linear-gradient(135deg,#831843,#ec4899)" },
  { id: "rose", label: "Rose Gold", preview: "linear-gradient(135deg,#9f1239,#fda4af)" },
  { id: "graphite", label: "Graphite", preview: "linear-gradient(135deg,#111827,#4b5563)" },
  { id: "amber", label: "Amber Stage", preview: "linear-gradient(135deg,#78350f,#fbbf24)" },
  { id: "ice", label: "Ice", preview: "linear-gradient(135deg,#1e3a8a,#bfdbfe)" },
];

type CaptionStyle = "clean" | "bold" | "subtitle" | "karaoke";

const pickMime = () => {
  const opts = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const m of opts) if ((window as any).MediaRecorder?.isTypeSupported?.(m)) return m;
  return "video/webm";
};

const fmtTime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
};

const safeName = (s: string) => s.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 32) || "guest";
const stampStr = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

/** Build a composite MediaStream that mixes every participant's video into a tiled
 *  canvas and every audio track into a single WebAudio mixdown. The returned
 *  object includes a stop() to release rAF/AudioContext/video elements. */
function buildCompositeStream(getParticipants: () => RoomParticipant[]): {
  stream: MediaStream;
  stop: () => void;
} {
  const W = 1280, H = 720;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const videoEls = new Map<string, HTMLVideoElement>();
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const dest = audioCtx.createMediaStreamDestination();
  const audioNodes = new Map<string, MediaStreamAudioSourceNode>();

  const ensureVideoEl = (id: string, track: MediaStreamTrack) => {
    let v = videoEls.get(id);
    if (!v) {
      v = document.createElement("video");
      v.muted = true;
      v.autoplay = true;
      (v as any).playsInline = true;
      videoEls.set(id, v);
    }
    const cur = v.srcObject as MediaStream | null;
    const curId = cur?.getVideoTracks()[0]?.id;
    if (curId !== track.id) {
      v.srcObject = new MediaStream([track]);
      v.play().catch(() => {});
    }
    return v;
  };

  const ensureAudio = (id: string, track: MediaStreamTrack) => {
    if (audioNodes.has(id)) return;
    try {
      const src = audioCtx.createMediaStreamSource(new MediaStream([track]));
      src.connect(dest);
      audioNodes.set(id, src);
    } catch {}
  };

  let raf = 0;
  const draw = () => {
    const ps = getParticipants();
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, W, H);

    // hook up audio for any new participants
    ps.forEach((p) => { if (p.audioTrack) ensureAudio(p.id, p.audioTrack); });

    const n = Math.max(1, ps.length);
    const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const cellW = Math.floor(W / cols);
    const cellH = Math.floor(H / rows);

    ps.forEach((p, i) => {
      const cx = (i % cols) * cellW;
      const cy = Math.floor(i / cols) * cellH;
      ctx.save();
      ctx.fillStyle = "#18181b";
      ctx.fillRect(cx + 4, cy + 4, cellW - 8, cellH - 8);

      if (p.videoTrack && p.camOn) {
        const v = ensureVideoEl(p.id, p.videoTrack);
        if (v.readyState >= 2 && v.videoWidth) {
          // contain
          const vr = v.videoWidth / v.videoHeight;
          const cr = (cellW - 8) / (cellH - 8);
          let dw = cellW - 8, dh = cellH - 8;
          if (vr > cr) dh = dw / vr; else dw = dh * vr;
          const dx = cx + 4 + (cellW - 8 - dw) / 2;
          const dy = cy + 4 + (cellH - 8 - dh) / 2;
          ctx.drawImage(v, dx, dy, dw, dh);
        }
      } else {
        // avatar bubble
        ctx.fillStyle = "#a855f7";
        const r = Math.min(cellW, cellH) * 0.18;
        ctx.beginPath();
        ctx.arc(cx + cellW / 2, cy + cellH / 2, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = `${Math.round(r)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((p.name[0] || "?").toUpperCase(), cx + cellW / 2, cy + cellH / 2);
      }

      // name strip
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(cx + 4, cy + cellH - 28, cellW - 8, 22);
      ctx.fillStyle = "#fff";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(`${p.name}${p.isHost ? " · host" : ""}`, cx + 12, cy + cellH - 17);
      ctx.restore();
    });

    raf = requestAnimationFrame(draw);
  };
  draw();

  const videoStream = (canvas as any).captureStream?.(30) as MediaStream;
  const videoTrack = videoStream.getVideoTracks()[0];
  const audioTrack = dest.stream.getAudioTracks()[0];
  const stream = new MediaStream(audioTrack ? [videoTrack, audioTrack] : [videoTrack]);

  return {
    stream,
    stop: () => {
      cancelAnimationFrame(raf);
      videoEls.forEach((v) => { try { (v.srcObject as MediaStream)?.getTracks().forEach(() => {}); v.srcObject = null; } catch {} });
      videoEls.clear();
      audioNodes.forEach((n) => { try { n.disconnect(); } catch {} });
      audioNodes.clear();
      try { audioCtx.close(); } catch {}
      try { stream.getTracks().forEach((t) => t.stop()); } catch {}
    },
  };
}

const PodcastRoomPage = () => {
  const { sessionId = "session" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isGuest = searchParams.get("guest") === "1";
  const isHost = !isGuest;
  const linkPassword = searchParams.get("k") || "";

  // Resolve display name from auth (fallback to "Guest")
  const [displayName, setDisplayName] = useState<string>("Guest");
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (u) {
        const n = (u.user_metadata as any)?.display_name
          || (u.user_metadata as any)?.full_name
          || u.email?.split("@")[0]
          || "Guest";
        setDisplayName(n);
      }
    })();
  }, []);

  const [tab, setTab] = useState<Tab>("people");
  const [permError, setPermError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Scheduled session metadata (if any)
  const [scheduled, setScheduled] = useState<ScheduledPodcastSession | undefined>(() => PodcastSessionStore.get(sessionId));
  const [gateTick, setGateTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setScheduled(PodcastSessionStore.get(sessionId));
      setGateTick((x) => x + 1);
    }, 15_000);
    return () => window.clearInterval(id);
  }, [sessionId]);
  const joinGate = useMemo(() => evaluateJoinGate(scheduled), [scheduled, gateTick]);

  // Host: mark this session live when they enter (unless ended/cancelled).
  useEffect(() => {
    if (!isHost || !scheduled) return;
    if (scheduled.status === "upcoming" || scheduled.status === "live") {
      PodcastSessionStore.markLive(scheduled.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, scheduled?.id]);

  // Layout / captions / background sheet state (local to this device, per session)
  const [layoutSheetOpen, setLayoutSheetOpen] = useState(false);
  const [activeLayout, setActiveLayout] = useState<string>(() => {
    try { return localStorage.getItem(`pod-layout:${sessionId}`) || "auto"; } catch { return "auto"; }
  });
  const [captionsOn, setCaptionsOn] = useState<boolean>(() => {
    try { return localStorage.getItem(`pod-cc:${sessionId}`) === "1"; } catch { return false; }
  });
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(() => {
    try { return (localStorage.getItem(`pod-cc-style:${sessionId}`) as CaptionStyle) || "clean"; } catch { return "clean"; }
  });
  const [bg, setBg] = useState<PodcastBg>(() => PodcastBackgrounds.getSelection(sessionId));
  useEffect(() => { try { localStorage.setItem(`pod-layout:${sessionId}`, activeLayout); } catch {} }, [sessionId, activeLayout]);
  useEffect(() => { try { localStorage.setItem(`pod-cc:${sessionId}`, captionsOn ? "1" : "0"); } catch {} }, [sessionId, captionsOn]);
  useEffect(() => { try { localStorage.setItem(`pod-cc-style:${sessionId}`, captionStyle); } catch {} }, [sessionId, captionStyle]);
  useEffect(() => { PodcastBackgrounds.setSelection(sessionId, bg); }, [sessionId, bg]);

  // Live captions via Web Speech API (best-effort, where supported)
  const [liveCaption, setLiveCaption] = useState<string>("");
  useEffect(() => {
    if (!captionsOn) { setLiveCaption(""); return; }
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setLiveCaption("(Live captions not supported in this browser)"); return; }
    let rec: any;
    try {
      rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = navigator.language || "en-US";
      rec.onresult = (e: any) => {
        let s = "";
        for (let i = e.resultIndex; i < e.results.length; i++) s += e.results[i][0].transcript;
        setLiveCaption(s.slice(-200));
      };
      rec.onerror = () => {};
      rec.onend = () => { try { if (captionsOn) rec.start(); } catch {} };
      rec.start();
    } catch {}
    return () => { try { rec?.stop(); } catch {} };
  }, [captionsOn]);

  // Host-controlled session security (persisted per session, host's device)
  const SEC_KEY = `wstudio-podcast-security:${sessionId}`;
  const [security, setSecurity] = useState<PodcastSecurity>(() => {
    if (!isHost) return { visibility: "public", password: "" };
    try {
      const raw = localStorage.getItem(SEC_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { visibility: "public", password: "" };
  });
  useEffect(() => {
    if (isHost) {
      try { localStorage.setItem(SEC_KEY, JSON.stringify(security)); } catch {}
    }
  }, [isHost, SEC_KEY, security]);

  // Doorman: realtime waiting-room gate (does not touch LiveKit/recording).
  const doorman = usePodcastDoorman({
    sessionId,
    isHost,
    displayName,
    security: isHost ? security : undefined,
  });

  // Guest auto-request when policy known
  const [pwdPrompt, setPwdPrompt] = useState("");
  useEffect(() => {
    if (isHost) return;
    if (doorman.status !== "idle") return;
    // Don't request join until the scheduled window is open
    if (joinGate.kind !== "open" && joinGate.kind !== "live" && joinGate.kind !== "unscheduled") return;
    if (doorman.policy.requiresPassword) {
      if (linkPassword) {
        doorman.requestJoin(linkPassword);
      }
      // else: waiting room UI will collect password
    } else {
      doorman.requestJoin();
    }
  }, [isHost, doorman, linkPassword, joinGate.kind]);

  // LiveKit room — only enabled after doorman accepts.
  const room = usePodcastLiveRoom({
    roomName: sessionId,
    displayName,
    enabled: doorman.status === "accepted",
  });

  useEffect(() => {
    if (room.connState === "error") setPermError(room.error || "Could not join podcast room");
    else setPermError(null);
  }, [room.connState, room.error]);

  // recording (host only, composite stream of every participant)
  const recorderRef = useRef<MediaRecorder | null>(null);
  const handleRef = useRef<Awaited<ReturnType<typeof PodcastRecovery.create>> | null>(null);
  const compositeRef = useRef<ReturnType<typeof buildCompositeStream> | null>(null);
  const chunkIndexRef = useRef(0);
  const startedAtRef = useRef<number>(0);
  const pausedAccumRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordings, setRecordings] = useState<LocalRecording[]>([]);
  const [editing, setEditing] = useState<LocalRecording | null>(null);

  // Live ref to participants so the rAF draw loop always has the current set.
  const participantsRef = useRef<RoomParticipant[]>([]);
  useEffect(() => { participantsRef.current = room.participants; }, [room.participants]);

  // chat (in-memory; realtime sync is Phase 2B)
  const [chat, setChat] = useState<{ id: string; from: string; text: string; ts: number }[]>([]);
  const [chatInput, setChatInput] = useState("");

  // recovery prompt
  const [recoverList, setRecoverList] = useState<RecoverySessionRow[]>([]);
  useEffect(() => {
    PodcastRecovery.listUnfinished().then((rows) => setRecoverList(rows.filter((r) => r.sessionId === sessionId)));
  }, [sessionId]);

  /* ---------------- Timer ---------------- */
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => {
      if (isPaused) return;
      setElapsed(Date.now() - startedAtRef.current - pausedAccumRef.current);
    }, 250);
    return () => clearInterval(id);
  }, [isRecording, isPaused]);

  /* ---------------- Save final to project (IDB) ---------------- */
  const saveFinalToProject = useCallback(async (item: LocalRecording) => {
    const title = scheduled?.title || `Podcast Session ${new Date(item.createdAt).toLocaleDateString()}`;
    try {
      await PodcastFinals.save({
        id: item.id,
        sessionId,
        title,
        name: item.name,
        mime: item.mime,
        ext: item.name.split(".").pop() || "webm",
        blob: item.blob,
        createdAt: item.createdAt,
        durationMs: item.durationMs,
        hostName: displayName,
      });
    } catch (e) {
      console.error("Failed to save final podcast recording", e);
    }
  }, [scheduled, sessionId, displayName]);

  /* ---------------- Recording (HOST ONLY) ---------------- */
  const startRecording = async () => {
    if (!isHost) {
      toast({ title: "Only the host can record", description: "The host records the full session for everyone." });
      return;
    }
    if (room.connState !== "connected") {
      toast({ title: "Not connected yet", description: "Wait until you're connected to the room." });
      return;
    }
    try {
      const mime = pickMime();
      const ext = mime.includes("mp4") ? "mp4" : "webm";
      const handle = await PodcastRecovery.create({
        sessionId, participantName: displayName, mime, ext,
      });
      handleRef.current = handle;
      chunkIndexRef.current = 0;

      // Build composite (tiled video + mixed audio of every participant).
      const composite = buildCompositeStream(() => participantsRef.current);
      compositeRef.current = composite;

      const rec = new MediaRecorder(composite.stream, { mimeType: mime, videoBitsPerSecond: 3_500_000 });
      rec.ondataavailable = async (e) => {
        if (!e.data?.size) return;
        try { await handle.appendChunk(e.data, chunkIndexRef.current++); }
        catch (err) { console.error("idb chunk save failed", err); }
      };
      rec.onerror = () => toast({ title: "Recording failed" });
      rec.onstop = async () => {
        try {
          const assembled = await PodcastRecovery.assembleBlob(handle.dbId);
          compositeRef.current?.stop();
          compositeRef.current = null;
          if (!assembled || !assembled.blob.size) {
            toast({ title: "No recording captured" });
            await handle.discard();
            return;
          }
          const dur = Date.now() - startedAtRef.current - pausedAccumRef.current;
          const url = URL.createObjectURL(assembled.blob);
          const showTitle = scheduled?.title?.trim() || "Podcast";
          const name = `${safeName(showTitle)}-${stampStr()}.${ext}`;
          const item: LocalRecording = {
            id: `pf-${handle.dbId}-${Date.now()}`,
            name, blob: assembled.blob, url, mime,
            createdAt: Date.now(), durationMs: dur,
            trimStart: 0, trimEnd: dur,
          };
          setRecordings((rs) => [item, ...rs]);
          setTab("files");
          await handle.finalize();
          await saveFinalToProject(item);
          toast({ title: "Saved to Project", description: name });
        } catch (err: any) {
          toast({ title: "Save failed", description: err?.message });
        }
      };

      startedAtRef.current = Date.now();
      pausedAccumRef.current = 0;
      rec.start(10_000);
      recorderRef.current = rec;
      setIsRecording(true);
      setIsPaused(false);
      setElapsed(0);
      toast({ title: "Recording started", description: "Capturing host + all guests. Auto-saving every 10s." });
    } catch (e: any) {
      compositeRef.current?.stop();
      compositeRef.current = null;
      toast({ title: "Could not start recording", description: e?.message });
    }
  };

  const stopRecording = () => {
    const r = recorderRef.current;
    if (!r) return;
    if (r.state !== "inactive") r.stop();
    setIsRecording(false);
    setIsPaused(false);
    recorderRef.current = null;
  };

  const togglePause = () => {
    const r = recorderRef.current;
    if (!r) return;
    if (r.state === "recording") {
      r.pause();
      pausedAtRef.current = Date.now();
      setIsPaused(true);
    } else if (r.state === "paused") {
      pausedAccumRef.current += Date.now() - pausedAtRef.current;
      r.resume();
      setIsPaused(false);
    }
  };

  /* ---------------- Recovery ---------------- */
  const recoverOne = async (row: RecoverySessionRow) => {
    const res = await PodcastRecovery.assembleBlob(row.id);
    if (!res || !res.blob.size) {
      toast({ title: "Nothing to recover" });
      await PodcastRecovery.discard(row.id);
      setRecoverList((l) => l.filter((x) => x.id !== row.id));
      return;
    }
    const url = URL.createObjectURL(res.blob);
    const name = `wstudio-${safeName(row.sessionId)}-${safeName(row.participantName)}-recovered-${stampStr()}.${row.ext}`;
    const dur = Math.max(0, row.lastUpdated - row.startedAt);
    setRecordings((rs) => [{
      id: `rec-${row.id}`,
      name, blob: res.blob, url, mime: row.mime,
      createdAt: Date.now(), durationMs: dur, trimStart: 0, trimEnd: dur, recovered: true,
    }, ...rs]);
    await PodcastRecovery.discard(row.id);
    setRecoverList((l) => l.filter((x) => x.id !== row.id));
    setTab("files");
    toast({ title: "Recording recovered", description: name });
  };
  const discardRecover = async (row: RecoverySessionRow) => {
    await PodcastRecovery.discard(row.id);
    setRecoverList((l) => l.filter((x) => x.id !== row.id));
  };

  /* ---------------- Controls ---------------- */
  const me = room.local;
  const toggleMic = () => room.setMic(!(me?.micOn ?? false));
  const toggleCam = () => room.setCam(!(me?.camOn ?? false));
  const [screenOn, setScreenOn] = useState(false);
  const toggleScreen = async () => {
    try { await room.setScreen(!screenOn); setScreenOn(!screenOn); }
    catch (e: any) { toast({ title: "Screen share failed", description: e?.message }); }
  };

  const leave = () => {
    if (isRecording) stopRecording();
    if (isHost) {
      const isScheduled = scheduled && scheduled.status !== "cancelled";
      const msg = isScheduled
        ? "End the podcast session for everyone? This will disconnect all guests."
        : "End the podcast for everyone? This will disconnect all guests.";
      if (confirm(msg)) {
        if (isScheduled) PodcastSessionStore.markEnded(scheduled!.id);
        // Tell all guests to disconnect — kills their cam/mic on next render.
        try { doorman.endSession("Host ended the session"); } catch {}
      } else {
        return; // host cancelled
      }
    }
    // Stop local cam/mic immediately for everyone leaving.
    try { room.setCam(false); } catch {}
    try { room.setMic(false); } catch {}
    room.disconnect();
    navigate("/tv/podcast");
  };

  // Guest: if host ended, force-disconnect cam/mic and bounce back.
  useEffect(() => {
    if (isHost) return;
    if (doorman.status !== "ended") return;
    if (isRecording) stopRecording();
    try { room.setCam(false); } catch {}
    try { room.setMic(false); } catch {}
    room.disconnect();
    toast({ title: "Session ended", description: doorman.rejectReason || "The host ended the podcast." });
    const t = window.setTimeout(() => navigate("/tv/podcast"), 1800);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, doorman.status]);

  // Guest: host force-mute
  useEffect(() => {
    if (isHost) return;
    if (!doorman.forceMuteTick) return;
    try { room.setMic(false); } catch {}
    toast({ title: "You were muted by the host" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doorman.forceMuteTick]);

  const openInvite = () => setInviteOpen(true);

  /* ---------------- Files actions ---------------- */
  const downloadRec = (r: LocalRecording) => {
    const a = document.createElement("a");
    a.href = r.url; a.download = r.name;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const deleteRec = (r: LocalRecording) => {
    URL.revokeObjectURL(r.url);
    setRecordings((rs) => rs.filter((x) => x.id !== r.id));
    if (editing?.id === r.id) setEditing(null);
  };
  const renameRec = (r: LocalRecording) => {
    const name = prompt("New name", r.name);
    if (!name) return;
    setRecordings((rs) => rs.map((x) => (x.id === r.id ? { ...x, name } : x)));
  };
  const sendChat = () => {
    const t = chatInput.trim(); if (!t) return;
    setChat((c) => [...c, { id: `${Date.now()}`, from: displayName, text: t, ts: Date.now() }]);
    setChatInput("");
  };

  /* ---------------- Render ---------------- */
  const visible = useMemo(() => room.participants.slice(0, 6), [room.participants]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="flex items-center justify-between gap-3 px-3 md:px-5 h-14 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate("/tv/podcast")}
            className="p-1.5 rounded hover:bg-zinc-800"
            title="Back to Podcast Home (session keeps running until you press Leave)"
            aria-label="Back to Podcast Home"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-300" />
          </button>
          <div className="text-sm font-semibold tracking-wider text-purple-300">W.STUDIO <span className="text-teal-300">PODCAST</span></div>
          <span className="hidden md:inline text-xs text-zinc-500">Room</span>
          <code className="hidden md:inline text-xs px-2 py-1 rounded bg-zinc-900 border border-zinc-800">{sessionId}</code>
          <ConnBadge state={room.connState} count={room.participants.length} />
        </div>
        <div className="flex items-center gap-2">
          {isRecording && (
            <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              REC {fmtTime(elapsed)}
            </span>
          )}
          <Button size="sm" variant="secondary" onClick={openInvite} className="gap-1.5">
            <Share2 className="w-3.5 h-3.5" /> Invite
          </Button>
          <button
            onClick={() => navigate("/settings")}
            className="p-1.5 rounded hover:bg-zinc-800"
            title="App settings"
            aria-label="App settings"
          >
            <SettingsIcon className="w-4 h-4 text-zinc-300" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <main
          className="flex-1 min-w-0 p-3 md:p-5 flex flex-col gap-4 relative"
          style={bgEffect !== "none" ? { background: BACKGROUNDS.find((b) => b.id === bgEffect)?.preview } : undefined}
        >
          {permError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-200">
              <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{permError}</div>
            </div>
          )}

          {recoverList.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-100">
              <div className="flex items-center gap-2 mb-2 font-medium">
                <RotateCcw className="w-4 h-4" /> Recover previous podcast recording?
              </div>
              <ul className="space-y-1.5">
                {recoverList.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">{r.participantName} · started {new Date(r.startedAt).toLocaleString()}</span>
                    <span className="flex gap-1.5 shrink-0">
                      <Button size="sm" variant="secondary" onClick={() => recoverOne(r)}>Recover</Button>
                      <Button size="sm" variant="ghost" onClick={() => discardRecover(r)}>Discard</Button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <PodcastVideoGrid participants={visible} isRecording={isRecording} localId={me?.id} layout={activeLayout} />

          {captionsOn && liveCaption && (
            <div className={`pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-4 max-w-[80%] text-center ${
              captionStyle === "bold" ? "text-2xl md:text-3xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
              : captionStyle === "subtitle" ? "text-base md:text-lg text-white bg-black/70 px-3 py-1 rounded"
              : captionStyle === "karaoke" ? "text-xl md:text-2xl font-semibold text-yellow-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
              : "text-base md:text-lg text-white bg-black/50 px-3 py-1 rounded"
            }`}>
              {liveCaption}
            </div>
          )}

          {editing && (
            <PodcastEditorPro
              initial={{ id: editing.id, name: editing.name, url: editing.url, blob: editing.blob, durationMs: editing.durationMs }}
              onClose={() => setEditing(null)}
              onSaveToProject={async (blob, mime, ext) => {
                const title = scheduled?.title?.trim() || "Podcast";
                const id = `pf-edit-${Date.now()}`;
                const name = `${safeName(title)}-edited-${stampStr()}.${ext}`;
                await PodcastFinals.save({
                  id, sessionId, title, name, mime, ext, blob,
                  createdAt: Date.now(),
                  durationMs: editing.durationMs,
                  edited: true,
                  hostName: displayName,
                });
                const url = URL.createObjectURL(blob);
                setRecordings((rs) => [{
                  id, name, blob, url, mime,
                  createdAt: Date.now(),
                  durationMs: editing.durationMs,
                  trimStart: 0, trimEnd: editing.durationMs,
                }, ...rs]);
              }}
            />
          )}
        </main>

        <PodcastSidebar
          tab={tab} setTab={setTab}
          participants={visible}
          chat={chat} chatInput={chatInput} setChatInput={setChatInput} sendChat={sendChat}
          recordings={recordings}
          onDownload={downloadRec}
          onDelete={deleteRec}
          onRename={renameRec}
          onEdit={(r: LocalRecording) => setEditing(r)}
          isHost={isHost}
          onMuteParticipant={(name: string) => { doorman.forceMute(name); toast({ title: `Muted ${name}` }); }}
          onKickParticipant={(name: string) => {
            if (!confirm(`Remove ${name} from the podcast?`)) return;
            doorman.kick(name, "Removed by host");
            toast({ title: `Removed ${name}` });
          }}
        />

      </div>

      <PodcastControlBar
        isRecording={isRecording}
        isPaused={isPaused}
        micOn={me?.micOn ?? false}
        camOn={me?.camOn ?? false}
        screenOn={screenOn}
        canRecord={isHost && room.connState === "connected"}
        isHost={isHost}
        onStart={startRecording}
        onStop={stopRecording}
        onPause={togglePause}
        onMic={toggleMic}
        onCam={toggleCam}
        onScreen={toggleScreen}
        onLeave={leave}
        onLayout={() => setLayoutSheetOpen(true)}
      />

      {layoutSheetOpen && (
        <LayoutSheet
          onClose={() => setLayoutSheetOpen(false)}
          activeLayout={activeLayout}
          setActiveLayout={setActiveLayout}
          captionsOn={captionsOn}
          setCaptionsOn={setCaptionsOn}
          captionStyle={captionStyle}
          setCaptionStyle={setCaptionStyle}
          bgEffect={bgEffect}
          setBgEffect={setBgEffect}
        />
      )}

      <PodcastInviteSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        sessionId={sessionId}
        isHost={isHost}
        security={security}
        onSecurityChange={setSecurity}
      />

      {/* Host: pending join requests */}
      {isHost && doorman.pending.length > 0 && (
        <div className="fixed top-16 right-3 z-50 w-80 max-w-[calc(100vw-1.5rem)] space-y-2">
          {doorman.pending.map((req) => (
            <div key={req.reqId} className="rounded-xl bg-zinc-900 border border-purple-500/50 shadow-xl shadow-purple-900/30 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-wider text-purple-300 mb-0.5 flex items-center gap-1"><Shield className="w-3 h-3" /> Waiting room</div>
                  <div className="text-sm font-medium truncate">{req.name} wants to join</div>
                  {security.visibility === "password" && (
                    <div className={`text-[11px] mt-0.5 ${doorman.validatePassword(req.password) ? "text-emerald-400" : "text-red-400"}`}>
                      {doorman.validatePassword(req.password) ? "Password OK" : "Wrong password"}
                    </div>
                  )}
                </div>
                <button onClick={() => doorman.reject(req.reqId)} className="p-1 rounded hover:bg-zinc-800" aria-label="Dismiss">
                  <X className="w-3.5 h-3.5 text-zinc-400" />
                </button>
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                  disabled={security.visibility === "password" && !doorman.validatePassword(req.password)}
                  onClick={() => doorman.accept(req.reqId)}
                >Accept</Button>
                <Button size="sm" variant="destructive" className="flex-1" onClick={() => doorman.reject(req.reqId, "Declined by host")}>Reject</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Guest: scheduled-time gate */}
      {!isHost && (joinGate.kind === "too-early" || joinGate.kind === "ended" || joinGate.kind === "cancelled") && (
        <ScheduledGateOverlay
          gate={joinGate}
          session={scheduled!}
          onLeave={() => navigate("/tv/podcast")}
        />
      )}

      {/* Guest: waiting room overlay (only once join window is open) */}
      {!isHost && (joinGate.kind === "open" || joinGate.kind === "live" || joinGate.kind === "unscheduled") && doorman.status !== "accepted" && (
        <GuestWaitingOverlay
          status={doorman.status}
          policy={doorman.policy}
          rejectReason={doorman.rejectReason}
          name={displayName}
          pwdValue={pwdPrompt}
          onPwdChange={setPwdPrompt}
          onSubmitPwd={() => doorman.requestJoin(pwdPrompt)}
          onLeave={() => navigate("/tv/podcast")}
        />
      )}
    </div>
  );
};

const GuestWaitingOverlay = ({
  status, policy, rejectReason, name, pwdValue, onPwdChange, onSubmitPwd, onLeave,
}: {
  status: string;
  policy: { visibility: string; requiresPassword: boolean };
  rejectReason: string | null;
  name: string;
  pwdValue: string;
  onPwdChange: (v: string) => void;
  onSubmitPwd: () => void;
  onLeave: () => void;
}) => (
  <div className="fixed inset-0 z-[80] bg-zinc-950/95 backdrop-blur grid place-items-center p-4">
    <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
      <div className="w-14 h-14 rounded-full bg-purple-500/15 border border-purple-500/30 grid place-items-center mx-auto mb-3">
        <Shield className="w-6 h-6 text-purple-300" />
      </div>
      {status === "ended" ? (
        <>
          <h2 className="text-lg font-semibold mb-1">Session ended</h2>
          <p className="text-sm text-zinc-400 mb-4">{rejectReason || "The host ended the podcast."}</p>
          <Button variant="secondary" onClick={onLeave} className="w-full">Back to Podcast Home</Button>
        </>
      ) : status === "rejected" ? (
        <>
          <h2 className="text-lg font-semibold mb-1">Entry declined</h2>
          <p className="text-sm text-zinc-400 mb-4">{rejectReason || "The host did not accept your request."}</p>
          <Button variant="secondary" onClick={onLeave} className="w-full">Back to Podcast Home</Button>
        </>
      ) : policy.requiresPassword && status === "idle" ? (
        <>
          <h2 className="text-lg font-semibold mb-1">Password required</h2>
          <p className="text-sm text-zinc-400 mb-4">This room is password protected.</p>
          <Input
            type="password"
            value={pwdValue}
            onChange={(e) => onPwdChange(e.target.value)}
            placeholder="Enter room password"
            className="bg-zinc-950 border-zinc-700 mb-3"
            onKeyDown={(e) => { if (e.key === "Enter") onSubmitPwd(); }}
          />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onLeave} className="flex-1">Cancel</Button>
            <Button onClick={onSubmitPwd} disabled={!pwdValue} className="flex-1">Request to join</Button>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold mb-1">Waiting for host…</h2>
          <p className="text-sm text-zinc-400 mb-4">
            Hi {name}, your request was sent. The host will let you in shortly.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-purple-300 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse [animation-delay:300ms]" />
          </div>
          <Button variant="secondary" onClick={onLeave} className="w-full">Cancel</Button>
        </>
      )}
    </div>
  </div>
);

/* ===================== Subcomponents ===================== */

const ConnBadge = ({ state, count }: { state: string; count: number }) => {
  const map: Record<string, { dot: string; label: string }> = {
    idle: { dot: "bg-zinc-500", label: "Idle" },
    connecting: { dot: "bg-amber-400 animate-pulse", label: "Connecting" },
    connected: { dot: "bg-emerald-400", label: `Live · ${count}` },
    error: { dot: "bg-red-500", label: "Error" },
    disconnected: { dot: "bg-zinc-500", label: "Disconnected" },
  };
  const m = map[state] ?? map.idle;
  return (
    <span className="hidden sm:flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border border-zinc-800 bg-zinc-900">
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} /> {m.label}
    </span>
  );
};

const PodcastVideoGrid = ({
  participants, isRecording, localId, layout = "auto",
}: { participants: RoomParticipant[]; isRecording: boolean; localId?: string; layout?: string }) => {
  const count = participants.length || 1;
  let cols = "grid-cols-1";
  if (layout === "split") cols = "grid-cols-1 md:grid-cols-2";
  else if (layout === "3up") cols = "grid-cols-1 md:grid-cols-3";
  else if (layout === "speaker" || layout === "pip" || layout === "screen") cols = "grid-cols-1";
  else {
    cols = count <= 1 ? "grid-cols-1"
      : count <= 2 ? "grid-cols-1 md:grid-cols-2"
      : count <= 4 ? "grid-cols-2"
      : "grid-cols-2 md:grid-cols-3";
  }
  if (participants.length === 0) {
    return <div className="rounded-xl bg-zinc-900 border border-zinc-800 aspect-video grid place-items-center text-sm text-zinc-500">Connecting to room…</div>;
  }
  if (layout === "speaker" || layout === "screen") {
    const [main, ...rest] = participants;
    return (
      <div className="flex flex-col gap-3 flex-1 min-h-[300px]">
        <div className="flex-1"><ParticipantTile p={main} isRecording={isRecording && main.id === localId} /></div>
        {rest.length > 0 && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 h-24">
            {rest.map((p) => <ParticipantTile key={p.id} p={p} isRecording={isRecording && p.id === localId} />)}
          </div>
        )}
      </div>
    );
  }
  if (layout === "pip") {
    const [main, ...rest] = participants;
    return (
      <div className="relative flex-1 min-h-[300px]">
        <ParticipantTile p={main} isRecording={isRecording && main.id === localId} />
        {rest[0] && (
          <div className="absolute right-3 bottom-3 w-40 md:w-56 aspect-video rounded-lg overflow-hidden border-2 border-zinc-700 shadow-xl">
            <ParticipantTile p={rest[0]} isRecording={isRecording && rest[0].id === localId} />
          </div>
        )}
      </div>
    );
  }
  return (
    <div className={`grid ${cols} gap-3 flex-1 min-h-[300px]`}>
      {participants.map((p) => (
        <ParticipantTile key={p.id} p={p} isRecording={isRecording && p.id === localId} />
      ))}
    </div>
  );
};

const QUALITY_STYLE: Record<RoomParticipant["quality"], { color: string; label: string }> = {
  excellent: { color: "text-emerald-400", label: "Excellent" },
  good: { color: "text-teal-300", label: "Good" },
  weak: { color: "text-amber-400", label: "Weak" },
  poor: { color: "text-red-400", label: "Poor" },
  unknown: { color: "text-zinc-400", label: "—" },
};

const ParticipantTile = ({ p, isRecording }: { p: RoomParticipant; isRecording: boolean }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = p.videoTrack ? new MediaStream([p.videoTrack]) : null;
    }
  }, [p.videoTrack]);
  useEffect(() => {
    // Don't render local audio (would feedback).
    if (audioRef.current) {
      audioRef.current.srcObject = (!p.isLocal && p.audioTrack) ? new MediaStream([p.audioTrack]) : null;
    }
  }, [p.audioTrack, p.isLocal]);

  const q = QUALITY_STYLE[p.quality];

  return (
    <div className="relative rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 aspect-video">
      {p.videoTrack && p.camOn ? (
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-teal-400 grid place-items-center text-xl font-bold">
            {p.name[0]?.toUpperCase()}
          </div>
        </div>
      )}
      <audio ref={audioRef} autoPlay />

      <div className="absolute top-2 left-2 flex items-center gap-1.5">
        <span className="text-xs px-1.5 py-0.5 rounded bg-black/60 border border-white/10">{p.name}{p.isLocal ? " (you)" : ""}</span>
        {p.isHost && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/80">host</span>}
      </div>

      <div className="absolute top-2 right-2 flex items-center gap-1">
        <span className={`text-[10px] px-1.5 py-0.5 rounded bg-black/60 border border-white/10 flex items-center gap-1 ${q.color}`} title={`Connection: ${q.label}`}>
          <Wifi className="w-3 h-3" /> {q.label}
        </span>
        {!p.micOn && <span className="p-1 rounded bg-red-500/80"><MicOff className="w-3 h-3" /></span>}
        {!p.camOn && <span className="p-1 rounded bg-red-500/80"><VideoOff className="w-3 h-3" /></span>}
        {isRecording && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/80 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />REC</span>}
      </div>

      {p.micOn && (
        <div className="absolute bottom-2 left-2 right-2 h-1.5 rounded-full bg-black/40 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-teal-400 to-purple-500 transition-[width] duration-75"
               style={{ width: `${Math.min(100, Math.round(p.level * 140))}%` }} />
        </div>
      )}
    </div>
  );
};

const PodcastControlBar = ({
  isRecording, isPaused, micOn, camOn, screenOn, canRecord, isHost,
  onStart, onStop, onPause, onMic, onCam, onScreen, onLeave, onLayout,
}: any) => (
  <footer className="sticky bottom-0 z-30 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur px-3 py-3">
    <div className="flex items-center justify-center gap-2 md:gap-3 flex-wrap">
      <CtrlBtn onClick={onMic} active={!micOn} label={micOn ? "Mute" : "Unmute"}>
        {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
      </CtrlBtn>
      <CtrlBtn onClick={onCam} active={!camOn} label={camOn ? "Camera off" : "Camera on"}>
        {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
      </CtrlBtn>
      <CtrlBtn onClick={onScreen} active={screenOn} label="Share">
        <MonitorUp className="w-5 h-5" />
      </CtrlBtn>

      {isHost ? (
        !isRecording ? (
          <button
            onClick={onStart}
            disabled={!canRecord}
            title="Start recording (host)"
            aria-label="Start recording"
            className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed grid place-items-center shadow-lg shadow-red-600/30"
          >
            <Circle className="w-3.5 h-3.5 fill-white text-white" />
          </button>
        ) : (
          <>
            <button onClick={onPause} title={isPaused ? "Resume" : "Pause"} aria-label="Pause recording" className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 grid place-items-center">
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
            <button onClick={onStop} title="Stop recording" aria-label="Stop recording" className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 grid place-items-center shadow-lg shadow-red-600/30">
              <Square className="w-3.5 h-3.5 fill-white text-white" />
            </button>
          </>
        )
      ) : (
        <button
          disabled
          title="Only the host can record"
          aria-label="Recording is host-only"
          className="w-10 h-10 rounded-full bg-zinc-800/60 border border-zinc-700 grid place-items-center opacity-50 cursor-not-allowed"
        >
          <Circle className="w-3.5 h-3.5 text-zinc-500" />
        </button>
      )}

      <CtrlBtn onClick={onLayout} label="Layout, captions & background">
        <LayoutGrid className="w-5 h-5" />
      </CtrlBtn>

      <button
        onClick={onLeave}
        title="Leave podcast"
        aria-label="Leave podcast"
        className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 grid place-items-center text-white shadow-lg shadow-red-600/30"
      >
        <PhoneOff className="w-4 h-4" />
      </button>
    </div>
  </footer>
);

const CtrlBtn = ({ children, onClick, active, label, className = "" }: any) => (
  <button onClick={onClick} title={label} aria-label={label} className={`w-12 h-12 rounded-full grid place-items-center border ${active ? "bg-purple-500/20 border-purple-500 text-purple-200" : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800"} ${className}`}>
    {children}
  </button>
);

const PodcastSidebar = ({
  tab, setTab, participants, chat, chatInput, setChatInput, sendChat,
  recordings, onDownload, onDelete, onRename, onEdit,
  isHost, onMuteParticipant, onKickParticipant,
}: any) => (
  <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-zinc-800 bg-zinc-950 flex flex-col max-h-[40vh] lg:max-h-none">
    <nav className="flex border-b border-zinc-800">
      <TabBtn active={tab === "people"} onClick={() => setTab("people")}><Users className="w-4 h-4" /> People</TabBtn>
      <TabBtn active={tab === "chat"} onClick={() => setTab("chat")}><MessageSquare className="w-4 h-4" /> Chat</TabBtn>
      <TabBtn active={tab === "files"} onClick={() => setTab("files")}><FolderDown className="w-4 h-4" /> W.Tools</TabBtn>
    </nav>
    <div className="flex-1 overflow-y-auto p-3">
      {tab === "people" && (
        <ul className="space-y-2">
          {participants.map((p: RoomParticipant) => (
            <li key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-teal-400 grid place-items-center text-xs font-bold shrink-0">{p.name[0]?.toUpperCase()}</div>
                <div className="min-w-0">
                  <div className="text-sm truncate">{p.name}{p.isLocal ? " (you)" : ""}</div>
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">{p.isHost ? "host" : "guest"} · <span className={QUALITY_STYLE[p.quality].color}>{QUALITY_STYLE[p.quality].label}</span></div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs shrink-0">
                {p.micOn ? <Mic className="w-3.5 h-3.5 text-teal-300" /> : <MicOff className="w-3.5 h-3.5 text-red-400" />}
                {p.camOn ? <Video className="w-3.5 h-3.5 text-teal-300" /> : <VideoOff className="w-3.5 h-3.5 text-red-400" />}
                {isHost && !p.isLocal && (
                  <>
                    <button
                      onClick={() => onMuteParticipant?.(p.name)}
                      disabled={!p.micOn}
                      title="Mute this participant"
                      aria-label={`Mute ${p.name}`}
                      className="ml-1 p-1 rounded hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-amber-300"
                    >
                      <MicOff className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onKickParticipant?.(p.name)}
                      title="Remove from podcast"
                      aria-label={`Remove ${p.name}`}
                      className="p-1 rounded hover:bg-red-500/20 text-red-400"
                    >
                      <PhoneOff className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {tab === "chat" && (
        <div className="flex flex-col h-full">
          <div className="flex-1 space-y-2 overflow-y-auto">
            {chat.length === 0 && <p className="text-xs text-zinc-500">No messages yet.</p>}
            {chat.map((m: any) => (
              <div key={m.id} className="text-sm"><span className="text-purple-300 font-medium">{m.from}: </span>{m.text}</div>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); sendChat(); }} className="mt-2 flex gap-2">
            <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Message..." className="bg-zinc-900 border-zinc-800" />
            <Button type="submit" size="sm">Send</Button>
          </form>
        </div>
      )}
      {tab === "files" && (
        <WToolsPanel recordings={recordings} onDownload={onDownload} onDelete={onDelete} onRename={onRename} onEdit={onEdit} />
      )}
    </div>
  </aside>
);

const TabBtn = ({ children, active, onClick }: any) => (
  <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs border-b-2 ${active ? "border-purple-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
    {children}
  </button>
);

const RecordingFilesPanel = ({ recordings, onDownload, onDelete, onRename, onEdit }: any) => {
  if (!recordings.length) return <p className="text-xs text-zinc-500">No local recordings yet. Hit Record to capture your own track.</p>;
  return (
    <ul className="space-y-2">
      {recordings.map((r: LocalRecording) => (
        <li key={r.id} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
          <div className="text-xs font-medium truncate">{r.name}{r.recovered && <span className="ml-1 text-amber-300">· recovered</span>}</div>
          <div className="text-[10px] text-zinc-500 mb-2">{fmtTime(r.durationMs)} · {(r.blob.size / 1024 / 1024).toFixed(1)} MB</div>
          <video src={r.url} controls className="w-full rounded bg-black mb-2" />
          <div className="grid grid-cols-2 gap-1">
            <Button size="sm" variant="secondary" onClick={() => onDownload(r)} className="gap-1"><Download className="w-3 h-3" />Download</Button>
            <Button size="sm" variant="secondary" onClick={() => onEdit(r)} className="gap-1"><Edit3 className="w-3 h-3" />Edit</Button>
            <Button size="sm" variant="secondary" onClick={() => onRename(r)} className="gap-1"><Check className="w-3 h-3" />Rename</Button>
            <Button size="sm" variant="destructive" onClick={() => onDelete(r)} className="gap-1"><Trash2 className="w-3 h-3" />Delete</Button>
          </div>
        </li>
      ))}
    </ul>
  );
};

const ScheduledGateOverlay = ({
  gate, session, onLeave,
}: {
  gate: ReturnType<typeof evaluateJoinGate>;
  session: ScheduledPodcastSession;
  onLeave: () => void;
}) => {
  const title =
    gate.kind === "too-early" ? "This podcast has not started yet"
    : gate.kind === "ended" ? "This podcast has ended"
    : gate.kind === "cancelled" ? "This podcast was cancelled"
    : "Not available";
  const body =
    gate.kind === "too-early" ? `Doors open 15 minutes before the start time. Starts ${new Date(session.scheduledAt).toLocaleString()}.`
    : gate.kind === "ended" ? "The host has ended the session."
    : gate.kind === "cancelled" ? "The host cancelled this session."
    : "";
  return (
    <div className="fixed inset-0 z-[85] bg-zinc-950/95 backdrop-blur grid place-items-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-purple-500/15 border border-purple-500/30 grid place-items-center mx-auto mb-3">
          <Shield className="w-6 h-6 text-purple-300" />
        </div>
        <h2 className="text-lg font-semibold mb-1">{title}</h2>
        <p className="text-sm text-zinc-400 mb-4">{body}</p>
        <div className="text-xs uppercase tracking-wider text-purple-300 mb-1">{session.title}</div>
        {gate.kind === "too-early" && (
          <div className="text-xs text-zinc-400 mb-4">Starts in ~{gate.minutesUntil} min</div>
        )}
        <Button variant="secondary" onClick={onLeave} className="w-full">Back to Podcast Home</Button>
      </div>
    </div>
  );
};

export default PodcastRoomPage;

const LayoutSheet = ({
  onClose, activeLayout, setActiveLayout, captionsOn, setCaptionsOn,
  captionStyle, setCaptionStyle, bgEffect, setBgEffect,
}: {
  onClose: () => void;
  activeLayout: string;
  setActiveLayout: (v: string) => void;
  captionsOn: boolean;
  setCaptionsOn: (v: boolean) => void;
  captionStyle: CaptionStyle;
  setCaptionStyle: (v: CaptionStyle) => void;
  bgEffect: string;
  setBgEffect: (v: string) => void;
}) => (
  <div className="fixed inset-0 z-[70] bg-zinc-950/80 backdrop-blur grid place-items-end md:place-items-center p-3" onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-4 md:p-5 max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold flex items-center gap-2"><LayoutGrid className="w-4 h-4 text-purple-300" /> Layout, captions & background</h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-zinc-800" aria-label="Close"><X className="w-4 h-4 text-zinc-400" /></button>
      </div>

      <section className="mb-5">
        <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Layout</h3>
        <div className="grid grid-cols-3 gap-2">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              onClick={() => setActiveLayout(l.id)}
              className={`p-3 rounded-lg border text-left text-xs transition ${activeLayout === l.id ? "border-purple-400 bg-purple-500/15 text-white" : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"}`}
            >
              <div className="h-10 mb-2 rounded bg-zinc-800 grid place-items-center">
                <LayoutGrid className="w-4 h-4 text-zinc-500" />
              </div>
              {l.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs uppercase tracking-wider text-zinc-500 flex items-center gap-1.5"><Captions className="w-3.5 h-3.5" /> Live captions</h3>
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={captionsOn} onChange={(e) => setCaptionsOn(e.target.checked)} className="accent-purple-500" />
            {captionsOn ? "On" : "Off"}
          </label>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {(["clean", "bold", "subtitle", "karaoke"] as CaptionStyle[]).map((s) => (
            <button
              key={s}
              disabled={!captionsOn}
              onClick={() => setCaptionStyle(s)}
              className={`p-2 rounded-md border text-[11px] capitalize ${captionStyle === s ? "border-purple-400 bg-purple-500/15 text-white" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"} disabled:opacity-40`}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-zinc-500">Captions are generated locally on your device (Web Speech API). Each participant can turn them on/off independently.</p>
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" /> Background effect</h3>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              onClick={() => setBgEffect(b.id)}
              className={`group rounded-lg overflow-hidden border text-left ${bgEffect === b.id ? "border-purple-400 ring-2 ring-purple-400/50" : "border-zinc-800 hover:border-zinc-700"}`}
            >
              <div className="h-16" style={{ background: b.preview === "transparent" ? "repeating-conic-gradient(#27272a 0% 25%, #18181b 0% 50%) 50%/12px 12px" : b.preview }} />
              <div className="px-2 py-1.5 bg-zinc-900 text-[11px] text-zinc-300">{b.label}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  </div>
);

const WToolsPanel = ({ recordings, onDownload, onDelete, onRename, onEdit }: any) => {
  const [nr, setNr] = useState(false);
  const [aec, setAec] = useState(true);
  const [voice, setVoice] = useState("none");
  return (
    <div className="space-y-3">
      <section className="rounded-lg bg-zinc-900 border border-zinc-800 p-3">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-1.5"><Wand2 className="w-3 h-3" /> Audio effects</p>
        <label className="flex items-center justify-between py-1.5 text-xs"><span>Noise reduction</span>
          <input type="checkbox" checked={nr} onChange={(e) => setNr(e.target.checked)} className="accent-purple-500" />
        </label>
        <label className="flex items-center justify-between py-1.5 text-xs"><span>Echo cancellation</span>
          <input type="checkbox" checked={aec} onChange={(e) => setAec(e.target.checked)} className="accent-purple-500" />
        </label>
        <div className="mt-2">
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">AI voice preset</label>
          <select value={voice} onChange={(e) => setVoice(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs">
            <option value="none">None (natural)</option>
            <option value="broadcast">Broadcast warmth</option>
            <option value="podcast">Podcast clarity</option>
            <option value="bass">Bass boost</option>
            <option value="bright">Bright presence</option>
          </select>
        </div>
        <p className="text-[10px] text-zinc-500 mt-2">Settings apply on your next recording.</p>
      </section>

      <section>
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">This session's recordings</p>
        <RecordingFilesPanel recordings={recordings} onDownload={onDownload} onDelete={onDelete} onRename={onRename} onEdit={onEdit} />
      </section>
    </div>
  );
};
