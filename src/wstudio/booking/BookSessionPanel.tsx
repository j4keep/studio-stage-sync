import { useMemo, useState } from "react";
import { CalendarClock, Sparkles } from "lucide-react";
import { useSession } from "../session/SessionContext";
import { useBookingTimer } from "./BookingTimerContext";
import {
  computeInitialSessionValue,
  formatCurrency,
  formatDurationMinutes,
} from "./bookingTypes";

const DURATIONS = [60, 90, 120, 180] as const;

export function BookSessionPanel() {
  const { sessionId } = useSession();
  const { sessionRates, createBooking, booking } = useBookingTimer();
  const [start, setStart] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - (d.getMinutes() % 15), 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [minutes, setMinutes] = useState<number>(120);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    const initial = computeInitialSessionValue(minutes, sessionRates.hourlyRate);
    return { initial };
  }, [minutes, sessionRates.hourlyRate]);

  const onConfirm = () => {
    setError(null);
    const iso = new Date(start).toISOString();
    const res = createBooking({ scheduledStartIso: iso, bookedMinutes: minutes });
    if (!res.ok) setError(res.error ?? "Could not create booking.");
  };

  if (!sessionId.trim()) {
    return (
      <p className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-center text-xs text-zinc-500">
        Enter a session ID to book time with this engineer&apos;s rate card.
      </p>
    );
  }

  const hasBooking = !!booking && booking.bookedMinutes > 0;

  return (
    <div className="rounded-2xl border border-amber-900/30 bg-gradient-to-b from-zinc-900/90 to-zinc-950 p-5 shadow-xl ring-1 ring-amber-500/10">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/30">
          <Sparkles className="h-5 w-5 text-amber-200" aria-hidden />
        </div>
        <div>
          <h2 className="font-display text-sm font-semibold tracking-wide text-amber-100/95">
            Book studio time
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
            Premium remote block · rates for this session ID · minimum{" "}
            {formatDurationMinutes(sessionRates.minimumBookingMinutes)}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            <CalendarClock className="h-3 w-3" aria-hidden />
            Start
          </label>
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-amber-600/60"
          />
        </div>
        <div>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Length
          </span>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(m)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                  minutes === m
                    ? "border-amber-500/60 bg-amber-950/50 text-amber-100"
                    : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {formatDurationMinutes(m)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-zinc-800 bg-black/30 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">
              Engineer rate
            </div>
            <div className="text-sm font-medium text-zinc-200">
              {formatCurrency(sessionRates.hourlyRate)} <span className="text-zinc-500">/ hour</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-amber-200/70">
              Total booked
            </div>
            <div className="font-mono text-xl font-semibold tabular-nums text-amber-100">
              {formatCurrency(preview.initial)}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-zinc-600">
          Extensions bill at {formatCurrency(sessionRates.overtimeHourlyRate)} / hr up to{" "}
          {sessionRates.maxExtensionMinutes} extra minutes total.
        </p>
      </div>

      {error ? (
        <p className="mt-3 text-center text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onConfirm}
        disabled={hasBooking}
        className="mt-4 w-full rounded-xl border border-amber-600/40 bg-gradient-to-b from-amber-700/90 to-amber-950 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-950/40 transition hover:from-amber-600 hover:to-amber-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {hasBooking ? "Booking confirmed — join below" : "Confirm booking"}
      </button>
    </div>
  );
}
