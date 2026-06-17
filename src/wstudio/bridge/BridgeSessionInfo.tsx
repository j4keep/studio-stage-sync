export function BridgeSessionInfo({
  sessionNameLine,
  sessionId,
  artistLine,
  hasRemoteAudio,
}: {
  sessionNameLine: string;
  sessionId: string;
  artistLine: string;
  hasRemoteAudio: boolean;
}) {
  return (
    <section className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 sm:grid-cols-2">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Session</div>
        <div className="mt-1 text-base font-semibold text-zinc-100">{sessionNameLine}</div>
        <div className="mt-0.5 font-mono text-xs text-zinc-500 tabular-nums">{sessionId.toUpperCase() || "—"}</div>
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">Artist</div>
        <div className="mt-1 text-base font-semibold text-zinc-100">{artistLine}</div>
        <div className="mt-1 text-xs text-zinc-500">
          {hasRemoteAudio ? (
            <span className="text-emerald-400/90">Audio connected</span>
          ) : (
            <span className="text-zinc-600">No audio yet</span>
          )}
        </div>
      </div>
    </section>
  );
}
