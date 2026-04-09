import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  FastForward,
  Menu,
  Mic,
  MicOff,
  Monitor,
  Pause,
  Rewind,
  Settings,
  Volume2,
  X,
} from "lucide-react";
import { useSession } from "./SessionContext";

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function meterColor(ratio: number) {
  if (ratio > 0.78) return "hsl(var(--wstudio-red))";
  if (ratio > 0.58) return "hsl(var(--wstudio-yellow))";
  return "hsl(var(--wstudio-green))";
}

function PanelTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--wstudio-label))]">
          {title}
        </span>
        {right}
      </div>
      <div className="wstudio-divider mt-2" />
    </div>
  );
}

function ToolbarButton({
  children,
  active = false,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`wstudio-icon-button h-11 w-11 rounded-[5px] ${active ? "wstudio-icon-button-active" : ""} ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
    >
      {children}
    </button>
  );
}

function StudioActionButton({
  symbol,
  label,
  disabled = false,
  active = false,
  danger = false,
  onClick,
}: {
  symbol: string;
  label: string;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`wstudio-button flex h-[52px] min-w-[124px] items-center justify-center gap-3 rounded-[4px] px-4 text-[17px] font-semibold tracking-[-0.02em] ${active ? "wstudio-button-active" : ""} ${danger ? "wstudio-button-danger" : ""} ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
    >
      <span
        className={`${label === "Record" && active ? "animate-pulse" : ""}`}
        style={{ color: label === "Play" ? "hsl(var(--wstudio-text))" : "hsl(var(--wstudio-red))" }}
      >
        {symbol}
      </span>
      <span>{label}</span>
    </button>
  );
}

function TransportButton({
  symbol,
  label,
  disabled = false,
}: {
  symbol: string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`wstudio-button flex h-[40px] min-w-[126px] items-center justify-center gap-3 rounded-[4px] px-4 text-[15px] font-semibold ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
    >
      <span className="font-mono text-[16px] tracking-[-0.18em]">{symbol}</span>
      <span>{label}</span>
    </button>
  );
}

function LeftControlCell({
  label,
  active = false,
  icon,
  onClick,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
}: {
  label: string;
  active?: boolean;
  icon: ReactNode;
  onClick?: () => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  onPointerLeave?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      className="flex flex-1 flex-col items-center justify-center gap-2 px-2 py-3 text-center"
    >
      {icon}
      <span className="text-[11px] font-medium text-[hsl(var(--wstudio-text))]">{label}</span>
      {active ? <span className="h-[2px] w-8 rounded-full bg-[hsl(var(--wstudio-blue))]" /> : <span className="h-[2px] w-8 rounded-full bg-transparent" />}
    </button>
  );
}

function ArtistBoothArt() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, hsl(35 16% 38%) 0%, hsl(31 15% 27%) 38%, hsl(var(--wstudio-track)) 100%)",
        }}
      />
      <div className="absolute inset-y-0 left-[6%] w-[1px] bg-[hsl(34_13%_58%_/_0.28)]" />
      <div className="absolute inset-y-0 left-[28%] w-[1px] bg-[hsl(34_13%_58%_/_0.18)]" />
      <div className="absolute left-[5%] top-[32%] h-[14px] w-[88px] rounded-full bg-[hsl(220_12%_11%)] shadow-[0_0_0_1px_hsl(0_0%_0%_/_0.35)]" />
      <div className="absolute left-[12%] top-[24%] h-[76px] w-[76px] rounded-full border-[6px] border-[hsl(220_11%_8%)] bg-transparent" />
      <div className="absolute left-[26%] top-[31%] h-[8px] w-[68px] rotate-[-10deg] rounded-full bg-[hsl(220_10%_14%)]" />
      <div className="absolute left-[54%] top-[21%] h-[34px] w-[62px] rounded-t-[999px] rounded-b-[18px] bg-[hsl(7_58%_46%)]" />
      <div className="absolute left-[58%] top-[30%] h-[58px] w-[58px] rounded-full bg-[hsl(28_28%_63%)]" />
      <div className="absolute left-[55%] top-[43%] h-[40px] w-[66px] rounded-b-[32px] bg-[hsl(28_26%_56%)]" />
      <div className="absolute left-[50%] top-[54%] h-[86px] w-[118px] rounded-t-[58px] bg-[hsl(220_14%_10%)]" />
      <div className="absolute left-[70%] top-[30%] h-[44px] w-[44px] rounded-full border-[6px] border-[hsl(220_11%_8%)] bg-[hsl(220_10%_17%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,hsl(220_12%_4%_/_0.34)_100%)]" />
    </>
  );
}

function EngineerBoothArt() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, hsl(210 10% 27%) 0%, hsl(217 12% 16%) 36%, hsl(var(--wstudio-track)) 100%)",
        }}
      />
      <div className="absolute left-[4%] top-[18%] flex h-[64%] w-[18%] flex-col justify-between rounded-[8px] bg-[hsl(220_10%_12%_/_0.85)] p-2">
        <div className="mx-auto h-8 w-8 rounded-full bg-[hsl(220_8%_23%)] shadow-[inset_0_0_0_6px_hsl(220_12%_8%)]" />
        <div className="mx-auto h-10 w-10 rounded-full bg-[hsl(220_8%_23%)] shadow-[inset_0_0_0_7px_hsl(220_12%_8%)]" />
      </div>
      <div className="absolute right-[6%] top-[16%] flex h-[68%] w-[19%] flex-col justify-between rounded-[8px] bg-[hsl(220_10%_12%_/_0.85)] p-2">
        <div className="mx-auto h-9 w-9 rounded-full bg-[hsl(220_8%_23%)] shadow-[inset_0_0_0_6px_hsl(220_12%_8%)]" />
        <div className="mx-auto h-11 w-11 rounded-full bg-[hsl(220_8%_23%)] shadow-[inset_0_0_0_7px_hsl(220_12%_8%)]" />
      </div>
      <div className="absolute left-[39%] top-[27%] h-[58px] w-[58px] rounded-full bg-[hsl(28_16%_62%)]" />
      <div className="absolute left-[33%] top-[46%] h-[92px] w-[110px] rounded-t-[58px] bg-[hsl(220_10%_12%)]" />
      <div className="absolute left-[41%] top-[36%] h-[6px] w-[42px] rounded-full bg-[hsl(214_28%_66%)]" />
      <div className="absolute left-[39%] top-[35%] h-[10px] w-[16px] rounded-full border border-[hsl(214_22%_76%)]" />
      <div className="absolute left-[54%] top-[35%] h-[10px] w-[16px] rounded-full border border-[hsl(214_22%_76%)]" />
      <div className="absolute left-[46%] top-[37%] h-[1px] w-[10px] bg-[hsl(214_22%_76%)]" />
      <div className="absolute right-[20%] top-[29%] h-[44px] w-[44px] rounded-full border-[6px] border-[hsl(220_11%_8%)] bg-[hsl(220_10%_17%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,hsl(220_12%_4%_/_0.34)_100%)]" />
    </>
  );
}

function SharedScreenArt() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(216_12%_20%),hsl(var(--wstudio-track)))]" />
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "linear-gradient(hsl(210 26% 18% / 0.65) 1px, transparent 1px), linear-gradient(90deg, hsl(210 26% 18% / 0.65) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <div className="absolute left-[7%] top-[14%] h-[22%] w-[36%] rounded-[8px] border border-[hsl(var(--wstudio-panel-border))] bg-[hsl(220_10%_12%_/_0.9)]" />
      <div className="absolute left-[48%] top-[14%] h-[12%] w-[18%] rounded-[8px] border border-[hsl(var(--wstudio-panel-border))] bg-[hsl(220_10%_12%_/_0.9)]" />
      <div className="absolute right-[8%] top-[14%] h-[12%] w-[18%] rounded-[8px] border border-[hsl(var(--wstudio-panel-border))] bg-[hsl(220_10%_12%_/_0.9)]" />
      <div className="absolute inset-x-[7%] bottom-[16%] h-[20%] rounded-[8px] border border-[hsl(var(--wstudio-panel-border))] bg-[hsl(220_10%_12%_/_0.85)]" />
      <div className="absolute left-[10%] top-[19%] h-[6px] w-[18%] rounded-full bg-[hsl(var(--wstudio-blue))]" />
      <div className="absolute left-[10%] top-[30%] h-[6px] w-[26%] rounded-full bg-[hsl(var(--wstudio-green))]" />
      <div className="absolute left-[10%] top-[41%] h-[6px] w-[21%] rounded-full bg-[hsl(var(--wstudio-yellow))]" />
      <div className="absolute right-[14%] top-[38%] h-[28%] w-[14%] rounded-full border-[10px] border-[hsl(220_11%_10%)]" />
    </div>
  );
}

function VideoTile({ name, art }: { name: string; art: ReactNode }) {
  return (
    <div className="wstudio-screen relative overflow-hidden rounded-[4px]">
      {art}
      <div className="absolute inset-0 shadow-[inset_0_0_0_1px_hsl(var(--wstudio-shell-outline)_/_0.45)]" />
      <div className="wstudio-pill-label absolute bottom-2 left-2 rounded-[4px] px-2 py-[3px] text-[11px] font-medium leading-none">
        {name}
      </div>
    </div>
  );
}

function StudioKnob({ label, value = 0.5, size = 72, showLabel = true }: { label: string; value?: number; size?: number; showLabel?: boolean }) {
  const id = useId().replace(/:/g, "");
  const safeValue = clamp(value);
  const angle = -136 + safeValue * 272;
  const radius = size / 2 - 10;
  const center = size / 2;
  const ticks = 15;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {Array.from({ length: ticks }).map((_, index) => {
          const tickAngle = (-136 + (index / (ticks - 1)) * 272) * (Math.PI / 180);
          const x1 = center + (radius + 3) * Math.cos(tickAngle);
          const y1 = center + (radius + 3) * Math.sin(tickAngle);
          const x2 = center + (radius + 7) * Math.cos(tickAngle);
          const y2 = center + (radius + 7) * Math.sin(tickAngle);
          return (
            <line
              key={index}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="hsl(var(--wstudio-label) / 0.55)"
              strokeWidth={1.2}
              strokeLinecap="round"
            />
          );
        })}
        <defs>
          <radialGradient id={`${id}-outer`} cx="38%" cy="35%">
            <stop offset="0%" stopColor="hsl(0 0% 32%)" />
            <stop offset="72%" stopColor="hsl(0 0% 14%)" />
            <stop offset="100%" stopColor="hsl(0 0% 7%)" />
          </radialGradient>
          <radialGradient id={`${id}-inner`} cx="36%" cy="34%">
            <stop offset="0%" stopColor="hsl(0 0% 18%)" />
            <stop offset="100%" stopColor="hsl(0 0% 9%)" />
          </radialGradient>
        </defs>
        <circle cx={center} cy={center} r={radius + 1.6} fill="url(#${id}-outer)" stroke="hsl(var(--wstudio-shell-outline) / 0.85)" strokeWidth={2} />
        <circle cx={center} cy={center} r={radius - 4.5} fill="url(#${id}-inner)" stroke="hsl(var(--wstudio-panel-border))" strokeWidth={1.5} />
        <line
          x1={center}
          y1={center}
          x2={center + (radius - 10) * Math.cos((angle * Math.PI) / 180)}
          y2={center + (radius - 10) * Math.sin((angle * Math.PI) / 180)}
          stroke="hsl(var(--wstudio-text))"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={center} cy={center} r={4.5} fill="hsl(0 0% 36%)" />
      </svg>
      {showLabel ? <span className="text-[11px] font-medium text-[hsl(var(--wstudio-text))]">{label}</span> : null}
    </div>
  );
}

function LedMeter({ level }: { level: number }) {
  return (
    <div className="flex h-[82px] w-[12px] flex-col-reverse gap-[2px]">
      {Array.from({ length: 14 }).map((_, index) => {
        const ratio = (index + 1) / 14;
        const active = ratio <= clamp(level);
        return (
          <div
            key={index}
            className="flex-1 rounded-[1px]"
            style={{ backgroundColor: active ? meterColor(ratio) : "hsl(var(--wstudio-track))" }}
          />
        );
      })}
    </div>
  );
}

function StudioFader({ value }: { value: number }) {
  const bottom = 8 + clamp(value) * 56;
  return (
    <div className="relative h-[88px] w-[22px]">
      <div className="absolute bottom-[6px] left-1/2 top-[6px] w-[6px] -translate-x-1/2 rounded-full border border-[hsl(var(--wstudio-panel-border))] bg-[hsl(var(--wstudio-track))]" />
      <div
        className="absolute left-1/2 h-[14px] w-[26px] -translate-x-1/2 rounded-[2px] border border-[hsl(var(--wstudio-shell-edge))] shadow-[0_2px_8px_hsl(var(--wstudio-shell-outline)_/_0.6)]"
        style={{
          bottom: `${bottom}px`,
          background: "linear-gradient(180deg, hsl(var(--wstudio-metal)) 0%, hsl(0 0% 42%) 100%)",
        }}
      />
    </div>
  );
}

function MonitoringChannel({
  label,
  knobValue,
  meterLevel,
  faderValue,
}: {
  label: string;
  knobValue: number;
  meterLevel: number;
  faderValue: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-medium text-[hsl(var(--wstudio-text))]">{label}</span>
      <div className="flex items-end gap-3">
        <StudioKnob label="" value={knobValue} size={74} showLabel={false} />
        <div className="flex items-end gap-2">
          <LedMeter level={meterLevel} />
          <StudioFader value={faderValue} />
        </div>
      </div>
    </div>
  );
}

function RemoteSpectrum({ level }: { level: number }) {
  const bars = 42;
  const activeBars = Math.max(6, Math.round(clamp(level) * bars));
  return (
    <div className="wstudio-inset rounded-[4px] px-4 py-3">
      <div className="mb-2 flex items-center gap-3">
        <div className="h-[4px] w-[12px] rounded-full bg-[hsl(var(--wstudio-label))] opacity-70" />
        <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-[hsl(var(--wstudio-track))]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${18 + clamp(level) * 72}%`,
              background: "linear-gradient(90deg, hsl(var(--wstudio-green)) 0%, hsl(var(--wstudio-yellow)) 58%, hsl(var(--wstudio-red)) 100%)",
            }}
          />
        </div>
        <div className="h-[4px] w-[12px] rounded-full bg-[hsl(var(--wstudio-label))] opacity-70" />
      </div>
      <div className="mb-2 flex items-end justify-center gap-[3px]">
        {Array.from({ length: bars }).map((_, index) => {
          const ratio = (index + 1) / bars;
          const active = index < activeBars;
          return (
            <div
              key={index}
              className="h-[18px] w-[4px] rounded-[1px]"
              style={{ backgroundColor: active ? meterColor(ratio) : "hsl(var(--wstudio-panel-border))" }}
            />
          );
        })}
      </div>
      <div className="flex justify-between px-[2px] text-[6px] uppercase tracking-[0.15em] text-[hsl(var(--wstudio-dim))]">
        <span>∞</span>
        <span>350</span>
        <span>5.4k</span>
        <span>700</span>
        <span>320</span>
        <span>100</span>
        <span>50</span>
        <span>20</span>
      </div>
    </div>
  );
}

function RecordingWaveform({ recording }: { recording: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const styles = getComputedStyle(document.documentElement);
    const track = `hsl(${styles.getPropertyValue("--wstudio-track")})`;
    const border = `hsl(${styles.getPropertyValue("--wstudio-panel-border")} / 0.75)`;
    const stroke = recording
      ? `hsl(${styles.getPropertyValue("--wstudio-text")} / 0.68)`
      : `hsl(${styles.getPropertyValue("--wstudio-label")} / 0.35)`;

    let frame = 0;

    const draw = (time: number) => {
      const width = canvas.width;
      const height = canvas.height;
      context.fillStyle = track;
      context.fillRect(0, 0, width, height);

      context.strokeStyle = border;
      context.lineWidth = 1;
      for (let x = 0; x <= width; x += 64) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      context.beginPath();
      context.moveTo(0, height / 2);
      context.lineTo(width, height / 2);
      context.stroke();

      context.strokeStyle = stroke;
      context.lineWidth = 1.3;
      context.beginPath();
      for (let x = 0; x < width; x += 1) {
        const movement = recording ? time * 0.0026 : 0;
        const wave =
          Math.sin(x * 0.032 + movement) * 12 +
          Math.sin(x * 0.068 + movement * 0.8) * 7 +
          Math.sin(x * 0.16 + movement * 1.5) * 3;
        const taper = 0.42 + 0.58 * Math.sin((x / width) * Math.PI);
        const y = height / 2 + wave * taper;
        if (x === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();

      frame = window.requestAnimationFrame(draw);
    };

    frame = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frame);
  }, [recording]);

  return <canvas ref={canvasRef} width={1200} height={66} className="block h-[66px] w-full rounded-[3px]" />;
}

export default function UnifiedSessionScreen() {
  const {
    role,
    connection,
    sessionDisplayName,
    muted,
    toggleMute,
    talkbackHeld,
    beginTalkback,
    endTalkback,
    remoteVocalLevel,
    live,
    setSessionRecording,
    demoClock,
    leaveSession,
    toggleScreenShare,
    collaborationShareActive,
  } = useSession();

  const isEngineer = role === "engineer";
  const recording = live.recording;
  const [armed, setArmed] = useState(false);
  const connected = connection === "connected";
  const timerLabel = formatTimer(demoClock.remainingSeconds);
  const activeShare = collaborationShareActive;

  return (
    <div className="flex min-h-screen items-center justify-center overflow-hidden bg-[hsl(var(--wstudio-backdrop))] px-4 py-5 text-[hsl(var(--wstudio-text))]">
      <div className="wstudio-shell aspect-[1180/774] w-full max-w-[1180px]">
        <div className="flex h-[58px] items-center justify-between border-b border-[hsl(var(--wstudio-panel-border))] px-5">
          <div className="flex items-end gap-3">
            <div className="flex items-end gap-[2px] text-[21px] font-black tracking-[-0.05em] text-[hsl(var(--wstudio-text))]">
              <span>W</span>
              <span className="text-[hsl(var(--wstudio-blue))]">.</span>
              <span>STUDIO</span>
            </div>
            <span className="pb-[2px] text-[12px] font-light tracking-[0.1em] text-[hsl(var(--wstudio-label))]">RECEIVE</span>
          </div>
          <div className="flex items-center gap-3 text-[hsl(var(--wstudio-label))]">
            <button type="button" className="transition hover:text-[hsl(var(--wstudio-text))]">
              <Menu size={19} />
            </button>
            <button type="button" onClick={leaveSession} className="transition hover:text-[hsl(var(--wstudio-text))]">
              <X size={19} />
            </button>
          </div>
        </div>

        <div className="grid h-[calc(100%-58px)] gap-3 p-3" style={{ gridTemplateColumns: "0.94fr 1.36fr 0.92fr", gridTemplateRows: "0.70fr 1.08fr 1.12fr 0.84fr 0.50fr" }}>
          <div className="wstudio-panel overflow-hidden rounded-[5px]" style={{ gridColumn: "1", gridRow: "1 / span 3" }}>
            <div className="grid h-full grid-rows-[1fr_1fr_84px] gap-2 p-2">
              <VideoTile name="Jay - Florida" art={<ArtistBoothArt />} />
              <VideoTile name={activeShare ? "Shared Screen" : "Bob - New York"} art={activeShare ? <SharedScreenArt /> : <EngineerBoothArt />} />
              <div className="wstudio-inset grid grid-cols-3 overflow-hidden rounded-[4px]">
                <LeftControlCell
                  label="Mute"
                  icon={muted ? <MicOff size={22} className="text-[hsl(var(--wstudio-red))]" /> : <Mic size={22} className="text-[hsl(var(--wstudio-label))]" />}
                  active={muted}
                  onClick={toggleMute}
                />
                <div className="border-x border-[hsl(var(--wstudio-panel-border))]">
                  <LeftControlCell
                    label="Talk"
                    active={talkbackHeld}
                    onPointerDown={beginTalkback}
                    onPointerUp={endTalkback}
                    onPointerLeave={endTalkback}
                    icon={
                      <span className="wstudio-talk-orb flex h-9 w-9 items-center justify-center rounded-full text-[16px] text-white">
                        ▶
                      </span>
                    }
                  />
                </div>
                <LeftControlCell
                  label="Settings"
                  icon={<Settings size={22} className="text-[hsl(var(--wstudio-label))]" />}
                />
              </div>
            </div>
          </div>

          <div className="wstudio-panel flex items-center justify-between gap-3 rounded-[5px] px-4" style={{ gridColumn: "2 / span 2", gridRow: "1" }}>
            <div className="flex min-w-0 items-center gap-4">
              <span className="truncate text-[18px] font-medium tracking-[-0.02em] text-[hsl(var(--wstudio-text))]">
                {sessionDisplayName || "Session: Live with Jay - Florida"}
              </span>
              <span className={`wstudio-status-badge rounded-[4px] px-3 py-[5px] text-[11px] font-bold uppercase tracking-[0.08em] ${connected ? "" : "opacity-60"}`}>
                {connected ? "CONNECTED" : connection.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ToolbarButton>
                <Volume2 size={17} />
              </ToolbarButton>
              <ToolbarButton active={activeShare} disabled={!isEngineer} onClick={isEngineer ? toggleScreenShare : undefined}>
                <Monitor size={17} />
              </ToolbarButton>
              <ToolbarButton>
                <X size={17} />
              </ToolbarButton>
              <ToolbarButton>
                <Settings size={17} />
              </ToolbarButton>
              <span className="ml-2 min-w-[62px] text-right font-mono text-[12px] tracking-[0.14em] text-[hsl(var(--wstudio-text))]">
                {timerLabel}
              </span>
            </div>
          </div>

          <div className="wstudio-panel rounded-[5px] p-4" style={{ gridColumn: "2", gridRow: "2" }}>
            <PanelTitle title="Sync Controls" />
            <div className="mb-4 text-center text-[17px] font-semibold tracking-[-0.02em] text-[hsl(var(--wstudio-text))]">
              – SYNCED: 120 BPM –
            </div>
            <div className="flex items-center justify-center gap-2">
              <StudioActionButton symbol="▶" label="Play" disabled={!isEngineer} />
              <StudioActionButton symbol="■" label="Stop" disabled={!isEngineer} />
              <StudioActionButton
                symbol="●"
                label="Record"
                active={recording}
                danger={recording}
                disabled={!isEngineer}
                onClick={isEngineer ? () => setSessionRecording(!recording) : undefined}
              />
            </div>
          </div>

          <div className="wstudio-panel rounded-[5px] p-4" style={{ gridColumn: "3", gridRow: "2" }}>
            <PanelTitle
              title="Monitoring"
              right={
                <div className="flex gap-[2px]">
                  {[3, 5, 4, 6, 4, 3].map((height, index) => (
                    <div key={index} className="w-[3px] rounded-full bg-[hsl(var(--wstudio-label))] opacity-80" style={{ height: `${height * 2}px` }} />
                  ))}
                </div>
              }
            />
            <div className="grid grid-cols-2 gap-4">
              <MonitoringChannel label="Vocal Level" knobValue={0.52} meterLevel={remoteVocalLevel} faderValue={0.42} />
              <MonitoringChannel label="Talkback Level" knobValue={talkbackHeld ? 0.62 : 0.46} meterLevel={talkbackHeld ? 0.62 : 0.22} faderValue={talkbackHeld ? 0.36 : 0.12} />
            </div>
          </div>

          <div className="wstudio-panel rounded-[5px] p-4" style={{ gridColumn: "2", gridRow: "3" }}>
            <PanelTitle
              title="Vocal Input"
              right={
                <div className="flex items-center gap-[3px] rounded-[3px] border border-[hsl(var(--wstudio-panel-border))] bg-[hsl(var(--wstudio-track))] px-[5px] py-[2px]">
                  <div className="h-[10px] w-[5px] rounded-full bg-[hsl(var(--wstudio-blue))]" />
                  <div className="h-[10px] w-[5px] rounded-full bg-[hsl(var(--wstudio-yellow))]" />
                </div>
              }
            />
            <div className="mb-3 text-center text-[17px] font-bold uppercase tracking-[0.02em] text-[hsl(var(--wstudio-text))]">
              Remote Vocal
            </div>
            <RemoteSpectrum level={remoteVocalLevel} />
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                disabled={!isEngineer}
                onClick={isEngineer ? () => setArmed((current) => !current) : undefined}
                className={`wstudio-button h-[48px] min-w-[236px] rounded-[4px] px-8 text-[17px] font-semibold uppercase tracking-[0.02em] ${armed ? "wstudio-button-danger" : ""} ${!isEngineer ? "cursor-not-allowed opacity-45" : ""}`}
              >
                ARM RECORD
              </button>
            </div>
          </div>

          <div className="wstudio-panel rounded-[5px] p-4" style={{ gridColumn: "3", gridRow: "3" }}>
            <PanelTitle title="Effects" />
            <div className="flex items-center justify-around gap-3 pt-1">
              <StudioKnob label="Comp" value={0.34} size={72} />
              <StudioKnob label="EQ" value={0.48} size={72} />
              <StudioKnob label="Reverb" value={0.58} size={72} />
            </div>
          </div>

          <div className="wstudio-panel rounded-[5px] p-3" style={{ gridColumn: "1 / span 3", gridRow: "4" }}>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[14px] font-semibold tracking-[-0.02em] text-[hsl(var(--wstudio-text))]">
                Jay&apos;s Vocal Take 4 - {recording ? "Recording..." : "Ready..."}
              </span>
              <span className="text-[hsl(var(--wstudio-label))]">
                <Pause size={13} />
              </span>
            </div>
            <div className="wstudio-inset overflow-hidden rounded-[4px] px-2 py-[6px]">
              <RecordingWaveform recording={recording} />
            </div>
          </div>

          <div className="wstudio-panel flex items-center gap-3 rounded-[5px] px-4 py-2" style={{ gridColumn: "1 / span 3", gridRow: "5" }}>
            <TransportButton symbol="▌▌" label="Punch In" disabled={!isEngineer} />
            <TransportButton symbol="<<" label="Rewind" disabled={!isEngineer} />
            <TransportButton symbol=">>" label="Forward" disabled={!isEngineer} />

            <div className={`wstudio-button ml-2 flex h-[40px] min-w-[258px] items-center justify-center gap-2 rounded-[4px] px-5 text-[17px] font-semibold tracking-[0.01em] ${recording ? "wstudio-button-danger" : ""}`}>
              <span className={`${recording ? "animate-pulse" : ""}`} style={{ color: "hsl(var(--wstudio-red))" }}>
                ●
              </span>
              <span style={{ color: recording ? "hsl(var(--wstudio-red))" : "hsl(var(--wstudio-label))" }}>REC</span>
              <span className="text-[hsl(var(--wstudio-text))]">{recording ? "● RECORDING..." : "READY"}</span>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-[3px] rounded-[4px] border border-[hsl(var(--wstudio-panel-border))] bg-[hsl(var(--wstudio-track))] px-2 py-1">
                <span className="h-[12px] w-[8px] rounded-[1px] bg-[hsl(var(--wstudio-green))]" />
                <span className="h-[12px] w-[8px] rounded-[1px] bg-[hsl(var(--wstudio-green))]" />
                <span className="h-[12px] w-[8px] rounded-[1px] bg-[hsl(var(--wstudio-yellow))]" />
                <span className="h-[12px] w-[8px] rounded-[1px] bg-[hsl(var(--wstudio-dim))]" />
              </div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em]">
                <span className="text-[hsl(var(--wstudio-label))]">Auto Upload:</span>
                <span className="font-bold text-[hsl(var(--wstudio-green))]">ON ▶</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
