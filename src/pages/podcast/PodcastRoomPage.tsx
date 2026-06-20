import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Copy, Circle, Square,
  Pause, Play, Users, MessageSquare, FolderDown, Settings as SettingsIcon,
  Download, Trash2, Edit3, X, Check, Volume2, VolumeX, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

// TODO: Cloud upload, separate guest track recording, AI transcription,
// captions, multi-track export, remote guest sync, producer controls.

type Participant = {
  id: string;
  name: string;
  role: "host" | "guest";
  isLocal: boolean;
  micOn: boolean;
  camOn: boolean;
  ready: boolean;
  stream?: MediaStream;
};

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

const PodcastRoomPage = () => {
  const { sessionId = "session" } = useParams();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("people");
  const [participants, setParticipants] = useState<Participant[]>([
    { id: "local", name: "You", role: "host", isLocal: true, micOn: true, camOn: true, ready: false },
  ]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [permError, setPermError] = useState<string | null>(null);

  // recording
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const pausedAccumRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordings, setRecordings] = useState<LocalRecording[]>([]);
  const [editing, setEditing] = useState<LocalRecording | null>(null);

  // checklist
  const [checklist, setChecklist] = useState({ mic: false, cam: false, headphones: false, ready: false });

  // chat
  const [chat, setChat] = useState<{ id: string; from: string; text: string; ts: number }[]>([]);
  const [chatInput, setChatInput] = useState("");

  // audio meter
  const [level, setLevel] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  /* ---------------- Media setup ---------------- */
  const initMedia = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermError("Your browser does not support camera/microphone access.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      setLocalStream(stream);
      setParticipants((p) =>
        p.map((x) => (x.isLocal ? { ...x, stream, micOn: true, camOn: true } : x))
      );
      setChecklist((c) => ({ ...c, mic: true, cam: true }));

      // analyser
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      audioCtxRef.current = ctx;
      analyserRef.current = an;
    } catch (e: any) {
      const msg = e?.name === "NotAllowedError"
        ? "Camera or microphone access was denied."
        : e?.name === "NotFoundError"
        ? "No camera or microphone found."
        : `Could not access media: ${e?.message || e}`;
      setPermError(msg);
    }
  }, []);

  useEffect(() => {
    initMedia();
    return () => {
      localStream?.getTracks().forEach((t) => t.stop());
      screenStream?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
      recordings.forEach((r) => URL.revokeObjectURL(r.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Audio meter loop ---------------- */
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const an = analyserRef.current;
      if (an) {
        const arr = new Uint8Array(an.fftSize);
        an.getByteTimeDomainData(arr);
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
          const v = (arr[i] - 128) / 128;
          sum += v * v;
        }
        setLevel(Math.min(1, Math.sqrt(sum / arr.length) * 2));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [localStream]);

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
  const startRecording = () => {
    if (!localStream) {
      toast({ title: "No media stream", description: "Allow camera/mic first." });
      return;
    }
    try {
      const mime = pickMime();
      const rec = new MediaRecorder(localStream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
      rec.onerror = () => toast({ title: "Recording failed" });
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        if (!blob.size) {
          toast({ title: "No recording captured" });
          return;
        }
        const url = URL.createObjectURL(blob);
        const dur = Date.now() - startedAtRef.current - pausedAccumRef.current;
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const ext = mime.includes("mp4") ? "mp4" : "webm";
        const item: LocalRecording = {
          id: `${Date.now()}`,
          name: `wstudio-podcast-${sessionId}-${stamp}.${ext}`,
          blob, url, mime,
          createdAt: Date.now(),
          durationMs: dur,
          trimStart: 0,
          trimEnd: dur,
        };
        setRecordings((r) => [item, ...r]);
        setTab("files");
        toast({ title: "Recording ready", description: item.name });
      };
      startedAtRef.current = Date.now();
      pausedAccumRef.current = 0;
      rec.start(1000);
      recorderRef.current = rec;
      setIsRecording(true);
      setIsPaused(false);
      setElapsed(0);
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

  /* ---------------- Controls ---------------- */
  const toggleMic = () => {
    if (!localStream) return;
    const enabled = !localStream.getAudioTracks()[0]?.enabled;
    localStream.getAudioTracks().forEach((t) => (t.enabled = enabled));
    setParticipants((p) => p.map((x) => (x.isLocal ? { ...x, micOn: enabled } : x)));
  };
  const toggleCam = () => {
    if (!localStream) return;
    const enabled = !localStream.getVideoTracks()[0]?.enabled;
    localStream.getVideoTracks().forEach((t) => (t.enabled = enabled));
    setParticipants((p) => p.map((x) => (x.isLocal ? { ...x, camOn: enabled } : x)));
  };
  const toggleScreen = async () => {
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      return;
    }
    try {
      const s = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true });
      setScreenStream(s);
      s.getVideoTracks()[0].onended = () => setScreenStream(null);
    } catch {/* user cancel */}
  };

  const leave = () => {
    if (isRecording) stopRecording();
    localStream?.getTracks().forEach((t) => t.stop());
    navigate("/");
  };

  const copyInvite = async () => {
    const link = `${window.location.origin}/#/podcast/room/${sessionId}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Invite link copied" });
    } catch {
      toast({ title: "Copy failed", description: link });
    }
  };

  /* ---------------- Files actions ---------------- */
  const downloadRec = (r: LocalRecording) => {
    try {
      const a = document.createElement("a");
      a.href = r.url;
      a.download = r.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      toast({ title: "Download failed", description: e?.message });
    }
  };
  const downloadAudio = async (r: LocalRecording) => {
    // Best-effort: just re-download original; true audio extraction needs WASM/FFmpeg.
    toast({ title: "Audio export", description: "Downloading container; audio-only extraction coming soon." });
    downloadRec(r);
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
    const t = chatInput.trim();
    if (!t) return;
    setChat((c) => [...c, { id: `${Date.now()}`, from: "You", text: t, ts: Date.now() }]);
    setChatInput("");
  };

  /* ---------------- Render ---------------- */
  const visible = useMemo(() => participants.slice(0, 6), [participants]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 px-3 md:px-5 h-14 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={leave} className="p-1.5 rounded hover:bg-zinc-800" title="Back to Podcast">
            <ArrowLeft className="w-4 h-4 text-zinc-300" />
          </button>
          <div className="text-sm font-semibold tracking-wider text-purple-300">W.STUDIO <span className="text-teal-300">PODCAST</span></div>
          <span className="hidden md:inline text-xs text-zinc-500">Session</span>
          <code className="hidden md:inline text-xs px-2 py-1 rounded bg-zinc-900 border border-zinc-800">{sessionId}</code>
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

      {/* Body */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Stage */}
        <main className="flex-1 min-w-0 p-3 md:p-5 flex flex-col gap-4">
          {permError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-200 flex items-center justify-between">
              <span>{permError}</span>
              <Button size="sm" variant="outline" onClick={initMedia}>Retry</Button>
            </div>
          )}

          <PodcastVideoGrid
            participants={visible}
            screenStream={screenStream}
            isRecording={isRecording}
            level={level}
          />

          {!checklist.ready && (
            <PodcastReadyChecklist value={checklist} onChange={setChecklist} />
          )}

          {editing && (
            <PodcastEditorPanel rec={editing} onClose={() => setEditing(null)} onUpdate={(u) => {
              setRecordings((rs) => rs.map((x) => (x.id === u.id ? u : x)));
              setEditing(u);
            }} onExport={() => downloadRec(editing)} />
          )}
        </main>

        {/* Sidebar */}
        <PodcastSidebar
          tab={tab}
          setTab={setTab}
          participants={participants}
          chat={chat}
          chatInput={chatInput}
          setChatInput={setChatInput}
          sendChat={sendChat}
          recordings={recordings}
          onDownload={downloadRec}
          onDownloadAudio={downloadAudio}
          onDelete={deleteRec}
          onRename={renameRec}
          onEdit={(r) => setEditing(r)}
        />
      </div>

      {/* Control bar */}
      <PodcastControlBar
        isRecording={isRecording}
        isPaused={isPaused}
        micOn={participants[0]?.micOn ?? true}
        camOn={participants[0]?.camOn ?? true}
        screenOn={!!screenStream}
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

const PodcastVideoGrid = ({
  participants, screenStream, isRecording, level,
}: {
  participants: Participant[]; screenStream: MediaStream | null; isRecording: boolean; level: number;
}) => {
  const count = participants.length + (screenStream ? 1 : 0);
  const cols = count <= 1 ? "grid-cols-1" : count <= 2 ? "grid-cols-1 md:grid-cols-2"
    : count <= 4 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3";
  return (
    <div className={`grid ${cols} gap-3 flex-1 min-h-[300px]`}>
      {screenStream && (
        <ScreenTile stream={screenStream} />
      )}
      {participants.map((p) => (
        <PodcastParticipantTile key={p.id} p={p} isRecording={isRecording} level={p.isLocal ? level : 0} />
      ))}
    </div>
  );
};

const ScreenTile = ({ stream }: { stream: MediaStream }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return (
    <div className="relative rounded-xl overflow-hidden bg-black border border-purple-500/30">
      <video ref={ref} autoPlay muted playsInline className="w-full h-full object-contain" />
      <div className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded bg-purple-500/80">Screen</div>
    </div>
  );
};

const PodcastParticipantTile = ({ p, isRecording, level }: { p: Participant; isRecording: boolean; level: number }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current && p.stream) ref.current.srcObject = p.stream; }, [p.stream]);
  return (
    <div className="relative rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 aspect-video">
      {p.stream && p.camOn ? (
        <video ref={ref} autoPlay muted={p.isLocal} playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-teal-400 grid place-items-center text-xl font-bold">
            {p.name[0]?.toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute top-2 left-2 flex items-center gap-1.5">
        <span className="text-xs px-1.5 py-0.5 rounded bg-black/60 border border-white/10">{p.name}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.role === "host" ? "bg-purple-500/80" : "bg-teal-500/80"}`}>{p.role}</span>
      </div>
      <div className="absolute top-2 right-2 flex items-center gap-1">
        {!p.micOn && <span className="p-1 rounded bg-red-500/80"><MicOff className="w-3 h-3" /></span>}
        {!p.camOn && <span className="p-1 rounded bg-red-500/80"><VideoOff className="w-3 h-3" /></span>}
        {isRecording && p.isLocal && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/80 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />REC</span>}
      </div>
      {p.isLocal && p.micOn && (
        <AudioMeter level={level} />
      )}
    </div>
  );
};

const AudioMeter = ({ level }: { level: number }) => (
  <div className="absolute bottom-2 left-2 right-2 h-1.5 rounded-full bg-black/40 overflow-hidden">
    <div className="h-full bg-gradient-to-r from-teal-400 to-purple-500 transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
  </div>
);

const PodcastControlBar = ({
  isRecording, isPaused, micOn, camOn, screenOn,
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
        <button onClick={onStart} className="h-14 px-6 rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-red-600/30">
          <Circle className="w-4 h-4 fill-white" /> Record
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
  recordings, onDownload, onDownloadAudio, onDelete, onRename, onEdit,
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
          {participants.map((p: Participant) => (
            <li key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-teal-400 grid place-items-center text-xs font-bold">{p.name[0]}</div>
                <div>
                  <div className="text-sm">{p.name}</div>
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">{p.role}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs">
                {p.ready ? <span className="text-teal-400 flex items-center gap-1"><Check className="w-3 h-3" />Ready</span> : <span className="text-zinc-500">Not ready</span>}
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
              <div key={m.id} className="text-sm">
                <span className="text-purple-300 font-medium">{m.from}: </span>{m.text}
              </div>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); sendChat(); }} className="mt-2 flex gap-2">
            <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Message..." className="bg-zinc-900 border-zinc-800" />
            <Button type="submit" size="sm">Send</Button>
          </form>
        </div>
      )}
      {tab === "files" && (
        <RecordingFilesPanel recordings={recordings} onDownload={onDownload} onDownloadAudio={onDownloadAudio} onDelete={onDelete} onRename={onRename} onEdit={onEdit} />
      )}
      {tab === "host" && (
        <div className="space-y-2 text-sm text-zinc-300">
          <p className="text-xs text-zinc-500">Host controls</p>
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
            <p className="text-xs text-zinc-500">Producer tools coming soon: mute-all, kick, recording sync.</p>
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

const RecordingFilesPanel = ({ recordings, onDownload, onDownloadAudio, onDelete, onRename, onEdit }: any) => {
  if (!recordings.length) return <p className="text-xs text-zinc-500">No recordings yet. Hit Record to capture one.</p>;
  return (
    <ul className="space-y-2">
      {recordings.map((r: LocalRecording) => (
        <li key={r.id} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
          <div className="text-xs font-medium truncate">{r.name}</div>
          <div className="text-[10px] text-zinc-500 mb-2">{fmtTime(r.durationMs)} · {(r.blob.size / 1024 / 1024).toFixed(1)} MB</div>
          <video src={r.url} controls className="w-full rounded bg-black mb-2" />
          <div className="grid grid-cols-2 gap-1">
            <Button size="sm" variant="secondary" onClick={() => onDownload(r)} className="gap-1"><Download className="w-3 h-3" />Video</Button>
            <Button size="sm" variant="secondary" onClick={() => onDownloadAudio(r)} className="gap-1"><Volume2 className="w-3 h-3" />Audio</Button>
            <Button size="sm" variant="secondary" onClick={() => onEdit(r)} className="gap-1"><Edit3 className="w-3 h-3" />Edit</Button>
            <Button size="sm" variant="secondary" onClick={() => onRename(r)} className="gap-1"><Edit3 className="w-3 h-3" />Rename</Button>
            <Button size="sm" variant="destructive" onClick={() => onDelete(r)} className="col-span-2 gap-1"><Trash2 className="w-3 h-3" />Delete</Button>
          </div>
        </li>
      ))}
    </ul>
  );
};

const PodcastReadyChecklist = ({ value, onChange }: { value: any; onChange: (v: any) => void }) => {
  const items: { key: keyof typeof value; label: string }[] = [
    { key: "mic", label: "Mic connected" },
    { key: "cam", label: "Camera connected" },
    { key: "headphones", label: "Headphones confirmed" },
    { key: "ready", label: "Guest ready" },
  ];
  return (
    <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/50">
      <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Pre-flight</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {items.map((it) => (
          <button key={String(it.key)} onClick={() => onChange({ ...value, [it.key]: !value[it.key] })} className={`flex items-center gap-2 p-2 rounded-lg border text-sm text-left ${value[it.key] ? "bg-teal-500/15 border-teal-500/40 text-teal-200" : "bg-zinc-900 border-zinc-800"}`}>
            {value[it.key] ? <Check className="w-4 h-4" /> : <span className="w-4 h-4 rounded border border-zinc-600" />}
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const PodcastEditorPanel = ({ rec, onClose, onUpdate, onExport }: {
  rec: LocalRecording; onClose: () => void; onUpdate: (r: LocalRecording) => void; onExport: () => void;
}) => {
  const vidRef = useRef<HTMLVideoElement>(null);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);

  const startSec = rec.trimStart / 1000;
  const endSec = rec.trimEnd / 1000;
  const durSec = rec.durationMs / 1000;

  useEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    const onTime = () => {
      if (v.currentTime > endSec) { v.currentTime = startSec; v.pause(); }
      if (v.currentTime < startSec) v.currentTime = startSec;
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [startSec, endSec]);

  return (
    <div className="rounded-xl border border-purple-500/30 bg-zinc-900/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-purple-300 uppercase tracking-wider">Editor</p>
          <p className="text-sm font-medium">{rec.name}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>
      <video ref={vidRef} src={rec.url} controls className="w-full rounded-lg bg-black mb-3" />

      {/* Waveform placeholder */}
      <div className="h-12 rounded-md bg-zinc-950 border border-zinc-800 flex items-end gap-0.5 px-1 mb-3 overflow-hidden">
        {Array.from({ length: 80 }).map((_, i) => (
          <div key={i} className="flex-1 bg-purple-500/60 rounded-t" style={{ height: `${20 + Math.abs(Math.sin(i * 0.6)) * 70}%` }} />
        ))}
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <label className="text-zinc-400">Trim start: {startSec.toFixed(2)}s</label>
          <input type="range" min={0} max={durSec} step={0.05} value={startSec}
            onChange={(e) => onUpdate({ ...rec, trimStart: Math.min(parseFloat(e.target.value) * 1000, rec.trimEnd - 100) })}
            className="w-full accent-purple-500" />
        </div>
        <div>
          <label className="text-zinc-400">Trim end: {endSec.toFixed(2)}s</label>
          <input type="range" min={0} max={durSec} step={0.05} value={endSec}
            onChange={(e) => onUpdate({ ...rec, trimEnd: Math.max(parseFloat(e.target.value) * 1000, rec.trimStart + 100) })}
            className="w-full accent-purple-500" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setMuted(!muted); if (vidRef.current) vidRef.current.muted = !muted; }} className="p-2 rounded bg-zinc-800">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input type="range" min={0} max={1} step={0.01} value={vol} onChange={(e) => { const v = parseFloat(e.target.value); setVol(v); if (vidRef.current) vidRef.current.volume = v; }} className="flex-1 accent-purple-500" />
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800">
          <Button size="sm" variant="secondary" disabled>Split</Button>
          <Button size="sm" variant="secondary" disabled>Delete clip</Button>
          <Button size="sm" variant="secondary" disabled>Title overlay</Button>
          <Button size="sm" variant="secondary" disabled>Intro/Outro</Button>
          <Button size="sm" onClick={onExport} className="ml-auto bg-purple-600 hover:bg-purple-500">Export</Button>
        </div>
        <p className="text-[10px] text-zinc-500">Advanced export rendering coming soon. Trim values are preview-only; exports the original recording.</p>
      </div>
    </div>
  );
};

export default PodcastRoomPage;
