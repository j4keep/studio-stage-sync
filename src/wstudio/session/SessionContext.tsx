import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ConnectionState } from "../connection/connectionTypes";

type Role = "artist" | "engineer" | null;

export type SessionContextValue = {
  sessionId: string;
  setSessionId: (id: string) => void;
  role: Role;
  connection: ConnectionState;
  joinAsArtist: () => void;
  joinAsEngineer: () => void;
  leaveSession: () => void;
  talkbackOn: boolean;
  toggleTalkback: () => void;
  muted: boolean;
  toggleMute: () => void;
  /** Stable mock RTT when connected */
  latencyMs: number;
  screenSharing: boolean;
  toggleScreenShare: () => void;
  remoteVocalLevel: number;
};

const SessionCtx = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState("");
  const [role, setRole] = useState<Role>(null);
  const [connection, setConnection] = useState<ConnectionState>("disconnected");
  const [talkbackOn, setTalkbackOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const latencyRef = useRef(26);

  const joinAsArtist = useCallback(() => {
    if (!sessionId.trim()) return;
    setConnection("connecting");
    setRole("artist");
    latencyRef.current = 22 + Math.floor(Math.random() * 12);
    window.setTimeout(() => setConnection("connected"), 700);
  }, [sessionId]);

  const joinAsEngineer = useCallback(() => {
    if (!sessionId.trim()) return;
    setConnection("connecting");
    setRole("engineer");
    latencyRef.current = 20 + Math.floor(Math.random() * 14);
    window.setTimeout(() => setConnection("connected"), 700);
  }, [sessionId]);

  const leaveSession = useCallback(() => {
    setRole(null);
    setConnection("disconnected");
    setTalkbackOn(false);
    setMuted(false);
    setScreenSharing(false);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      sessionId,
      setSessionId,
      role,
      connection,
      joinAsArtist,
      joinAsEngineer,
      leaveSession,
      talkbackOn,
      toggleTalkback: () => setTalkbackOn((v) => !v),
      muted,
      toggleMute: () => setMuted((v) => !v),
      latencyMs: connection === "connected" ? latencyRef.current : 0,
      screenSharing,
      toggleScreenShare: () => setScreenSharing((v) => !v),
      remoteVocalLevel: connection === "connected" ? 0.38 : 0,
    }),
    [
      sessionId,
      role,
      connection,
      joinAsArtist,
      joinAsEngineer,
      leaveSession,
      talkbackOn,
      muted,
      screenSharing,
    ],
  );

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  const v = useContext(SessionCtx);
  if (!v) throw new Error("useSession requires SessionProvider");
  return v;
}
