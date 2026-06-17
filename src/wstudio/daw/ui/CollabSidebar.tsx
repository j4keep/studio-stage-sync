import { useState } from "react";
import { Users, Monitor, Copy, X } from "lucide-react";

interface Props {
  sessionCode: string | null;
  onClose?: () => void;
}

export function CollabSidebar({ sessionCode, onClose }: Props) {
  const [shared, setShared] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startShare = async () => {
    try {
      const s = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: true });
      setStream(s);
      setShared(true);
      s.getVideoTracks()[0].onended = () => { setShared(false); setStream(null); };
    } catch {}
  };
  const stopShare = () => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null); setShared(false);
  };

  return (
    <div className="w-64 shrink-0 bg-neutral-950 border-l border-neutral-800 flex flex-col">
      <div className="h-10 border-b border-neutral-800 flex items-center px-3 gap-2">
        <Users className="w-4 h-4 text-cyan-400" />
        <div className="text-sm text-neutral-200">Session</div>
        <div className="flex-1" />
        {onClose && <button onClick={onClose} className="text-neutral-500 hover:text-white"><X className="w-4 h-4" /></button>}
      </div>

      {sessionCode ? (
        <div className="p-3 border-b border-neutral-800">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">Join code</div>
          <div className="flex items-center gap-2 bg-black border border-neutral-800 rounded px-3 py-2">
            <span className="font-mono text-lg text-cyan-300 tracking-widest flex-1">{sessionCode}</span>
            <button
              onClick={() => navigator.clipboard.writeText(sessionCode)}
              className="text-neutral-400 hover:text-white"
            ><Copy className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ) : (
        <div className="p-3 border-b border-neutral-800 text-[11px] text-neutral-500">
          Solo session. Use W.Studio → Session to invite others.
        </div>
      )}

      <div className="p-3 border-b border-neutral-800">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">Video chat</div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="aspect-video rounded bg-gradient-to-br from-cyan-900/40 to-neutral-900 border border-cyan-500/30 grid place-items-center text-[10px] text-cyan-300">YOU</div>
          <div className="aspect-video rounded bg-neutral-900 border border-dashed border-neutral-800 grid place-items-center text-[9px] text-neutral-600">Empty</div>
          <div className="aspect-video rounded bg-neutral-900 border border-dashed border-neutral-800 grid place-items-center text-[9px] text-neutral-600">Empty</div>
          <div className="aspect-video rounded bg-neutral-900 border border-dashed border-neutral-800 grid place-items-center text-[9px] text-neutral-600">Empty</div>
        </div>
      </div>

      <div className="p-3 border-b border-neutral-800">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">Participants</div>
        <div className="flex items-center gap-2 text-xs text-neutral-300 mb-1">
          <div className="w-6 h-6 rounded-full bg-cyan-500/20 grid place-items-center text-cyan-300 text-[10px]">YOU</div>
          <span>You</span>
          <span className="ml-auto text-[10px] text-emerald-400">●</span>
        </div>
      </div>

      <div className="p-3 border-b border-neutral-800">
        <button
          onClick={shared ? stopShare : startShare}
          className={`w-full h-9 rounded border flex items-center justify-center gap-2 text-xs ${shared ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300" : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800"}`}
        >
          <Monitor className="w-4 h-4" />
          {shared ? "Sharing screen" : "Share screen"}
        </button>
      </div>

      <div className="flex-1" />
      <div className="p-3 text-[10px] text-neutral-600 text-center border-t border-neutral-800">
        W.STUDIO · DAW v1
      </div>
    </div>
  );
}
