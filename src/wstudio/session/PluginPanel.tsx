import { useState, useEffect, useCallback } from "react";
import { Copy, Check, Mic, Settings, Menu, X } from "lucide-react";

const C = {
  shell: "#3a3c42",
  shellLight: "#45474d",
  panelBorder: "#4a4c52",
  inset: "#2a2c30",
  dim: "#757780",
  green: "#4ade60",
  text: "#e8e8ea",
  label: "#9a9ca2",
  blue: "#3b9dff",
  white: "#ffffff",
};

/* ── VU Meter ── */
function VUMeter({ level, peak, label, dbLabel }: { level: number; peak: number; label: string; dbLabel: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: C.label }}>{label}</span>
      <div className="relative flex gap-[3px]">
        {[level, level * 0.95].map((l, ch) => (
          <div key={ch} className="relative overflow-hidden rounded-sm" style={{ height: 130, width: 10, background: "#1e1f23", border: "1px solid #333538" }}>
            <div
              className="absolute bottom-0 left-0 w-full rounded-sm transition-[height] duration-75"
              style={{
                height: `${Math.min(100, l * 100)}%`,
                background: "linear-gradient(to top, #22c55e 0%, #22c55e 55%, #eab308 75%, #ef4444 100%)",
              }}
            />
            <div
              className="absolute left-0 w-full transition-[bottom] duration-200"
              style={{ height: 2, bottom: `${Math.min(100, (ch === 0 ? peak : peak * 0.95) * 100)}%`, background: "rgba(255,255,255,0.8)" }}
            />
            {[0, 25, 50, 75, 100].map((p) => (
              <div key={p} className="absolute left-0 w-full" style={{ height: 1, bottom: `${p}%`, background: "rgba(100,100,100,0.3)" }} />
            ))}
          </div>
        ))}
      </div>
      <span className="font-mono text-[11px] font-bold" style={{ color: C.text }}>{dbLabel}</span>
    </div>
  );
}

/* ── Live Button ── */
function LiveButton({ isLive, onClick }: { isLive: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="relative flex items-center justify-center">
      <div
        className={`absolute inset-0 rounded-full transition-all duration-500 ${
          isLive
            ? "bg-[radial-gradient(circle,_hsl(200,80%,50%)_0%,_transparent_70%)] opacity-40 scale-110"
            : "bg-[radial-gradient(circle,_hsl(0,0%,30%)_0%,_transparent_70%)] opacity-20 scale-100"
        }`}
        style={{ width: 100, height: 100, margin: "auto", left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <div
        className={`relative z-10 flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 transition-all duration-300 ${
          isLive
            ? "border-cyan-400/60 bg-gradient-to-b from-cyan-500 via-cyan-600 to-cyan-800 shadow-[0_0_30px_rgba(6,182,212,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)]"
            : "border-zinc-500 bg-gradient-to-b from-zinc-500 via-zinc-600 to-zinc-700 shadow-[inset_0_2px_4px_rgba(255,255,255,0.05)]"
        }`}
      >
        <span className={`text-sm font-bold tracking-[0.15em] ${isLive ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" : "text-zinc-300"}`}>
          LIVE
        </span>
      </div>
    </button>
  );
}

interface PluginPanelProps {
  sessionTitle?: string;
  connected?: boolean;
  talkbackActive?: boolean;
  onTalkDown?: () => void;
  onTalkUp?: () => void;
  sessionLink?: string;
  remoteMicLevel?: number;
  sendLevel?: number;
}

export default function PluginPanel({
  sessionTitle = "Jay's Vocal Take 5",
  connected = false,
  talkbackActive = false,
  onTalkDown,
  onTalkUp,
  sessionLink = "w.studio/jay5678",
  remoteMicLevel = 0,
  sendLevel = 0,
}: PluginPanelProps) {
  const [isLive, setIsLive] = useState(connected);
  const [copied, setCopied] = useState(false);
  const [remoteLevel, setRemoteLevel] = useState(0);
  const [remotePeak, setRemotePeak] = useState(0);
  const [sLevel, setSLevel] = useState(0);
  const [sPeak, setSPeak] = useState(0);

  useEffect(() => { setIsLive(connected); }, [connected]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (!isLive) {
        setRemoteLevel(0);
        setRemotePeak((p) => Math.max(0, p - 0.02));
        setSLevel(0);
        setSPeak((p) => Math.max(0, p - 0.02));
        return;
      }
      const rl = remoteMicLevel > 0.01 ? remoteMicLevel : 0.35 + Math.random() * 0.4;
      const sl = sendLevel > 0.01 ? sendLevel : 0.4 + Math.random() * 0.35;
      setRemoteLevel(rl);
      setRemotePeak((p) => Math.max(p * 0.97, rl));
      setSLevel(sl);
      setSPeak((p) => Math.max(p * 0.97, sl));
    }, 100);
    return () => clearInterval(iv);
  }, [isLive, remoteMicLevel, sendLevel]);

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(sessionLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [sessionLink]);

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-[6px]"
      style={{
        background: `linear-gradient(180deg, #404248 0%, #36383d 40%, #303236 100%)`,
        border: `1px solid #505258`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 12px rgba(0,0,0,0.4)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid #4a4c50" }}>
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <path d="M4 8L10 24L16 12L22 24L28 8" stroke="hsl(270,60%,65%)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="14" y1="4" x2="20" y2="28" stroke="hsl(210,90%,60%)" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <span className="text-[13px] font-bold tracking-tight" style={{ color: C.white }}>
            W.STUDIO <span className="font-medium" style={{ color: C.label }}>SEND</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Menu size={13} style={{ color: C.dim }} />
          <X size={13} style={{ color: C.dim }} />
        </div>
      </div>

      {/* Session info */}
      <div className="px-3 py-2" style={{ borderBottom: "1px solid #3a3c40" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded" style={{ background: "rgba(80,82,88,0.6)" }}>
              <svg width="8" height="10" viewBox="0 0 10 12" fill={C.label}><path d="M1 0L10 6L1 12V0Z" /></svg>
            </div>
            <span className="text-[12px] font-semibold" style={{ color: C.white }}>{sessionTitle}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: connected ? C.green : C.dim, boxShadow: connected ? "0 0 6px rgba(52,211,153,0.5)" : "none" }} />
            <span className="text-[10px] font-semibold" style={{ color: connected ? C.green : C.dim }}>
              {connected ? "CONNECTED" : "OFFLINE"}
            </span>
          </div>
        </div>
      </div>

      {/* Copy link */}
      <div className="px-3 py-2" style={{ borderBottom: "1px solid #3a3c40" }}>
        <div className="flex items-center overflow-hidden rounded" style={{ border: "1px solid #4a4c50", background: "#2a2c30" }}>
          <span className="flex-1 px-2 py-1 font-mono text-[11px]" style={{ color: C.label }}>{sessionLink}</span>
          <button onClick={handleCopy} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ borderLeft: "1px solid #4a4c50", color: C.label }}>
            {copied ? <Check size={10} style={{ color: C.green }} /> : <Copy size={10} />}
            {copied ? "COPIED" : "COPY"}
          </button>
        </div>
      </div>

      {/* Meters + Live */}
      <div className="flex flex-1 items-center justify-between px-4 py-3">
        <VUMeter level={remoteLevel} peak={remotePeak} label="REMOTE IN" dbLabel="-10" />
        <LiveButton isLive={isLive} onClick={() => setIsLive(!isLive)} />
        <VUMeter level={sLevel} peak={sPeak} label="SEND" dbLabel="-2" />
      </div>

      {/* Latency + Talkback */}
      <div className="flex items-center justify-between px-4 py-1.5" style={{ borderTop: "1px solid #3a3c40" }}>
        <div className="flex items-center gap-1">
          <div className="rounded-sm" style={{ height: 10, width: 16, border: "1px solid #555", background: "#2a2c30" }} />
          <span className="font-mono text-[9px]" style={{ color: C.dim }}>1 s</span>
        </div>
        <button
          onMouseDown={onTalkDown}
          onMouseUp={onTalkUp}
          onMouseLeave={onTalkUp}
          onTouchStart={(e) => { e.preventDefault(); onTalkDown?.(); }}
          onTouchEnd={(e) => { e.preventDefault(); onTalkUp?.(); }}
          className="flex items-center gap-1.5 rounded-md px-4 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all"
          style={{
            border: talkbackActive ? "1px solid rgba(6,182,212,0.5)" : "1px solid #555",
            background: talkbackActive ? "rgba(6,182,212,0.15)" : "#333538",
            color: talkbackActive ? "#67e8f9" : C.label,
            boxShadow: talkbackActive ? "0 0 10px rgba(6,182,212,0.2)" : "none",
          }}
        >
          <Mic size={11} /> TALKBACK
        </button>
        <div className="flex items-center gap-1">
          <div className="rounded-sm" style={{ height: 10, width: 16, border: "1px solid #555", background: "#2a2c30" }} />
          <span className="font-mono text-[9px]" style={{ color: C.dim }}>1 s</span>
          <div className="rounded-full" style={{ height: 8, width: 8, background: isLive ? "#06b6d4" : "#555", boxShadow: isLive ? "0 0 4px rgba(6,182,212,0.6)" : "none" }} />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderTop: "1px solid #4a4c50" }}>
        <div className="flex items-center gap-2">
          <Settings size={12} style={{ color: C.dim }} />
        </div>
        <div className="flex items-center gap-1">
          <span className="rounded-full" style={{ height: 5, width: 5, background: C.green }} />
          <span className="font-mono text-[9px]" style={{ color: C.dim }}>48 kHz / WavesHQ / 17 ms</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-0.5">
            <Settings size={10} style={{ color: C.dim }} />
            <span className="text-[7px] uppercase tracking-wider" style={{ color: C.dim }}>Settings</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <Menu size={10} style={{ color: C.dim }} />
            <span className="text-[7px] uppercase tracking-wider" style={{ color: C.dim }}>Sign Out</span>
          </div>
        </div>
      </div>
    </div>
  );
}
