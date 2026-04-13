import type { AudioInputDevice } from "./useBridgeInputDevice";

export function BridgeDawReturn({
  inputDevices,
  dawReturnDeviceId,
  setDawReturnDeviceId,
  dawReturnActive,
  dawReturnLevel,
  startDawReturn,
  stopDawReturn,
  refreshInputDevices,
  sessionActive,
}: {
  inputDevices: AudioInputDevice[];
  dawReturnDeviceId: string;
  setDawReturnDeviceId: (id: string) => void;
  dawReturnActive: boolean;
  dawReturnLevel: number;
  startDawReturn: () => void;
  stopDawReturn: () => void;
  refreshInputDevices: () => void;
  sessionActive: boolean;
}) {
  const returnSignalDetected = dawReturnLevel >= 0.035;

  return (
    <section className="space-y-3 rounded-lg border border-violet-900/40 bg-violet-950/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300/80">Return from DAW</div>
          <p className="mt-0.5 text-[11px] text-zinc-500">DAW playback → artist headphones (monitor only — does not affect recording)</p>
        </div>
        <button type="button" onClick={refreshInputDevices} className="text-[10px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors">
          ↻ Refresh
        </button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-zinc-400">DAW return input device</span>
        <select
          value={dawReturnDeviceId}
          onChange={(e) => setDawReturnDeviceId(e.target.value)}
          disabled={dawReturnActive}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-50"
        >
          <option value="none">— Select input —</option>
          {inputDevices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-3">
        {dawReturnActive ? (
          <button
            type="button"
            onClick={stopDawReturn}
            className="rounded-lg border border-red-700/50 bg-red-950/40 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-950/60 transition-colors"
          >
            Stop return
          </button>
        ) : (
          <button
            type="button"
            onClick={startDawReturn}
            disabled={dawReturnDeviceId === "none" || !sessionActive}
            className="rounded-lg border border-violet-700/50 bg-violet-950/40 px-4 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-950/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Start return
          </button>
        )}
        <div className="flex items-center gap-2 text-xs">
          <span
            className={
              dawReturnActive
                ? returnSignalDetected
                  ? "inline-flex h-2 w-2 animate-pulse rounded-full bg-violet-400"
                  : "inline-flex h-2 w-2 rounded-full bg-violet-600/80"
                : "inline-flex h-2 w-2 rounded-full bg-zinc-600"
            }
            aria-hidden
          />
          <span className={dawReturnActive ? "text-violet-300 font-semibold" : "text-zinc-500"}>
            {dawReturnActive ? (returnSignalDetected ? "SENDING" : "ACTIVE · quiet") : "OFF"}
          </span>
        </div>
      </div>

      {/* DAW return level meter */}
      {dawReturnActive && (
        <div>
          <div className="mb-1.5 flex items-end justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300/60">Return level</span>
            <span className="font-mono text-xs text-zinc-400 tabular-nums">{Math.round(dawReturnLevel * 100)}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-zinc-950 ring-1 ring-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-800 via-violet-400 to-fuchsia-400 transition-[width] duration-75"
              style={{ width: `${Math.round(Math.min(1, dawReturnLevel) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="rounded-md border border-zinc-800/60 bg-zinc-900/30 p-3 text-[11px] leading-relaxed text-zinc-500 space-y-1.5">
        <p className="font-semibold text-zinc-400">How it works:</p>
        <p>1. Set your DAW output (Logic / Pro Tools) to <span className="text-violet-300/80">BlackHole</span> or <span className="text-violet-300/80">VB-Cable</span></p>
        <p>2. Select the same device above as the return input</p>
        <p>3. Click <span className="text-violet-300/80">Start return</span> — DAW playback streams to the artist</p>
        <p className="text-zinc-600 mt-1">Artist hears: engineer talkback + DAW playback + beats + takes</p>
      </div>
    </section>
  );
}
