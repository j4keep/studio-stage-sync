/* W.STUDIO RECEIVE – Remote Recording Interface */
import { useState, useRef, useEffect, useCallback, type CSSProperties } from "react";
import { Mic, MicOff, MessageCircle, Settings, Play, Square, Circle, Pause, Rewind, FastForward, Monitor, Scissors, Volume2, X, Menu } from "lucide-react";

/* ── Knob Component (realistic studio knob with tick marks) ── */
function StudioKnob({ value, onChange, label, size = 72 }: { value: number; onChange: (v: number) => void; label: string; size?: number }) {
  const knobRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const angle = -135 + (value / 100) * 270; // -135 to +135 degrees

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const delta = (startY.current - e.clientY) * 0.5;
    onChange(Math.max(0, Math.min(100, startVal.current + delta)));
  };
  const onPointerUp = () => { dragging.current = false; };

  // Generate tick marks around the knob
  const ticks = [];
  for (let i = 0; i <= 10; i++) {
    const tickAngle = -135 + (i / 10) * 270;
    const rad = (tickAngle - 90) * (Math.PI / 180);
    const outerR = size / 2 + 4;
    const innerR = size / 2 - 2;
    ticks.push(
      <line
        key={i}
        x1={size / 2 + Math.cos(rad) * innerR}
        y1={size / 2 + Math.sin(rad) * innerR}
        x2={size / 2 + Math.cos(rad) * outerR}
        y2={size / 2 + Math.sin(rad) * outerR}
        stroke="#888"
        strokeWidth={i % 5 === 0 ? 2 : 1}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        ref={knobRef}
        className="relative cursor-ns-resize"
        style={{ width: size + 10, height: size + 10 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <svg width={size + 10} height={size + 10} className="absolute inset-0">
          {ticks}
        </svg>
        <div
          className="absolute rounded-full"
          style={{
            width: size,
            height: size,
            top: 5,
            left: 5,
            background: "radial-gradient(ellipse at 35% 30%, #5a5a5e 0%, #2a2a2e 50%, #1a1a1e 100%)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
            transform: `rotate(${angle}deg)`,
          }}
        >
          {/* Pointer indicator line */}
          <div
            className="absolute left-1/2 top-[6px] -translate-x-1/2"
            style={{ width: 2, height: size / 2 - 10, background: "linear-gradient(to bottom, #fff 0%, #aaa 100%)", borderRadius: 1 }}
          />
        </div>
      </div>
      <span className="text-[11px] text-[#b0b0b0] font-medium tracking-wide">{label}</span>
    </div>
  );
}

/* ── Vertical Meter (LED-style) ── */
function VerticalMeter({ level, height = 120 }: { level: number; height?: number }) {
  const segments = 20;
  return (
    <div className="flex flex-col-reverse gap-[1px]" style={{ height }}>
      {Array.from({ length: segments }).map((_, i) => {
        const threshold = (i / segments) * 100;
        const lit = level > threshold;
        let color = "#2d8f2d";
        if (i >= segments * 0.6) color = "#c9a800";
        if (i >= segments * 0.8) color = "#e03030";
        if (i >= segments * 0.9) color = "#ff2020";
        return (
          <div
            key={i}
            className="rounded-[1px]"
            style={{
              width: 8,
              flex: 1,
              background: lit ? color : "#1a1a1a",
              boxShadow: lit ? `0 0 4px ${color}44` : "none",
            }}
          />
        );
      })}
    </div>
  );
}

/* ── Vertical Fader ── */
function VerticalFader({ value, onChange, height = 120 }: { value: number; onChange: (v: number) => void; height?: number }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateValue(e);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    updateValue(e);
  };
  const handlePointerUp = () => { dragging.current = false; };

  const updateValue = (e: React.PointerEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const pct = Math.max(0, Math.min(100, (1 - y / rect.height) * 100));
    onChange(pct);
  };

  const thumbPos = (1 - value / 100) * (height - 16);

  return (
    <div
      ref={trackRef}
      className="relative cursor-ns-resize"
      style={{ width: 18, height }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Track groove */}
      <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-[3px] rounded-full" style={{ background: "#333" }} />
      {/* Fill */}
      <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[3px] rounded-full" style={{ background: "#666", height: `${value}%` }} />
      {/* Thumb */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-sm"
        style={{
          top: thumbPos,
          width: 16,
          height: 16,
          background: "linear-gradient(to bottom, #e0e0e0, #a0a0a0)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
        }}
      >
        <div className="absolute inset-x-[3px] top-[5px] h-[1px] bg-[#666]" />
        <div className="absolute inset-x-[3px] top-[7px] h-[1px] bg-[#666]" />
        <div className="absolute inset-x-[3px] top-[9px] h-[1px] bg-[#666]" />
      </div>
    </div>
  );
}

/* ── Horizontal VU Meter ── */
function HorizontalMeter({ level }: { level: number }) {
  const segments = 40;
  return (
    <div className="flex gap-[1px] h-5 items-end">
      {Array.from({ length: segments }).map((_, i) => {
        const threshold = (i / segments) * 100;
        const lit = level > threshold;
        let color = "#2d8f2d";
        if (i >= segments * 0.5) color = "#5cb85c";
        if (i >= segments * 0.65) color = "#c9a800";
        if (i >= segments * 0.8) color = "#e06030";
        if (i >= segments * 0.9) color = "#ff2020";
        return (
          <div
            key={i}
            className="rounded-[1px]"
            style={{
              height: "100%",
              flex: 1,
              background: lit ? color : "#1a1a1a",
            }}
          />
        );
      })}
    </div>
  );
}

/* ── Waveform Display ── */
function RecordingWaveform() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let offset = 0;
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Draw waveform
      ctx.strokeStyle = "#9a9a9a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const t = (x + offset) * 0.02;
        const amp = (Math.sin(t) * 0.3 + Math.sin(t * 2.3) * 0.2 + Math.sin(t * 5.1) * 0.15 + Math.sin(t * 11) * 0.1) * h * 0.4;
        if (x === 0) ctx.moveTo(x, h / 2 + amp);
        else ctx.lineTo(x, h / 2 + amp);
      }
      ctx.stroke();

      // Mirror
      ctx.strokeStyle = "#7a7a7a";
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const t = (x + offset) * 0.02;
        const amp = (Math.sin(t) * 0.3 + Math.sin(t * 2.3) * 0.2 + Math.sin(t * 5.1) * 0.15 + Math.sin(t * 11) * 0.1) * h * 0.4;
        if (x === 0) ctx.moveTo(x, h / 2 - amp);
        else ctx.lineTo(x, h / 2 - amp);
      }
      ctx.stroke();

      offset += 0.8;
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return <canvas ref={canvasRef} width={800} height={60} className="w-full h-[60px] rounded" />;
}

/* ── Animated meter simulation ── */
function useAnimatedLevel(base: number, variance: number) {
  const [level, setLevel] = useState(base);
  useEffect(() => {
    const iv = setInterval(() => {
      setLevel(base + (Math.random() - 0.5) * variance);
    }, 100);
    return () => clearInterval(iv);
  }, [base, variance]);
  return level;
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT – W.STUDIO RECEIVE
   ══════════════════════════════════════════════════════════════ */
type View = "join" | "session";

export function DawWorkspacePage() {
  const [view, setView] = useState<View>("join");
  const [sessionCode, setSessionCode] = useState("");
  const [userName, setUserName] = useState("");
  const [isRecording, setIsRecording] = useState(true);
  const [isTalkActive, setIsTalkActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isArmRecord, setIsArmRecord] = useState(true);
  const [autoUpload, setAutoUpload] = useState(true);

  // Knob values
  const [compVal, setCompVal] = useState(45);
  const [eqVal, setEqVal] = useState(55);
  const [reverbVal, setReverbVal] = useState(30);
  const [vocalKnob, setVocalKnob] = useState(65);
  const [talkbackKnob, setTalkbackKnob] = useState(40);
  const [vocalFader, setVocalFader] = useState(72);
  const [talkbackFader, setTalkbackFader] = useState(55);

  // Animated meters
  const vocalMeter = useAnimatedLevel(70, 30);
  const talkbackMeter = useAnimatedLevel(50, 25);
  const remoteMeter = useAnimatedLevel(65, 35);

  /* ── JOIN SCREEN ── */
  if (view === "join") {
    return (
      <div className="flex items-center justify-center h-full w-full" style={{ background: "#1a1a1e" }}>
        <div className="rounded-xl p-8 flex flex-col items-center gap-6" style={{ background: "#2a2a2e", boxShadow: "0 8px 40px rgba(0,0,0,0.6)", width: 400 }}>
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="text-[22px] font-black tracking-tight" style={{ color: "#e8e8e8" }}>
              <span style={{ color: "#c0392b" }}>W.</span>STUDIO
            </span>
            <span className="text-[16px] font-light tracking-[4px] text-[#999]">RECEIVE</span>
          </div>

          <div className="w-full h-[1px]" style={{ background: "#3a3a3e" }} />

          <div className="w-full flex flex-col gap-3">
            <label className="text-[12px] text-[#999] font-medium tracking-wide">YOUR NAME</label>
            <input
              value={userName}
              onChange={e => setUserName(e.target.value)}
              placeholder="Enter your name..."
              className="w-full rounded-lg px-4 py-3 text-[14px] outline-none"
              style={{ background: "#1e1e22", border: "1px solid #3a3a3e", color: "#e0e0e0" }}
            />
          </div>

          <div className="w-full flex flex-col gap-3">
            <label className="text-[12px] text-[#999] font-medium tracking-wide">SESSION CODE</label>
            <input
              value={sessionCode}
              onChange={e => setSessionCode(e.target.value)}
              placeholder="Enter session code..."
              className="w-full rounded-lg px-4 py-3 text-[14px] outline-none"
              style={{ background: "#1e1e22", border: "1px solid #3a3a3e", color: "#e0e0e0" }}
            />
          </div>

          <button
            onClick={() => setView("session")}
            className="w-full rounded-lg py-3 text-[14px] font-semibold tracking-wide transition-all hover:brightness-110"
            style={{ background: "linear-gradient(135deg, #2d8f2d, #238b23)", color: "#fff", boxShadow: "0 2px 12px rgba(45,143,45,0.3)" }}
          >
            JOIN SESSION
          </button>
        </div>
      </div>
    );
  }

  /* ── SESSION VIEW ── */
  return (
    <div className="flex flex-col h-full w-full overflow-hidden select-none" style={{ background: "#1e1e22", color: "#e0e0e0", fontFamily: "'Inter', 'SF Pro', system-ui, sans-serif" }}>

      {/* ── HEADER BAR ── */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{ background: "#2a2a2e", borderBottom: "1px solid #3a3a3e" }}>
        <div className="flex items-center gap-2">
          <span className="text-[18px] font-black tracking-tight">
            <span style={{ color: "#c0392b" }}>W.</span>STUDIO
          </span>
          <span className="text-[14px] font-light tracking-[3px] text-[#888]">RECEIVE</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="text-[#888] hover:text-[#ccc] transition-colors"><Menu size={18} /></button>
          <button onClick={() => setView("join")} className="text-[#888] hover:text-[#ccc] transition-colors"><X size={18} /></button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: VIDEO TILES + CONTROLS ── */}
        <div className="flex flex-col shrink-0" style={{ width: 280, background: "#222226", borderRight: "1px solid #3a3a3e" }}>
          {/* Video tile 1 - Artist */}
          <div className="relative" style={{ height: "45%", background: "#111" }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #2a2a30, #1a1a20)" }}>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold" style={{ background: "#3a3a40", color: "#888" }}>J</div>
                  <span className="text-[11px] text-[#666]">Camera Off</span>
                </div>
              </div>
            </div>
            {/* Name badge */}
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded text-[12px] font-medium" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
              Jay - Florida
            </div>
            {/* Mic indicator */}
            <div className="absolute top-2 right-2">
              <Mic size={14} className="text-[#2d8f2d]" />
            </div>
          </div>

          {/* Video tile 2 - Engineer */}
          <div className="relative" style={{ height: "35%", background: "#111", borderTop: "1px solid #3a3a3e" }}>
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #2a2a30, #1a1a20)" }}>
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold" style={{ background: "#3a3a40", color: "#888" }}>B</div>
                <span className="text-[11px] text-[#666]">Camera Off</span>
              </div>
            </div>
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded text-[12px] font-medium" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
              Bob - New York
            </div>
          </div>

          {/* Bottom controls: Mute, Talk, Settings */}
          <div className="flex items-center justify-center gap-6 py-3" style={{ background: "#1e1e22", borderTop: "1px solid #3a3a3e" }}>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="flex flex-col items-center gap-1 transition-all"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: isMuted ? "#c0392b" : "#333" }}>
                {isMuted ? <MicOff size={18} /> : <Mic size={18} className="text-[#8ab4f8]" />}
              </div>
              <span className="text-[10px] text-[#999]">Mute</span>
            </button>

            <button
              onClick={() => setIsTalkActive(!isTalkActive)}
              className="flex flex-col items-center gap-1 transition-all"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{
                  background: isTalkActive ? "linear-gradient(135deg, #2980d9, #3498db)" : "#333",
                  boxShadow: isTalkActive ? "0 0 12px rgba(52,152,219,0.4)" : "none",
                }}
              >
                <Play size={18} fill={isTalkActive ? "#fff" : "transparent"} className={isTalkActive ? "text-white" : "text-[#8ab4f8]"} />
              </div>
              <span className="text-[10px] text-[#999]">Talk</span>
            </button>

            <button className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#333" }}>
                <Settings size={18} className="text-[#999]" />
              </div>
              <span className="text-[10px] text-[#999]">Settings</span>
            </button>
          </div>
        </div>

        {/* ── RIGHT: MAIN PANEL ── */}
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* ── Session Info Bar ── */}
          <div className="flex items-center justify-between px-4 py-2 shrink-0" style={{ background: "#252528", borderBottom: "1px solid #3a3a3e" }}>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-[#ccc]">Session: <span className="font-semibold text-[#e0e0e0]">Live with Jay - Florida</span></span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider" style={{ background: "#2d8f2d", color: "#fff" }}>CONNECTED</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="w-8 h-8 rounded flex items-center justify-center hover:bg-[#3a3a3e] transition-colors">
                <Volume2 size={16} className="text-[#999]" />
              </button>
              <button className="w-8 h-8 rounded flex items-center justify-center hover:bg-[#3a3a3e] transition-colors">
                <Monitor size={16} className="text-[#999]" />
              </button>
              <button className="w-8 h-8 rounded flex items-center justify-center hover:bg-[#3a3a3e] transition-colors">
                <Scissors size={16} className="text-[#999]" />
              </button>
              <button className="w-8 h-8 rounded flex items-center justify-center hover:bg-[#3a3a3e] transition-colors">
                <Settings size={14} className="text-[#999]" />
              </button>
            </div>
          </div>

          {/* ── Middle row: Sync + Remote Vocal + Monitoring + Effects ── */}
          <div className="flex flex-1 overflow-hidden">

            {/* Left: Sync Controls + Remote Vocal (stacked) */}
            <div className="flex flex-col flex-1" style={{ borderRight: "1px solid #3a3a3e" }}>

              {/* SYNC CONTROLS */}
              <div className="p-3 shrink-0" style={{ borderBottom: "1px solid #3a3a3e" }}>
                <div className="text-[11px] font-bold text-[#999] tracking-[2px] mb-2">SYNC CONTROLS</div>
                <div className="text-center text-[13px] text-[#bbb] mb-3">– SYNCED: 120 BPM –</div>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 px-4 py-2 rounded text-[12px] font-medium transition-all hover:brightness-110" style={{ background: "#333", border: "1px solid #444" }}>
                    <Play size={14} className="text-[#5cb85c]" fill="#5cb85c" /> Play
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 rounded text-[12px] font-medium transition-all hover:brightness-110" style={{ background: "#333", border: "1px solid #444" }}>
                    <Square size={12} className="text-[#e04040]" fill="#e04040" /> Stop
                  </button>
                  <button
                    onClick={() => setIsRecording(!isRecording)}
                    className="flex items-center gap-2 px-4 py-2 rounded text-[12px] font-medium transition-all hover:brightness-110"
                    style={{ background: isRecording ? "#6b1a1a" : "#333", border: `1px solid ${isRecording ? "#a03030" : "#444"}` }}
                  >
                    <Circle size={12} className="text-[#ff3030]" fill="#ff3030" /> Record
                  </button>
                </div>
              </div>

              {/* VOCAL INPUT / REMOTE VOCAL */}
              <div className="p-3 shrink-0" style={{ borderBottom: "1px solid #3a3a3e" }}>
                <div className="text-[11px] font-bold text-[#999] tracking-[2px] mb-2">REMOTE VOCAL</div>
                <div className="rounded p-2 mb-2" style={{ background: "#1a1a1e" }}>
                  <HorizontalMeter level={remoteMeter} />
                  {/* Scale markings */}
                  <div className="flex justify-between mt-1 text-[8px] text-[#555] px-1">
                    <span>-∞</span><span>-30</span><span>-20</span><span>-10</span><span>-6</span><span>-3</span><span>0</span><span>+3</span><span>+6</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsArmRecord(!isArmRecord)}
                  className="w-full py-2 rounded text-[12px] font-bold tracking-wider transition-all"
                  style={{
                    background: isArmRecord ? "linear-gradient(135deg, #8b2020, #a02020)" : "#333",
                    color: isArmRecord ? "#fff" : "#999",
                    border: `1px solid ${isArmRecord ? "#c03030" : "#444"}`,
                    boxShadow: isArmRecord ? "0 0 12px rgba(200,50,50,0.2)" : "none",
                  }}
                >
                  ARM RECORD
                </button>
              </div>

              {/* VOCAL INPUT indicator */}
              <div className="p-3 shrink-0" style={{ borderBottom: "1px solid #3a3a3e" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-[#999] tracking-[2px]">VOCAL INPUT</span>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: "#2d8f2d" }} />
                    <div className="w-2 h-2 rounded-full" style={{ background: "#c9a800" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: Monitoring + Effects */}
            <div className="flex flex-col shrink-0" style={{ width: 260 }}>

              {/* MONITORING */}
              <div className="p-3" style={{ borderBottom: "1px solid #3a3a3e" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-[#999] tracking-[2px]">MONITORING</span>
                  {/* Mini level blocks */}
                  <div className="flex gap-[2px]">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="rounded-[1px]" style={{ width: 5, height: 8, background: i <= 3 ? "#2d8f2d" : "#333" }} />
                    ))}
                  </div>
                </div>

                <div className="flex justify-around">
                  {/* Vocal Level */}
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-[#999] mb-1">Vocal Level</span>
                    <div className="flex items-end gap-2">
                      <StudioKnob value={vocalKnob} onChange={setVocalKnob} label="" size={56} />
                      <div className="flex gap-[2px] mb-2">
                        <VerticalFader value={vocalFader} onChange={setVocalFader} height={90} />
                        <VerticalMeter level={vocalMeter} height={90} />
                      </div>
                    </div>
                  </div>

                  {/* Talkback Level */}
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-[#999] mb-1">Talkback Level</span>
                    <div className="flex items-end gap-2">
                      <StudioKnob value={talkbackKnob} onChange={setTalkbackKnob} label="" size={56} />
                      <div className="flex gap-[2px] mb-2">
                        <VerticalFader value={talkbackFader} onChange={setTalkbackFader} height={90} />
                        <VerticalMeter level={talkbackMeter} height={90} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* EFFECTS */}
              <div className="p-3 flex-1">
                <div className="text-[11px] font-bold text-[#999] tracking-[2px] mb-3">EFFECTS</div>
                <div className="flex justify-around">
                  <StudioKnob value={compVal} onChange={setCompVal} label="Comp" size={56} />
                  <StudioKnob value={eqVal} onChange={setEqVal} label="EQ" size={56} />
                  <StudioKnob value={reverbVal} onChange={setReverbVal} label="Reverb" size={56} />
                </div>
              </div>
            </div>
          </div>

          {/* ── RECORDING STRIP (bottom) ── */}
          <div className="shrink-0" style={{ background: "#1a1a1e", borderTop: "1px solid #3a3a3e" }}>
            {/* Take label */}
            <div className="flex items-center justify-between px-4 py-1.5" style={{ background: "#222226", borderBottom: "1px solid #2a2a2e" }}>
              <span className="text-[13px] font-medium text-[#ccc]">Jay's Vocal Take 4 – Recording…</span>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: isRecording ? "#ff3030" : "#555" }} />
                <div className="w-2 h-2 rounded-full" style={{ background: isRecording ? "#ff3030" : "#555" }} />
              </div>
            </div>

            {/* Waveform */}
            <div className="px-4 py-2" style={{ background: "#161618" }}>
              <RecordingWaveform />
            </div>

            {/* Transport Controls */}
            <div className="flex items-center justify-between px-3 py-2" style={{ background: "#222226", borderTop: "1px solid #3a3a3e" }}>
              <div className="flex items-center gap-1">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium" style={{ background: "#333", border: "1px solid #444" }}>
                  <Pause size={12} /> Punch In
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium" style={{ background: "#333", border: "1px solid #444" }}>
                  <Rewind size={12} /> Rewind
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium" style={{ background: "#333", border: "1px solid #444" }}>
                  <FastForward size={12} /> Forward
                </button>
              </div>

              {/* REC indicator */}
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center gap-2 px-4 py-1.5 rounded text-[12px] font-bold tracking-wider"
                  style={{
                    background: isRecording ? "linear-gradient(135deg, #8b1a1a, #a02020)" : "#333",
                    color: isRecording ? "#ff4040" : "#999",
                    border: `1px solid ${isRecording ? "#a03030" : "#444"}`,
                  }}
                >
                  <Circle size={10} fill={isRecording ? "#ff3030" : "#666"} className={isRecording ? "text-[#ff3030] animate-pulse" : "text-[#666]"} />
                  REC {isRecording ? "● RECORDING…" : ""}
                </div>
              </div>

              {/* Auto Upload */}
              <div className="flex items-center gap-2">
                <div className="flex gap-[2px]">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="rounded-[1px]" style={{ width: 6, height: 6, background: i <= 2 ? "#2d8f2d" : "#555" }} />
                  ))}
                </div>
                <span className="text-[11px] text-[#999]">AUTO UPLOAD:</span>
                <button
                  onClick={() => setAutoUpload(!autoUpload)}
                  className="text-[11px] font-bold transition-colors"
                  style={{ color: autoUpload ? "#2d8f2d" : "#888" }}
                >
                  {autoUpload ? "ON" : "OFF"}
                </button>
                {autoUpload && <Play size={10} className="text-[#2d8f2d]" fill="#2d8f2d" />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
