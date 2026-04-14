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
  readLive,
  subscribeLive,
  writeLive,
  type SessionLiveState,
} from "./sessionLiveSync";
import { useAuth } from "@/contexts/AuthContext";
import type { User } from "@supabase/supabase-js";

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

function formatSessionLabel(id: string): string {
  return `Session: ${id.toUpperCase()}`;
}

function joinPatch(role: Role): Partial<SessionLiveState> {
  return role === "engineer" ? { engineerJoined: true } : role === "artist" ? { artistJoined: true } : {};
}

function leavePatch(role: Role): Partial<SessionLiveState> {
  if (role === "engineer") {
    return {
      engineerJoined: false,
      engineerPtt: false,
      screenShareActive: false,
      recording: false,
      playing: false,
      recordArmed: false,
      takeCapturedThisSession: false,
    };
  }
  if (role === "artist") {
    return {
      artistJoined: false,
      artistPtt: false,
      artistMuted: false,
      remoteArtistLabel: "",
    };
  }
  return {};
}

export type SessionContextValue = {
  demoMode: boolean;
  sessionId: string;
  setSessionId: (id: string) => void;
  sessionDisplayName: string;
  role: Role;
  connection: ConnectionState;
  joinAsArtist: (overrideSessionId?: string) => void;
  joinAsEngineer: (overrideSessionId?: string) => void;
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
  demoClock: DemoClock;
  demoWarningLevel: TimerWarningLevel;
  startDemoSessionClock: () => void;
  /** Synced session state (recording, peer PTT, share, artist mute) */
  live: SessionLiveState;
  setSessionRecording: (recording: boolean) => void;
  setSessionPlaying: (playing: boolean) => void;
  setSessionRecordArmed: (armed: boolean) => void;
  updateSessionMonitorLevels: (patch: {
    vocalLevel?: number;
    talkbackLevel?: number;
    cueMix?: number;
  }) => void;
  /** Local headphone output level for the current role only (not synced across users). */
  updateSessionHeadphoneLevel: (level: number) => void;
  /** True when engineer has share on OR live says share active (for artist view) */
  collaborationShareActive: boolean;
};

const SessionCtx = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState("");
  const [sessionDisplayName, setSessionDisplayName] = useState("");
  const [role, setRole] = useState<Role>(null);
  const [connection, setConnection] = useState<ConnectionState>("disconnected");
  const [talkbackHeld, setTalkbackHeld] = useState(false);
  const [muted, setMuted] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [live, setLive] = useState<SessionLiveState>(defaultLiveState());
  const latencyRef = useRef(26);

  const [demoClock, setDemoClock] = useState<DemoClock>({
    totalMinutes: DEMO_TIMER_MINUTES,
    remainingSeconds: DEMO_TIMER_MINUTES * 60,
    running: false,
    phase: "scheduled",
  });

  useEffect(() => {
    if (!sessionId.trim() || !role) {
      setLive(defaultLiveState());
      return;
    }
    return subscribeLive(sessionId, setLive);
  }, [sessionId, role]);

  useEffect(() => {
    if (WSTUDIO_DEMO_MODE || !sessionId.trim() || !role) return;
    writeLive(sessionId, joinPatch(role));
    return () => {
      writeLive(sessionId, leavePatch(role));
    };
  }, [sessionId, role]);

  useEffect(() => {
    if (WSTUDIO_DEMO_MODE) return;
    if (!sessionId.trim() || !role) {
      setConnection("disconnected");
      return;
    }
    setConnection(live.artistJoined && live.engineerJoined ? "connected" : "connecting");
  }, [sessionId, role, live.artistJoined, live.engineerJoined]);

  useEffect(() => {
    if (role !== "artist") return;
    setMuted(live.artistMuted);
  }, [role, live.artistMuted]);

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

  const joinAsArtist = useCallback(
    (overrideSessionId?: string) => {
      const id = overrideSessionId?.trim() || sessionId.trim() || generateMockSessionId();
      setSessionId(id);
      setRole("artist");
      setMuted(false);
      setTalkbackHeld(false);
      setLive((prev) => ({
        ...prev,
        artistMuted: false,
        artistPtt: false,
      }));
      latencyRef.current = 22 + Math.floor(Math.random() * 12);
      setSessionDisplayName(WSTUDIO_DEMO_MODE ? `Session: ${DEMO_SESSION_TITLE}` : formatSessionLabel(id));
      if (WSTUDIO_DEMO_MODE) {
        setConnection("connected");
        setDemoClock({
          totalMinutes: DEMO_TIMER_MINUTES,
          remainingSeconds: DEMO_TIMER_MINUTES * 60,
          running: true,
          phase: "live",
        });
      } else {
        setConnection("connecting");
      }
      const label = WSTUDIO_DEMO_MODE ? "Jay — Florida" : (user?.email?.split("@")[0] ?? "Remote artist");
      queueMicrotask(() => {
        if (id.trim()) {
          writeLive(id, {
            remoteArtistLabel: label || "Remote artist",
            artistMuted: false,
            artistPtt: false,
          });
        }
      });
    },
    [sessionId, user],
  );

  const joinAsEngineer = useCallback((overrideSessionId?: string) => {
    const id = overrideSessionId?.trim() || sessionId.trim() || generateMockSessionId();
    setSessionId(id);
    setRole("engineer");
    setMuted(false);
    setTalkbackHeld(false);
    latencyRef.current = 20 + Math.floor(Math.random() * 14);
    setSessionDisplayName(WSTUDIO_DEMO_MODE ? `Session: ${DEMO_SESSION_TITLE}` : formatSessionLabel(id));
    if (WSTUDIO_DEMO_MODE) {
      setConnection("connected");
      setDemoClock({
        totalMinutes: DEMO_TIMER_MINUTES,
        remainingSeconds: DEMO_TIMER_MINUTES * 60,
        running: true,
        phase: "live",
      });
    } else {
      setConnection("connecting");
    }
  }, [sessionId]);

  const leaveSession = useCallback(() => {
    if (sessionId.trim() && role) {
      writeLive(sessionId, leavePatch(role));
    }
    setSessionId("");
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
  }, [role, sessionId]);

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
      const s = readLive(sessionId);
      if (recording) {
        if (!s.recordArmed) return;
        writeLive(sessionId, { recording: true, recordArmed: false });
        return;
      }
      const patch: Partial<SessionLiveState> = { recording: false };
      if (s.recording) patch.takeCapturedThisSession = true;
      writeLive(sessionId, patch);
    },
    [role, sessionId],
  );

  const setSessionPlaying = useCallback(
    (playing: boolean) => {
      if (role !== "engineer" || !sessionId.trim()) return;
      writeLive(sessionId, { playing });
    },
    [role, sessionId],
  );

  const setSessionRecordArmed = useCallback(
    (armed: boolean) => {
      if (role !== "engineer" || !sessionId.trim()) return;
      if (readLive(sessionId).recording) return;
      writeLive(sessionId, { recordArmed: armed });
    },
    [role, sessionId],
  );

  const updateSessionMonitorLevels = useCallback(
    (patch: { vocalLevel?: number; talkbackLevel?: number; cueMix?: number }) => {
      if (!sessionId.trim() || role !== "engineer") return;
      const clamp = (n: number) => Math.min(1, Math.max(0, n));
      const next: Partial<SessionLiveState> = {};
      if (patch.vocalLevel !== undefined) next.vocalLevel = clamp(patch.vocalLevel);
      if (patch.talkbackLevel !== undefined) next.talkbackLevel = clamp(patch.talkbackLevel);
      if (patch.cueMix !== undefined) next.cueMix = clamp(patch.cueMix);
      if (Object.keys(next).length) writeLive(sessionId, next);
    },
    [sessionId, role],
  );

  const updateSessionHeadphoneLevel = useCallback(
    (level: number) => {
      if (!sessionId.trim() || (role !== "engineer" && role !== "artist")) return;
      const v = Math.min(1, Math.max(0, level));
      if (role === "engineer") writeLive(sessionId, { headphoneLevelEngineer: v });
      else writeLive(sessionId, { headphoneLevelArtist: v });
    },
    [sessionId, role],
  );

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
      demoClock,
      demoWarningLevel: demoWarn,
      startDemoSessionClock,
      live,
      setSessionRecording,
      setSessionPlaying,
      setSessionRecordArmed,
      updateSessionMonitorLevels,
      updateSessionHeadphoneLevel,
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
      demoClock,
      demoWarn,
      startDemoSessionClock,
      live,
      setSessionRecording,
      setSessionPlaying,
      setSessionRecordArmed,
      updateSessionMonitorLevels,
      updateSessionHeadphoneLevel,
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
