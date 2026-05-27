import { useEffect, useState } from "react";
import { useStudio, ConnectionStatus, ArtistStatus, HQAudioStatus } from "../state/StudioContext";

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

const pluginDot: Record<ConnectionStatus, string> = {
  disconnected: "", connecting: "warn", connected: "live", error: "err",
};
const artistDot: Record<ArtistStatus, string> = {
  waiting: "", connected: "warn", ready: "ok",
};
const hqDot: Record<HQAudioStatus, string> = {
  off: "", checking: "warn", live: "live",
};

export default function TopBar({ subtitle }: { subtitle?: string }) {
  const { session, plugin, artist, hqAudio } = useStudio();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!session) return;
    const id = window.setInterval(() => setElapsed(Date.now() - session.createdAt), 1000);
    return () => window.clearInterval(id);
  }, [session]);

  return (
    <div className="studio-card px-4 py-3 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="studio-status-dot live" />
        <span className="font-bold tracking-wider">W.STUDIO LIVE</span>
      </div>
      <div className="text-sm text-[hsl(var(--studio-text-dim))]">
        {session?.name ?? subtitle ?? "Session"}
      </div>
      <div className="font-mono text-sm text-[hsl(var(--studio-blue))] ml-auto sm:ml-0">
        {fmt(elapsed)}
      </div>
      <div className="flex items-center gap-4 ml-auto text-xs">
        <span className="flex items-center gap-1.5"><span className={`studio-status-dot ${pluginDot[plugin]}`} />Plugin · {plugin}</span>
        <span className="flex items-center gap-1.5"><span className={`studio-status-dot ${artistDot[artist]}`} />Artist · {artist}</span>
        <span className="flex items-center gap-1.5"><span className={`studio-status-dot ${hqDot[hqAudio]}`} />HQ Audio · {hqAudio}</span>
      </div>
    </div>
  );
}
