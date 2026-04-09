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
import {
  defaultLiveState,
  subscribeLive,
  writeLive,
  type SessionLiveState,
} from "./sessionLiveSync";

export type Role = "artist" | "engineer" | null;

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
  demoMode: boolean;
  sessionId: string;
  setSessionId: (id: string) => void;
  sessionDisplayName: string;
  role: Role;
  connection: ConnectionState;
  joinAsArtist: () => void;
  joinAsEngineer: () => void;
  leaveSession: () => void;
  /** Local push-to-talk pressed */
  talkbackHeld: boolean;
  beginTalkback: () => void;
  endTalkback: () => void;
  /** @deprecated use talkbackHeld */
  talkbackOn: boolean;
  /** @deprecated use beginTalkback/endTalkback */
  toggleTalkback: () => void;
  muted: boolean;
  toggleMute: () => void;
  latencyMs: number;
  screenSharing: boolean;
  toggleScreenShare: () => void;
  remoteVocalLevel: number;
  demoClock: DemoClock;
  demoWarningLevel: TimerWarningLevel;
  startDemoSessionClock: () => void;
  /** Synced session state (recording, peer PTT, share, artist mute) */
  live: SessionLiveState;
  setSessionRecording: (recording: boolean) => void;
  /** True when engineer has share on OR live says share active (for artist view) */
  collaborationShareActive: boolean;
};

const SessionCtx = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState("");
  const [sessionDisplayName, setSessionDisplayName] = useState("");
  const [role, setRole] = useState<Role>(null);
  const [connection, setConnection] = useState<ConnectionState>("disconnected");
  const [talkbackHeld, setTalkbackHeld] = useState(false);
  const [muted, setMuted] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [remoteVocalLevel, setRemoteVocalLevel] = useState(0.35);
  const [live, setLive] = useState<SessionLiveState>(defaultLiveState());
  const latencyRef = useRef(26);
  const vocalPhaseRef = useRef(0);

  const [demoClock, setDemoClock] = useState<DemoClock>({
    totalMinutes: DEMO_TIMER_MINUTES,
    remainingSeconds: DEMO_TIMER_MINUTES * 60,
    running: false,
    phase: "scheduled",
  });

  // Auto-join as engineer in demo mode when navigating directly to /live
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    if (WSTUDIO_DEMO_MODE && !role && !autoJoinedRef.current) {
      autoJoinedRef.current = true;
      const id = generateMockSessionId();
      setSessionId(id);
      setRole("engineer");
      setConnection("connected");
      setSessionDisplayName(`Session: ${DEMO_SESSION_TITLE}`);
      setDemoClock({
        totalMinutes: DEMO_TIMER_MINUTES,
        remainingSeconds: DEMO_TIMER_MINUTES * 60,
        running: true,
        phase: "live",
      });
    }
  }, [role]);

  useEffect(() => {
    if (!sessionId.trim() || !role) {
      setLive(defaultLiveState());
      return;
    }
    return subscribeLive(sessionId, setLive);
  }, [sessionId, role]);

  useEffect(() => {
    if (!talkbackHeld) return;
    const end = () => {
      setTalkbackHeld(false);
      if (role === "engineer") writeLive(sessionId, { engineerPtt: false });
      if (role === "artist") writeLive(sessionId, { artistPtt: false });
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
    };
  }, [talkbackHeld, role, sessionId]);

  const beginTalkback = useCallback(() => {
    if (talkbackHeld) return;
    setTalkbackHeld(true);
    if (role === "engineer") writeLive(sessionId, { engineerPtt: true });
    if (role === "artist") writeLive(sessionId, { artistPtt: true });
  }, [talkbackHeld, role, sessionId]);

  const endTalkback = useCallback(() => {
    setTalkbackHeld(false);
    if (role === "engineer") writeLive(sessionId, { engineerPtt: false });
    if (role === "artist") writeLive(sessionId, { artistPtt: false });
  }, [role, sessionId]);

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
    setTalkbackHeld(false);
    setMuted(false);
    setScreenSharing(false);
    setSessionDisplayName("");
    setLive(defaultLiveState());
    setDemoClock({
      totalMinutes: DEMO_TIMER_MINUTES,
      remainingSeconds: DEMO_TIMER_MINUTES * 60,
      running: false,
      phase: "scheduled",
    });
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      if (role === "artist" && sessionId.trim()) writeLive(sessionId, { artistMuted: next });
      return next;
    });
  }, [role, sessionId]);

  const toggleScreenShare = useCallback(() => {
    setScreenSharing((prev) => {
      const next = !prev;
      if (role === "engineer" && sessionId.trim()) writeLive(sessionId, { screenShareActive: next });
      return next;
    });
  }, [role, sessionId]);

  const setSessionRecording = useCallback(
    (recording: boolean) => {
      if (role !== "engineer" || !sessionId.trim()) return;
      writeLive(sessionId, { recording });
    },
    [role, sessionId],
  );

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

  const collaborationShareActive =
    (role === "engineer" && screenSharing) || (role === "artist" && live.screenShareActive);

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
      talkbackHeld,
      beginTalkback,
      endTalkback,
      talkbackOn: talkbackHeld,
      toggleTalkback: () => {},
      muted,
      toggleMute,
      latencyMs: connection === "connected" ? latencyRef.current : 0,
      screenSharing,
      toggleScreenShare,
      remoteVocalLevel: connection === "connected" ? remoteVocalLevel : 0,
      demoClock,
      demoWarningLevel: demoWarn,
      startDemoSessionClock,
      live,
      setSessionRecording,
      collaborationShareActive,
    }),
    [
      sessionId,
      sessionDisplayName,
      role,
      connection,
      joinAsArtist,
      joinAsEngineer,
      leaveSession,
      talkbackHeld,
      beginTalkback,
      endTalkback,
      muted,
      toggleMute,
      screenSharing,
      toggleScreenShare,
      remoteVocalLevel,
      demoClock,
      demoWarn,
      startDemoSessionClock,
      live,
      setSessionRecording,
      collaborationShareActive,
    ],
  );

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession() {
  const v = useContext(SessionCtx);
  if (!v) throw new Error("useSession requires SessionProvider");
  return v;
}
