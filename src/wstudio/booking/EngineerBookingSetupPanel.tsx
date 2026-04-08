import { useEffect, useState } from "react";
import { BadgeCent, Clock } from "lucide-react";
import { useBookingTimer } from "./BookingTimerContext";
import type { EngineerBookingProfile } from "./bookingTypes";
import { formatCurrency } from "./bookingTypes";

export function EngineerBookingSetupPanel() {
  const {
    sessionId,
    engineerProfile,
    setEngineerProfile,
    publishRatesToCurrentSession,
  } = useBookingTimer();
  const [local, setLocal] = useState<EngineerBookingProfile>(engineerProfile);

  useEffect(() => {
    setLocal(engineerProfile);
  }, [engineerProfile]);

  const update = <K extends keyof EngineerBookingProfile>(key: K, value: EngineerBookingProfile[K]) => {
    setLocal((p) => ({ ...p, [key]: value }));
  };

  const saveProfile = () => {
    setEngineerProfile(local);
  };

  if (!sessionId.trim()) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-emerald-900/25 bg-gradient-to-b from-zinc-900/80 to-zinc-950 p-5 ring-1 ring-emerald-500/10">
      <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-300/80">
        <BadgeCent className="h-3.5 w-3.5" aria-hidden />
        Engineer rate card
      </div>
      <p className="mb-4 text-[11px] leading-relaxed text-zinc-500">
        Saved to your profile. Publish to this session ID so artists see the same numbers when they book.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Hourly rate ($)
          <input
            type="number"
            min={1}
            step={1}
            value={local.hourlyRate}
            onChange={(e) => update("hourlyRate", Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Overtime / ext. rate ($/hr)
          <input
            type="number"
            min={1}
            step={1}
            value={local.overtimeHourlyRate}
            onChange={(e) => update("overtimeHourlyRate", Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          <Clock className="mb-0.5 inline h-3 w-3" aria-hidden /> Min booking (min)
          <input
            type="number"
            min={15}
            step={15}
            value={local.minimumBookingMinutes}
            onChange={(e) => update("minimumBookingMinutes", Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Max extension (min total)
          <input
            type="number"
            min={0}
            step={15}
            value={local.maxExtensionMinutes}
            onChange={(e) => update("maxExtensionMinutes", Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
        </label>
      </div>
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={local.extensionsEnabled}
          onChange={(e) => update("extensionsEnabled", e.target.checked)}
          className="rounded border-zinc-600"
        />
        Allow in-session extension requests
      </label>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={saveProfile}
          className="flex-1 rounded-xl border border-zinc-600 bg-zinc-800 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
        >
          Save profile
        </button>
        <button
          type="button"
          onClick={publishRatesToCurrentSession}
          className="flex-1 rounded-xl border border-emerald-600/40 bg-emerald-950/50 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-900/40"
        >
          Publish to session ID
        </button>
      </div>
      <p className="mt-3 text-center text-[10px] text-zinc-600">
        Preview: {formatCurrency(local.hourlyRate)} / hr studio ·{" "}
        {formatCurrency(local.overtimeHourlyRate)} / hr extensions
      </p>
    </div>
  );
}
