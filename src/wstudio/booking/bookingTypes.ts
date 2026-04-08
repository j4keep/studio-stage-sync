export type SessionPhase = "scheduled" | "live" | "ended";

export type TimerWarningLevel = "ok" | "caution" | "warning" | "critical";

export type EngineerBookingProfile = {
  hourlyRate: number;
  minimumBookingMinutes: number;
  maxExtensionMinutes: number;
  /** Charged per hour for approved extensions (typically ≥ hourlyRate). */
  overtimeHourlyRate: number;
  /** Allow artists to request more time during session. */
  extensionsEnabled: boolean;
};

export type SessionBookingRecord = {
  sessionId: string;
  scheduledStartIso: string;
  bookedMinutes: number;
  /** Rate snapshot at booking for display / receipts. */
  hourlyRateSnapshot: number;
  /** Pre-tax session value for initial block. */
  initialSessionValue: number;
  extraApprovedMinutes: number;
  extensionChargesTotal: number;
  timerStartedAt: number | null;
  consumedSeconds: number;
  timerRunning: boolean;
  phase: SessionPhase;
  pendingExtension: PendingExtension | null;
};

export type PendingExtension = {
  id: string;
  minutes: 15 | 30 | 60;
  requestedAt: number;
};

export const DEFAULT_ENGINEER_PROFILE: EngineerBookingProfile = {
  hourlyRate: 85,
  minimumBookingMinutes: 60,
  maxExtensionMinutes: 120,
  overtimeHourlyRate: 125,
  extensionsEnabled: true,
};

export function computeInitialSessionValue(
  bookedMinutes: number,
  hourlyRate: number,
): number {
  return Math.round((bookedMinutes / 60) * hourlyRate * 100) / 100;
}

export function extensionCost(minutes: number, overtimeHourlyRate: number): number {
  return Math.round((minutes / 60) * overtimeHourlyRate * 100) / 100;
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

export function formatDurationMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rs = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(rs).padStart(2, "0")}`;
  return `${m}:${String(rs).padStart(2, "0")}`;
}
