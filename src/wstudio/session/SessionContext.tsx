import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ConnectionState } from "../connection/connectionTypes";
import {
  DEMO_SESSION_TITLE,
  DEMO_TIMER_MINUTES,
  WSTUDIO_DEMO_MODE,
  generateMockSessionId,
} from "./demoConfig";
import type { TimerWarningLevel } from "../booking/bookingTypes";

type Role = "artist" | "engineer" | null;

export type DemoClock = {
  totalMinutes: number;
  remainingSeconds: number;
  running: boolean;
  phase: "scheduled" | "live" | "ended";
};

function demoWarningLevel(remainingSeconds: number, phase: DemoClock["phase"], running: boolean): TimerWarningLevel {
  if (phase !== "live" || !running) return "ok";
  if (remainingSeconds <= 60) return "critical";
  if (remainingSeconds <= 300) return "warning";
  if (remainingSeconds <= 900) return "caution";
  return "ok";
}

export type SessionContextValue = {
  /** Preview mode: instant connect, mock data */
  demoMode: boolean;
  sessionId: string;
  setSessionId: (id: string) => void;
  sessionDisplayName: string;
  role: Role;
  connection: ConnectionState;
  joinAsArtist: () => void;
  joinAsEngineer: () => void;
  leaveSession: () => void;
  talkbackOn: boolean;
  toggleTalkback: () => void;
  muted: boolean;
  toggleMute: () => void;
  latencyMs: number;
  screenSharing: boolean;
  toggleScreenShare: () => void;
  remoteVocalLevel: number;
  /** Paid-booking timer absent — use demo clock for preview */
  demoClock: DemoClock;
  demoWarningLevel: TimerWarningLevel;
  startDemoSessionClock: () => void;
};

const SessionCtx = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState("");
  const [sessionDisplayName, setSessionDisplayName] = useState("");
  const [role, setRole] = useState<Role>(null);
  const [connection, setConnection] = useState<ConnectionState>("disconnected");
  const [talkbackOn, setTalkbackOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [remoteVocalLevel, setRemoteVocalLevel] = useState(0.35);
  const latencyRef = useRef(26);
  const vocalPhaseRef = useRef(0);

  const [demoClock, setDemoClock] = useState<DemoClock>({
    totalMinutes: DEMO_TIMER_MINUTES,
    remainingSeconds: DEMO_TIMER_MINUTES * 60,
    running: false,
    phase: "scheduled",
  });

  const startDemoSessionClock = useCallback(() => {
    setDemoClock((c) => ({
      ...c,
      running: true,
      phase: "live",
      remainingSeconds: c.totalMinutes * 60,
    }));
  }, []);

  const joinAsArtist = useCallback(() => {
    const id = sessionId.trim() || generateMockSessionId();
    setSessionId(id);
    setRole("artist");
    latencyRef.current = 22 + Math.floor(Math.random() * 12);
    if (WSTUDIO_DEMO_MODE) {
      setConnection("connected");
      setSessionDisplayName(`Session: ${DEMO_SESSION_TITLE}`);
      setDemoClock({
        totalMinutes: DEMO_TIMER_MINUTES,
        remainingSeconds: DEMO_TIMER_MINUTES * 60,
        running: true,
        phase: "live",
      });
    } else {
      setConnection("connecting");
      window.setTimeout(() => {
        setConnection("connected");
        setSessionDisplayName(`Session: ${DEMO_SESSION_TITLE}`);
      }, 700);
    }
  }, [sessionId]);

  const joinAsEngineer = useCallback(() => {
    const id = sessionId.trim() || generateMockSessionId();
    setSessionId(id);
    setRole("engineer");
    latencyRef.current = 20 + Math.floor(Math.random() * 14);
    if (WSTUDIO_DEMO_MODE) {
      setConnection("connected");
      setSessionDisplayName(`Session: ${DEMO_SESSION_TITLE}`);
      setDemoClock({
        totalMinutes: DEMO_TIMER_MINUTES,
        remainingSeconds: DEMO_TIMER_MINUTES * 60,
        running: true,
        phase: "live",
      });
    } else {
      setConnection("connecting");
      window.setTimeout(() => {
        setConnection("connected");
        setSessionDisplayName(`Session: ${DEMO_SESSION_TITLE}`);
      }, 700);
    }
  }, [sessionId]);

  const leaveSession = useCallback(() => {
    setRole(null);
    setConnection("disconnected");
    setTalkbackOn(false);
    setMuted(false);
    setScreenSharing(false);
    setSessionDisplayName("");
    setDemoClock({
      totalMinutes: DEMO_TIMER_MINUTES,
      remainingSeconds: DEMO_TIMER_MINUTES * 60,
      running: false,
      phase: "scheduled",
    });
  }, []);

  useEffect(() => {
    if (connection !== "connected" || !WSTUDIO_DEMO_MODE) return;
    let frame: number;
    const loop = (t: number) => {
      vocalPhaseRef.current = t * 0.002;
      const wobble = Math.sin(vocalPhaseRef.current) * 0.12 + Math.sin(t * 0.0008) * 0.08;
      setRemoteVocalLevel(() => Math.min(0.85, Math.max(0.18, 0.42 + wobble)));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [connection]);

  useEffect(() => {
    if (!demoClock.running || demoClock.phase !== "live") return;
    const id = window.setInterval(() => {
      setDemoClock((c) => {
        if (!c.running || c.phase !== "live") return c;
        const nextSec = Math.max(0, c.remainingSeconds - 1);
        if (nextSec <= 0) {
          return { ...c, remainingSeconds: 0, running: false, phase: "ended" };
        }
        return { ...c, remainingSeconds: nextSec };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [demoClock.running, demoClock.phase]);

  const demoWarn = useMemo(
    () => demoWarningLevel(demoClock.remainingSeconds, demoClock.phase, demoClock.running),
    [demoClock.remainingSeconds, demoClock.phase, demoClock.running],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      demoMode: WSTUDIO_DEMO_MODE,
      sessionId,
      setSessionId,
      sessionDisplayName,
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
      remoteVocalLevel: connection === "connected" ? remoteVocalLevel : 0,
      demoClock,
      demoWarningLevel: demoWarn,
      startDemoSessionClock,
    }),
    [
      sessionId,
      sessionDisplayName,
      role,
      connection,
      joinAsArtist,
      joinAsEngineer,
      leaveSession,
      talkbackOn,
      muted,
      screenSharing,
      remoteVocalLevel,
      demoClock,
      demoWarn,
      startDemoSessionClock,
    ],
  );

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  const v = useContext(SessionCtx);
  if (!v) throw new Error("useSession requires SessionProvider");
  return v;
}
