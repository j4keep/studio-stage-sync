export function BridgeAudioLink({
  vocalPathReady,
  hasRemoteAudio,
  feedStatusLabel,
  signalDetected,
  feedInactiveReason,
}: {
  vocalPathReady: boolean;
  hasRemoteAudio: boolean;
  feedStatusLabel: string;
  signalDetected: boolean;
  feedInactiveReason: string | null;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Audio link</div>
        <div
          className={
            vocalPathReady
              ? "text-sm font-semibold text-emerald-400"
              : hasRemoteAudio
                ? "text-sm font-semibold text-amber-300"
                : "text-sm font-semibold text-zinc-500"
          }
        >
          {vocalPathReady ? "Connected" : hasRemoteAudio ? "Connecting" : "Disconnected"}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/80 pt-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Artist vocal feed</div>
        <div className="flex items-center gap-2">
          <span
            className={
              feedStatusLabel.startsWith("ACTIVE")
                ? signalDetected
                  ? "inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-400"
                  : "inline-flex h-2 w-2 rounded-full bg-emerald-600/80"
                : "inline-flex h-2 w-2 rounded-full bg-zinc-600"
            }
            aria-hidden
          />
          <span className={feedStatusLabel.startsWith("ACTIVE") ? "text-sm font-bold text-emerald-400" : "text-sm font-bold text-zinc-500"}>
            {feedStatusLabel}
          </span>
        </div>
      </div>
      {feedInactiveReason && <p className="text-xs text-zinc-500">{feedInactiveReason}</p>}
    </section>
  );
}
