import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Share2, Circle, Square,
  Pause, Play, Users, MessageSquare, FolderDown, Settings as SettingsIcon,
  Download, Trash2, Edit3, Check, ArrowLeft, Wifi, AlertTriangle, RotateCcw,
  Shield, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import PodcastEditorPro from "./PodcastEditorPro";
import { usePodcastLiveRoom, type RoomParticipant } from "./usePodcastLiveRoom";
import { PodcastRecovery, type RecoverySessionRow } from "./podcastRecoveryStore";
import { supabase } from "@/integrations/supabase/client";
import PodcastInviteSheet, { type PodcastSecurity } from "./PodcastInviteSheet";
import { usePodcastDoorman } from "./usePodcastDoorman";

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

type Tab = "people" | "chat" | "files" | "host";

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
    if (doorman.policy.requiresPassword) {
      if (linkPassword) {
        doorman.requestJoin(linkPassword);
      }
      // else: waiting room UI will collect password
    } else {
      doorman.requestJoin();
    }
  }, [isHost, doorman, linkPassword]);

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

  // recording (own browser, own tracks)
  const recorderRef = useRef<MediaRecorder | null>(null);
  const handleRef = useRef<Awaited<ReturnType<typeof PodcastRecovery.create>> | null>(null);
  const chunkIndexRef = useRef(0);
  const startedAtRef = useRef<number>(0);
  const pausedAccumRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordings, setRecordings] = useState<LocalRecording[]>([]);
  const [editing, setEditing] = useState<LocalRecording | null>(null);

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

  /* ---------------- Recording ---------------- */
  const startRecording = async () => {
    const stream = room.localStream;
    if (!stream || stream.getTracks().length === 0) {
      toast({ title: "No local media", description: "Allow camera/mic and wait until you're connected." });
      return;
    }
    try {
      const mime = pickMime();
      const ext = mime.includes("mp4") ? "mp4" : "webm";
      const handle = await PodcastRecovery.create({
        sessionId,
        participantName: displayName,
        mime,
        ext,
      });
      handleRef.current = handle;
      chunkIndexRef.current = 0;

      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
      rec.ondataavailable = async (e) => {
        if (!e.data?.size) return;
        try { await handle.appendChunk(e.data, chunkIndexRef.current++); }
        catch (err) { console.error("idb chunk save failed", err); }
      };
      rec.onerror = () => toast({ title: "Recording failed" });
      rec.onstop = async () => {
        try {
          const assembled = await PodcastRecovery.assembleBlob(handle.dbId);
          if (!assembled || !assembled.blob.size) {
            toast({ title: "No recording captured" });
            await handle.discard();
            return;
          }
          const dur = Date.now() - startedAtRef.current - pausedAccumRef.current;
          const url = URL.createObjectURL(assembled.blob);
          const name = `wstudio-${safeName(sessionId)}-${safeName(displayName)}-${stampStr()}.${ext}`;
          const item: LocalRecording = {
            id: `${handle.dbId}`,
            name,
            blob: assembled.blob,
            url,
            mime,
            createdAt: Date.now(),
            durationMs: dur,
            trimStart: 0,
            trimEnd: dur,
          };
          setRecordings((rs) => [item, ...rs]);
          setTab("files");
          await handle.finalize();
          toast({ title: "Recording saved", description: name });
        } catch (err: any) {
          toast({ title: "Save failed", description: err?.message });
        }
      };

      // 10s chunk cadence -> crash-safe IndexedDB writes every 10 seconds.
      startedAtRef.current = Date.now();
      pausedAccumRef.current = 0;
      rec.start(10_000);
      recorderRef.current = rec;
      setIsRecording(true);
      setIsPaused(false);
      setElapsed(0);
      toast({ title: "Recording started", description: "Saving locally every 10s." });
    } catch (e: any) {
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
    room.disconnect();
    navigate("/tv/podcast");
  };

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
          <button onClick={leave} className="p-1.5 rounded hover:bg-zinc-800" title="Back to Podcast">
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
          <Button size="sm" variant="secondary" onClick={copyInvite} className="gap-1.5">
            <Copy className="w-3.5 h-3.5" /> Invite
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <main className="flex-1 min-w-0 p-3 md:p-5 flex flex-col gap-4">
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

          <PodcastVideoGrid participants={visible} isRecording={isRecording} localId={me?.id} />

          {editing && (
            <PodcastEditorPro
              initial={{ id: editing.id, name: editing.name, url: editing.url, blob: editing.blob, durationMs: editing.durationMs }}
              onClose={() => setEditing(null)}
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
        />
      </div>

      <PodcastControlBar
        isRecording={isRecording}
        isPaused={isPaused}
        micOn={me?.micOn ?? false}
        camOn={me?.camOn ?? false}
        screenOn={screenOn}
        canRecord={!!room.localStream}
        onStart={startRecording}
        onStop={stopRecording}
        onPause={togglePause}
        onMic={toggleMic}
        onCam={toggleCam}
        onScreen={toggleScreen}
        onLeave={leave}
      />
    </div>
  );
};

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
  participants, isRecording, localId,
}: { participants: RoomParticipant[]; isRecording: boolean; localId?: string }) => {
  const count = participants.length || 1;
  const cols = count <= 1 ? "grid-cols-1"
    : count <= 2 ? "grid-cols-1 md:grid-cols-2"
    : count <= 4 ? "grid-cols-2"
    : "grid-cols-2 md:grid-cols-3";
  if (participants.length === 0) {
    return <div className="rounded-xl bg-zinc-900 border border-zinc-800 aspect-video grid place-items-center text-sm text-zinc-500">Connecting to room…</div>;
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
  isRecording, isPaused, micOn, camOn, screenOn, canRecord,
  onStart, onStop, onPause, onMic, onCam, onScreen, onLeave,
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

      {!isRecording ? (
        <button onClick={onStart} disabled={!canRecord} className="h-14 px-6 rounded-full bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold flex items-center gap-2 shadow-lg shadow-red-600/30">
          <Circle className="w-4 h-4 fill-white" /> Record (local)
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button onClick={onPause} className="h-12 px-4 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center gap-2">
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {isPaused ? "Resume" : "Pause"}
          </button>
          <button onClick={onStop} className="h-12 px-4 rounded-full bg-red-600 hover:bg-red-500 flex items-center gap-2">
            <Square className="w-4 h-4 fill-white" /> Stop
          </button>
        </div>
      )}

      <CtrlBtn onClick={onLeave} active label="Leave" className="bg-red-600 hover:bg-red-500 border-red-500">
        <PhoneOff className="w-5 h-5" />
      </CtrlBtn>
    </div>
  </footer>
);

const CtrlBtn = ({ children, onClick, active, label, className = "" }: any) => (
  <button onClick={onClick} title={label} className={`w-12 h-12 rounded-full grid place-items-center border ${active ? "bg-purple-500/20 border-purple-500 text-purple-200" : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800"} ${className}`}>
    {children}
  </button>
);

const PodcastSidebar = ({
  tab, setTab, participants, chat, chatInput, setChatInput, sendChat,
  recordings, onDownload, onDelete, onRename, onEdit,
}: any) => (
  <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-zinc-800 bg-zinc-950 flex flex-col max-h-[40vh] lg:max-h-none">
    <nav className="flex border-b border-zinc-800">
      <TabBtn active={tab === "people"} onClick={() => setTab("people")}><Users className="w-4 h-4" /> People</TabBtn>
      <TabBtn active={tab === "chat"} onClick={() => setTab("chat")}><MessageSquare className="w-4 h-4" /> Chat</TabBtn>
      <TabBtn active={tab === "files"} onClick={() => setTab("files")}><FolderDown className="w-4 h-4" /> Files</TabBtn>
      <TabBtn active={tab === "host"} onClick={() => setTab("host")}><SettingsIcon className="w-4 h-4" /></TabBtn>
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
        <RecordingFilesPanel recordings={recordings} onDownload={onDownload} onDelete={onDelete} onRename={onRename} onEdit={onEdit} />
      )}
      {tab === "host" && (
        <div className="space-y-2 text-sm text-zinc-300">
          <p className="text-xs text-zinc-500">Host tools</p>
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 space-y-2">
            <p>Each participant records locally on their own device. After the session ends, ask guests to download their .webm file and send it to you.</p>
            <p className="text-zinc-500">Cloud guest-file upload, producer mode, and screen-share recording are Phase 2B.</p>
          </div>
        </div>
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

export default PodcastRoomPage;
