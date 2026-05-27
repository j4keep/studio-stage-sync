import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";

export type SessionState =
  | "waiting_for_artist"
  | "artist_joined"
  | "testing_audio"
  | "plugin_connected"
  | "ready_to_record"
  | "recording"
  | "paused"
  | "ended";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
export type ArtistStatus = "waiting" | "connected" | "ready";
export type HQAudioStatus = "off" | "checking" | "live";
export type SessionType = "Vocal Recording" | "Mix Review" | "Podcast" | "Songwriting" | "Voiceover";

export interface ChatMessage {
  id: string;
  author: string;
  body: string;
  ts: number;
}

export interface SessionFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedBy: string;
  ts: number;
}

export interface StudioSession {
  id: string;
  code: string;
  name: string;
  artistName: string;
  type: SessionType;
  engineerName: string;
  createdAt: number;
}

export interface StudioState {
  session: StudioSession | null;
  sessionState: SessionState;
  plugin: ConnectionStatus;
  artist: ArtistStatus;
  hqAudio: HQAudioStatus;
  checklist: {
    artistMic: boolean;
    artistHeadphones: boolean;
    artistHearsBeat: boolean;
    pluginConnected: boolean;
  };
  messages: ChatMessage[];
  files: SessionFile[];
  notes: string;
  micMuted: boolean;
  cameraOn: boolean;
  isLive: boolean;
  isTalkback: boolean;
  isMonitor: boolean;
  artistGain: number;
}

interface StudioCtx extends StudioState {
  createSession: (s: Omit<StudioSession, "id" | "code" | "createdAt">) => StudioSession;
  setPlugin: (s: ConnectionStatus) => void;
  setArtist: (s: ArtistStatus) => void;
  setHqAudio: (s: HQAudioStatus) => void;
  setSessionState: (s: SessionState) => void;
  toggleCheck: (k: keyof StudioState["checklist"], v?: boolean) => void;
  sendMessage: (author: string, body: string) => void;
  addFile: (f: Omit<SessionFile, "id" | "ts">) => void;
  removeFile: (id: string) => void;
  setNotes: (n: string) => void;
  setMicMuted: (m: boolean) => void;
  setCameraOn: (c: boolean) => void;
  setIsLive: (v: boolean) => void;
  setIsTalkback: (v: boolean) => void;
  setIsMonitor: (v: boolean) => void;
  setArtistGain: (v: number) => void;
}

const Ctx = createContext<StudioCtx | null>(null);

function code6() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StudioSession | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("waiting_for_artist");
  const [plugin, setPlugin] = useState<ConnectionStatus>("disconnected");
  const [artist, setArtist] = useState<ArtistStatus>("waiting");
  const [hqAudio, setHqAudio] = useState<HQAudioStatus>("off");
  const [checklist, setChecklist] = useState({
    artistMic: false,
    artistHeadphones: false,
    artistHearsBeat: false,
    pluginConnected: false,
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<SessionFile[]>([]);
  const [notes, setNotes] = useState("");
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [isTalkback, setIsTalkback] = useState(false);
  const [isMonitor, setIsMonitor] = useState(true);
  const [artistGain, setArtistGain] = useState(70);

  const createSession = useCallback<StudioCtx["createSession"]>((s) => {
    const ns: StudioSession = {
      ...s,
      id: crypto.randomUUID(),
      code: code6(),
      createdAt: Date.now(),
    };
    setSession(ns);
    return ns;
  }, []);

  const toggleCheck = useCallback<StudioCtx["toggleCheck"]>((k, v) => {
    setChecklist((p) => ({ ...p, [k]: v ?? !p[k] }));
  }, []);

  const sendMessage = useCallback<StudioCtx["sendMessage"]>((author, body) => {
    if (!body.trim()) return;
    setMessages((p) => [...p, { id: crypto.randomUUID(), author, body, ts: Date.now() }]);
  }, []);

  const addFile = useCallback<StudioCtx["addFile"]>((f) => {
    setFiles((p) => [...p, { ...f, id: crypto.randomUUID(), ts: Date.now() }]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((p) => p.filter((f) => f.id !== id));
  }, []);

  const value = useMemo<StudioCtx>(
    () => ({
      session, sessionState, plugin, artist, hqAudio, checklist, messages, files, notes,
      micMuted, cameraOn, isLive, isTalkback, isMonitor, artistGain,
      createSession, setPlugin, setArtist, setHqAudio, setSessionState, toggleCheck,
      sendMessage, addFile, removeFile, setNotes, setMicMuted, setCameraOn,
      setIsLive, setIsTalkback, setIsMonitor, setArtistGain,
    }),
    [session, sessionState, plugin, artist, hqAudio, checklist, messages, files, notes,
     micMuted, cameraOn, isLive, isTalkback, isMonitor, artistGain,
     createSession, toggleCheck, sendMessage, addFile, removeFile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudio() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStudio must be used within StudioProvider");
  return v;
}
