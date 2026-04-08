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
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSession } from "../session/SessionContext";
import type {
  EngineerBookingProfile,
  PendingExtension,
  SessionBookingRecord,
  TimerWarningLevel,
} from "./bookingTypes";
import {
  computeInitialSessionValue,
  extensionCost,
} from "./bookingTypes";
import { loadEngineerProfile, saveEngineerProfile } from "./engineerProfileStorage";
import { loadSessionBooking, saveSessionBooking } from "./sessionBookingStorage";
import { loadSessionRates, publishEngineerRatesToSession } from "./sessionRatesStorage";

export type { TimerWarningLevel };

export type BookingTimerContextValue = {
  engineerProfile: EngineerBookingProfile;
  setEngineerProfile: (p: EngineerBookingProfile) => void;
  publishRatesToCurrentSession: () => void;
  sessionRates: EngineerBookingProfile;
  booking: SessionBookingRecord | null;
  /** Create / replace booking for current session (artist). */
  createBooking: (args: {
    scheduledStartIso: string;
    bookedMinutes: number;
  }) => { ok: boolean; error?: string };
  /** Wall-clock total purchased (initial + approved extensions). */
  totalBookedMinutes: number;
  remainingSeconds: number;
  warningLevel: TimerWarningLevel;
  /** Running session timer (engineer started). */
  timerRunning: boolean;
  phase: SessionBookingRecord["phase"];
  pendingExtension: PendingExtension | null;
  sessionValueTotal: number;
  startSessionTimer: () => void;
  requestExtension: (minutes: 15 | 30 | 60) => void;
  approveExtension: () => void;
  declineExtension: () => void;
  /** Engineer explicitly continues after decline / at zero — one-shot grace (adds 5 min demo) or un-end */
  engineerContinueSession: () => void;
  extensionModalOpen: boolean;
  setExtensionModalOpen: (v: boolean) => void;
  controlsLocked: boolean;
};

const Ctx = createContext<BookingTimerContextValue | null>(null);

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyBooking(sessionId: string): SessionBookingRecord {
  return {
    sessionId: sessionId.trim(),
    scheduledStartIso: new Date().toISOString(),
    bookedMinutes: 0,
    hourlyRateSnapshot: 0,
    initialSessionValue: 0,
    extraApprovedMinutes: 0,
    extensionChargesTotal: 0,
    timerStartedAt: null,
    consumedSeconds: 0,
    timerRunning: false,
    phase: "scheduled",
    pendingExtension: null,
  };
}

export function BookingTimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { sessionId, role } = useSession();
  const [engineerProfile, setEngineerProfileState] = useState<EngineerBookingProfile>(() =>
    loadEngineerProfile(user?.id),
  );
  const [booking, setBooking] = useState<SessionBookingRecord | null>(null);
  const [ratesRevision, setRatesRevision] = useState(0);
  const [extensionModalOpen, setExtensionModalOpen] = useState(false);

  const warnedRef = useRef({ m15: false, m5: false, m1: false });
  const pendingToastRef = useRef<string | null>(null);

  const sessionRates = useMemo(() => loadSessionRates(sessionId), [sessionId, ratesRevision]);

  useEffect(() => {
    setEngineerProfileState(loadEngineerProfile(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (!sessionId.trim()) {
      setBooking(null);
      return;
    }
    const loaded = loadSessionBooking(sessionId);
    setBooking(loaded);
    warnedRef.current = { m15: false, m5: false, m1: false };
    pendingToastRef.current = null;
  }, [sessionId]);

  const persist = useCallback((next: SessionBookingRecord) => {
    saveSessionBooking(next);
    setBooking(next);
  }, []);

  useEffect(() => {
    if (!sessionId.trim()) return;
    const key = `wstudio_booking_v1_${sessionId.trim()}`;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || !e.newValue) return;
      try {
        setBooking(JSON.parse(e.newValue) as SessionBookingRecord);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [sessionId]);

  const setEngineerProfile = useCallback(
    (p: EngineerBookingProfile) => {
      setEngineerProfileState(p);
      if (user?.id) saveEngineerProfile(user.id, p);
    },
    [user?.id],
  );

  const publishRatesToCurrentSession = useCallback(() => {
    if (!sessionId.trim()) return;
    publishEngineerRatesToSession(sessionId, user?.id);
    setRatesRevision((n) => n + 1);
    toast.success("Session rate card published", {
      description: "Artists booking this session ID will see these rates.",
    });
  }, [sessionId, user?.id]);

  const createBooking = useCallback(
    (args: { scheduledStartIso: string; bookedMinutes: number }): { ok: boolean; error?: string } => {
      if (!sessionId.trim()) return { ok: false, error: "Enter a session ID first." };
      const rates = loadSessionRates(sessionId);
      if (args.bookedMinutes < rates.minimumBookingMinutes) {
        return {
          ok: false,
          error: `Minimum booking is ${rates.minimumBookingMinutes} minutes for this engineer.`,
        };
      }
      const initialSessionValue = computeInitialSessionValue(args.bookedMinutes, rates.hourlyRate);
      const next: SessionBookingRecord = {
        ...emptyBooking(sessionId),
        scheduledStartIso: args.scheduledStartIso,
        bookedMinutes: args.bookedMinutes,
        hourlyRateSnapshot: rates.hourlyRate,
        initialSessionValue,
        phase: "scheduled",
      };
      persist(next);
      toast.success("Booking confirmed", {
        description: `Total: ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(initialSessionValue)}`,
      });
      return { ok: true };
    },
    [sessionId, persist],
  );

  const totalBookedMinutes = booking
    ? booking.bookedMinutes + booking.extraApprovedMinutes
    : 0;

  const remainingSeconds = useMemo(() => {
    if (!booking) return 0;
    const cap = totalBookedMinutes * 60;
    return Math.max(0, cap - booking.consumedSeconds);
  }, [booking, totalBookedMinutes]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setBooking((b) => {
        if (!b || b.phase !== "live" || !b.timerRunning) return b;
        const cap = (b.bookedMinutes + b.extraApprovedMinutes) * 60;
        const nextConsumed = Math.min(cap, b.consumedSeconds + 1);
        const next: SessionBookingRecord = { ...b, consumedSeconds: nextConsumed };
        if (nextConsumed >= cap && cap > 0) {
          next.phase = "ended";
          next.timerRunning = false;
          toast.error("Session time expired", {
            description: "Controls are locked until review or download.",
          });
        }
        saveSessionBooking(next);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!booking || booking.phase !== "live" || !booking.timerRunning) return;
    const rs = remainingSeconds;
    if (rs <= 60 && !warnedRef.current.m1) {
      warnedRef.current.m1 = true;
      toast.warning("1 minute remaining", { description: "Wrap the take or request more time." });
    } else if (rs <= 300 && !warnedRef.current.m5) {
      warnedRef.current.m5 = true;
      toast.warning("5 minutes remaining", { description: "Plan your last passes." });
    } else if (rs <= 900 && !warnedRef.current.m15) {
      warnedRef.current.m15 = true;
      toast.info("15 minutes remaining", { description: "Session block nearing its end." });
    }
  }, [remainingSeconds, booking]);

  useEffect(() => {
    if (!booking?.pendingExtension || role !== "engineer") return;
    if (pendingToastRef.current === booking.pendingExtension.id) return;
    pendingToastRef.current = booking.pendingExtension.id;
    toast.message("Extension request pending", {
      description: `Artist requested +${booking.pendingExtension.minutes} min.`,
    });
    setExtensionModalOpen(true);
  }, [booking?.pendingExtension, role]);

  const startSessionTimer = useCallback(() => {
    if (!booking || booking.phase === "ended") return;
    const next: SessionBookingRecord = {
      ...booking,
      timerStartedAt: booking.timerStartedAt ?? Date.now(),
      timerRunning: true,
      phase: "live",
    };
    warnedRef.current = { m15: false, m5: false, m1: false };
    persist(next);
    toast.success("Session timer running", {
      description: "Countdown is live for both sides.",
    });
  }, [booking, persist]);

  const requestExtension = useCallback(
    (minutes: 15 | 30 | 60) => {
      if (!booking || booking.phase === "ended") return;
      if (booking.phase !== "live") {
        toast.message("Session not live yet", {
          description: "The engineer will start the timer when you are rolling.",
        });
        return;
      }
      const rates = loadSessionRates(sessionId);
      if (!rates.extensionsEnabled) {
        toast.error("Extensions disabled", { description: "This engineer is not accepting extensions." });
        return;
      }
      if (booking.extraApprovedMinutes + minutes > rates.maxExtensionMinutes) {
        toast.error("Extension limit", {
          description: `Max additional time for this session is ${rates.maxExtensionMinutes} min total.`,
        });
        return;
      }
      if (booking.pendingExtension) {
        toast.message("Request already pending");
        return;
      }
      const pending: PendingExtension = { id: makeId(), minutes, requestedAt: Date.now() };
      persist({ ...booking, pendingExtension: pending });
      toast.success("Extension requested", {
        description: `Awaiting engineer approval (+${minutes} min).`,
      });
    },
    [booking, sessionId, persist],
  );

  const approveExtension = useCallback(() => {
    if (!booking?.pendingExtension) return;
    const rates = loadSessionRates(sessionId);
    const add = booking.pendingExtension.minutes;
    const charge = extensionCost(add, rates.overtimeHourlyRate);
    const next: SessionBookingRecord = {
      ...booking,
      extraApprovedMinutes: booking.extraApprovedMinutes + add,
      extensionChargesTotal: booking.extensionChargesTotal + charge,
      pendingExtension: null,
    };
    if (booking.phase === "ended") {
      next.phase = "live";
      next.timerRunning = true;
    }
    warnedRef.current = { m15: false, m5: false, m1: false };
    persist(next);
    setExtensionModalOpen(false);
    toast.success("Extension approved", {
      description: `+${add} min · ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(charge)} added.`,
    });
  }, [booking, sessionId, persist]);

  const declineExtension = useCallback(() => {
    if (!booking?.pendingExtension) return;
    persist({ ...booking, pendingExtension: null });
    setExtensionModalOpen(false);
    toast.message("Extension declined", {
      description: "Session ends at the original block unless you choose to continue.",
    });
  }, [booking, persist]);

  const engineerContinueSession = useCallback(() => {
    if (!booking) return;
    const graceMin = 5;
    const rates = loadSessionRates(sessionId);
    const charge = extensionCost(graceMin, rates.overtimeHourlyRate);
    const next: SessionBookingRecord = {
      ...booking,
      extraApprovedMinutes: booking.extraApprovedMinutes + graceMin,
      extensionChargesTotal: booking.extensionChargesTotal + charge,
      phase: "live",
      timerRunning: true,
    };
    warnedRef.current = { m15: false, m5: false, m1: false };
    persist(next);
    toast.success("Continuing session", {
      description: `+${graceMin} min engineer grace at overtime rate.`,
    });
  }, [booking, sessionId, persist]);

  const sessionValueTotal = booking
    ? booking.initialSessionValue + booking.extensionChargesTotal
    : 0;

  const warningLevel: TimerWarningLevel = useMemo(() => {
    if (!booking || booking.phase !== "live") return "ok";
    const rs = remainingSeconds;
    if (rs <= 60) return "critical";
    if (rs <= 300) return "warning";
    if (rs <= 900) return "caution";
    return "ok";
  }, [booking, remainingSeconds]);

  const controlsLocked = booking?.phase === "ended";

  const value = useMemo<BookingTimerContextValue>(
    () => ({
      engineerProfile,
      setEngineerProfile,
      publishRatesToCurrentSession,
      sessionRates,
      booking,
      createBooking,
      totalBookedMinutes,
      remainingSeconds,
      warningLevel,
      timerRunning: booking?.timerRunning ?? false,
      phase: booking?.phase ?? "scheduled",
      pendingExtension: booking?.pendingExtension ?? null,
      sessionValueTotal,
      startSessionTimer,
      requestExtension,
      approveExtension,
      declineExtension,
      engineerContinueSession,
      extensionModalOpen,
      setExtensionModalOpen,
      controlsLocked,
    }),
    [
      engineerProfile,
      setEngineerProfile,
      publishRatesToCurrentSession,
      sessionRates,
      booking,
      createBooking,
      totalBookedMinutes,
      remainingSeconds,
      warningLevel,
      startSessionTimer,
      requestExtension,
      approveExtension,
      declineExtension,
      engineerContinueSession,
      extensionModalOpen,
      sessionValueTotal,
      controlsLocked,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBookingTimer() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBookingTimer requires BookingTimerProvider");
  return v;
}
