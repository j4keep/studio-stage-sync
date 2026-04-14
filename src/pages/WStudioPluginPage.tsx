import { useState, useEffect, useRef, useCallback } from "react";
import { Settings, Mic, Copy, Check, Menu, X, Pause } from "lucide-react";

/* ── Animated VU meter bar (vertical, bottom→top) ── */
function VUMeter({ level, peak, label, dbLabel }: { level: number; peak: number; label: string; dbLabel: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label}</span>
      <div className="relative flex gap-[3px]">
        {/* L channel */}
        <div className="relative h-[140px] w-[10px] rounded-sm overflow-hidden bg-zinc-900 ring-1 ring-zinc-700/50">
          <div
            className="absolute bottom-0 left-0 w-full rounded-sm transition-[height] duration-75"
            style={{
              height: `${Math.min(100, level * 100)}%`,
              background: "linear-gradient(to top, #22c55e 0%, #22c55e 55%, #eab308 75%, #ef4444 100%)",
            }}
          />
          {/* Peak hold */}
          <div
            className="absolute left-0 w-full h-[2px] bg-white/80 transition-[bottom] duration-200"
            style={{ bottom: `${Math.min(100, peak * 100)}%` }}
          />
          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map((p) => (
            <div key={p} className="absolute left-0 w-full h-px bg-zinc-600/40" style={{ bottom: `${p}%` }} />
          ))}
        </div>
        {/* R channel (slightly offset for stereo look) */}
        <div className="relative h-[140px] w-[10px] rounded-sm overflow-hidden bg-zinc-900 ring-1 ring-zinc-700/50">
          <div
            className="absolute bottom-0 left-0 w-full rounded-sm transition-[height] duration-75"
            style={{
              height: `${Math.min(100, level * 95)}%`,
              background: "linear-gradient(to top, #22c55e 0%, #22c55e 55%, #eab308 75%, #ef4444 100%)",
            }}
          />
          <div
            className="absolute left-0 w-full h-[2px] bg-white/80 transition-[bottom] duration-200"
            style={{ bottom: `${Math.min(100, peak * 95)}%` }}
          />
          {[0, 25, 50, 75, 100].map((p) => (
            <div key={p} className="absolute left-0 w-full h-px bg-zinc-600/40" style={{ bottom: `${p}%` }} />
          ))}
        </div>
      </div>
      <span className="font-mono text-[11px] font-bold text-zinc-300">{dbLabel}</span>
    </div>
  );
}

/* ── Live button ── */
function LiveButton({ isLive, onClick }: { isLive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center justify-center"
    >
      {/* Outer glow ring */}
      <div
        className={`absolute inset-0 rounded-full transition-all duration-500 ${
          isLive
            ? "bg-[radial-gradient(circle,_hsl(200,80%,50%)_0%,_transparent_70%)] opacity-40 scale-110"
            : "bg-[radial-gradient(circle,_hsl(0,0%,30%)_0%,_transparent_70%)] opacity-20 scale-100"
        }`}
        style={{ width: 120, height: 120, margin: "auto", left: 0, right: 0, top: 0, bottom: 0 }}
      />
      {/* Main button */}
      <div
        className={`relative z-10 flex h-[100px] w-[100px] items-center justify-center rounded-full border-2 transition-all duration-300 ${
          isLive
            ? "border-cyan-400/60 bg-gradient-to-b from-cyan-500 via-cyan-600 to-cyan-800 shadow-[0_0_30px_rgba(6,182,212,0.4),inset_0_2px_4px_rgba(255,255,255,0.2)]"
            : "border-zinc-600 bg-gradient-to-b from-zinc-600 via-zinc-700 to-zinc-800 shadow-[inset_0_2px_4px_rgba(255,255,255,0.05)]"
        }`}
      >
        <span
          className={`text-base font-bold tracking-[0.15em] ${
            isLive ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" : "text-zinc-400"
          }`}
        >
          LIVE
        </span>
      </div>
    </button>
  );
}

/* ── W.Studio Logo ── */
function WStudioLogo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
        <path d="M4 8L10 24L16 12L22 24L28 8" stroke="hsl(270,60%,65%)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="14" y1="4" x2="20" y2="28" stroke="hsl(210,90%,60%)" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
      <span className="text-[15px] font-bold tracking-tight text-white">
        W.STUDIO <span className="font-medium text-zinc-400">SEND</span>
      </span>
    </div>
  );
}

export default function WStudioPluginPage() {
  const [isLive, setIsLive] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [talkbackActive, setTalkbackActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [remoteLevel, setRemoteLevel] = useState(0.55);
  const [remotePeak, setRemotePeak] = useState(0.72);
  const [sendLevel, setSendLevel] = useState(0.65);
  const [sendPeak, setSendPeak] = useState(0.78);

  // Simulated metering animation
  useEffect(() => {
    const iv = setInterval(() => {
      if (!isLive) {
        setRemoteLevel(0);
        setRemotePeak((p) => Math.max(0, p - 0.02));
        setSendLevel(0);
        setSendPeak((p) => Math.max(0, p - 0.02));
        return;
      }
      const rl = 0.35 + Math.random() * 0.4;
      const sl = 0.4 + Math.random() * 0.35;
      setRemoteLevel(rl);
      setRemotePeak((p) => Math.max(p * 0.97, rl));
      setSendLevel(sl);
      setSendPeak((p) => Math.max(p * 0.97, sl));
    }, 100);
    return () => clearInterval(iv);
  }, [isLive]);

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText("w.studio/jay5678");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      {/* Plugin container — fixed width to simulate DAW plugin window */}
      <div
        className="w-[360px] overflow-hidden rounded-lg border border-zinc-700/60 shadow-2xl"
        style={{
          background: "linear-gradient(180deg, #1e1e24 0%, #18181c 40%, #131316 100%)",
        }}
      >
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between border-b border-zinc-700/40 px-4 py-2.5">
          <WStudioLogo />
          <div className="flex items-center gap-2">
            <button className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <Menu size={15} />
            </button>
            <button className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ─── Session info ─── */}
        <div className="border-b border-zinc-800/60 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <button className="flex h-6 w-6 items-center justify-center rounded bg-zinc-700/60 text-zinc-400 hover:text-white transition-colors">
                <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
                  <path d="M1 0L10 6L1 12V0Z" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-white">Jay's Vocal Take 5</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
              <span className="text-xs font-semibold text-emerald-400">CONNECTED</span>
            </div>
          </div>
        </div>

        {/* ─── Copy Link / QR Area ─── */}
        <div className="border-b border-zinc-800/60 px-4 py-2.5">
          <div className="flex items-center overflow-hidden rounded border border-zinc-700/50 bg-zinc-900/80">
            <span className="flex-1 px-3 py-1.5 font-mono text-[12px] text-zinc-400">
              w.studio/jay5678
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 border-l border-zinc-700/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copied ? "COPIED" : "COPY LINK"}
            </button>
          </div>
        </div>

        {/* ─── Meters + Live Button ─── */}
        <div className="flex items-center justify-between px-5 py-5">
          {/* Remote In Meter */}
          <VUMeter
            level={remoteLevel}
            peak={remotePeak}
            label="REMOTE IN"
            dbLabel="-10"
          />

          {/* Center Live Button */}
          <LiveButton isLive={isLive} onClick={() => setIsLive(!isLive)} />

          {/* Send Meter */}
          <VUMeter
            level={sendLevel}
            peak={sendPeak}
            label="SEND"
            dbLabel="-2"
          />
        </div>

        {/* ─── Latency indicators ─── */}
        <div className="flex items-center justify-between border-t border-zinc-800/60 px-5 py-2">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-5 rounded-sm border border-zinc-600 bg-zinc-800" />
            <span className="font-mono text-[10px] text-zinc-500">1 s</span>
          </div>

          {/* Talkback Button */}
          <button
            onMouseDown={() => setTalkbackActive(true)}
            onMouseUp={() => setTalkbackActive(false)}
            onMouseLeave={() => setTalkbackActive(false)}
            className={`flex items-center gap-2 rounded-md border px-5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
              talkbackActive
                ? "border-cyan-500/50 bg-cyan-900/40 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                : "border-zinc-700/60 bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Mic size={13} />
            TALKBACK
          </button>

          <div className="flex items-center gap-1.5">
            <div className="h-3 w-5 rounded-sm border border-zinc-600 bg-zinc-800" />
            <span className="font-mono text-[10px] text-zinc-500">1 s</span>
            <div className={`h-2.5 w-2.5 rounded-full ${isLive ? "bg-cyan-500 shadow-[0_0_4px_rgba(6,182,212,0.6)]" : "bg-zinc-600"}`} />
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div className="flex items-center justify-between border-t border-zinc-700/40 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <button className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <Settings size={14} />
            </button>
            <button className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <Pause size={14} />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="font-mono text-[10px] text-zinc-500">
              48 Hz / WavesHQ / 17 ms
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-zinc-300 transition-colors">
              <Settings size={12} />
              <span className="text-[8px] uppercase tracking-wider">Settings</span>
            </button>
            <button className="flex flex-col items-center gap-0.5 text-zinc-500 hover:text-zinc-300 transition-colors">
              <Menu size={12} />
              <span className="text-[8px] uppercase tracking-wider">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
