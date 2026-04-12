import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  Mic,
  MonitorUp,
  Pause,
  Radio,
  Settings,
  Square,
  Volume2,
  Wrench,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { ConnectionState } from "../connection/connectionTypes";
import { toSessionStripConnection } from "../connection/connectionTypes";
import { VideoPanel } from "../video/VideoPanel";

const PANEL =
  "rounded-lg border border-zinc-700/90 bg-[#1a1a1a] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_4px_12px_rgba(0,0,0,0.35)]";

export function ReceiveTopChrome({
  demoMode,
  joinPath,
  onLeave,
}: {
  demoMode: boolean;
  joinPath: string;
  onLeave: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/90 bg-[#121212] px-3 py-2">
      <span className="text-[11px] font-bold tracking-[0.12em] text-white">W.STUDIO RECEIVE</span>
      <div className="flex items-center gap-1">
        {demoMode ? (
          <span className="mr-1 rounded border border-emerald-800/60 bg-emerald-950/40 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-emerald-300">
            Demo
          </span>
        ) : null}
        <button
          type="button"
          className="rounded-md p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Menu"
        >
          <Menu className="h-4 w-4" />
        </button>
        <Link
          to={joinPath}
          onClick={onLeave}
          className="rounded-md p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Close session"
        >
          <X className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export function ReceiveSessionStrip({
  sessionTitle,
  connection,
  timerLabel,
  onVolumeClick,
  onShareClick,
  onToolsClick,
  onSettingsClick,
}: {
  sessionTitle: string;
  /** Full transport state (degraded is shown with a warning label). */
  connection: ConnectionState;
  timerLabel?: string;
  onVolumeClick?: () => void;
  onShareClick?: () => void;
  onToolsClick?: () => void;
  onSettingsClick?: () => void;
}) {
  const strip = toSessionStripConnection(connection);
  const connected = strip === "connected";
  const degraded = connection === "degraded";
  const badgeLabel = degraded ? "Degraded" : connected ? "Connected" : strip;
  return (
    <div className={cn(PANEL, "flex flex-wrap items-center gap-2 px-3 py-2")}>
      <p className="min-w-0 flex-1 truncate text-xs text-zinc-200">{sessionTitle}</p>
      <span
        className={cn(
          "shrink-0 rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
          connected
            ? "bg-emerald-900/50 text-emerald-300 ring-1 ring-emerald-600/40"
            : degraded
              ? "bg-orange-900/50 text-orange-200 ring-1 ring-orange-600/40"
              : "bg-zinc-800 text-zinc-500",
        )}
      >
        {badgeLabel}
      </span>
      {timerLabel ? (
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-amber-200/90">{timerLabel}</span>
      ) : null}
      <div className="ml-auto flex items-center gap-0.5">
        <IconToolBtn label="Volume" onClick={onVolumeClick}>
          <Volume2 className="h-4 w-4" />
        </IconToolBtn>
        <IconToolBtn label="Screen share" onClick={onShareClick}>
          <MonitorUp className="h-4 w-4" />
        </IconToolBtn>
        <IconToolBtn label="Tools" onClick={onToolsClick}>
          <Wrench className="h-4 w-4" />
        </IconToolBtn>
        <IconToolBtn label="Settings" onClick={onSettingsClick}>
          <Settings className="h-4 w-4" />
        </IconToolBtn>
      </div>
    </div>
  );
}

function IconToolBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className="rounded-md p-2 text-zinc-500 transition hover:bg-zinc-800/80 hover:text-zinc-300"
    >
      {children}
    </button>
  );
}

/** Large primary remote, optional corner PiP for self. */
export function ReceivePrimaryRemoteWithPip({
  remoteTitle,
  remoteSubtitle,
  pipTitle,
  pipSubtitle,
  showPip = true,
  remoteStream,
  pipStream,
  remoteVideoMuted = false,
  pipVideoMuted = true,
  remoteVolume = 1,
}: {
  remoteTitle: string;
  remoteSubtitle?: string;
  pipTitle: string;
  pipSubtitle?: string;
  showPip?: boolean;
  remoteStream?: MediaStream | null;
  pipStream?: MediaStream | null;
  remoteVideoMuted?: boolean;
  pipVideoMuted?: boolean;
  /** 0–1 remote tile output (e.g. engineer headphone bus). */
  remoteVolume?: number;
}) {
  return (
    <div className={cn(PANEL, "relative min-h-[200px] flex-1 overflow-hidden")}>
      <VideoPanel
        title={remoteTitle}
        subtitle={remoteSubtitle ?? "Waiting for peer…"}
        stream={remoteStream}
        videoMuted={remoteVideoMuted}
        volume={remoteVolume}
        className="min-h-[220px] h-full flex-1 rounded-lg"
      />
      {showPip ? (
        <div className="pointer-events-none absolute bottom-3 right-3 z-10 w-[38%] max-w-[200px] min-h-[110px] overflow-hidden rounded-lg shadow-lg ring-2 ring-black/70">
          <VideoPanel
            title={pipTitle}
            subtitle={pipSubtitle ?? "Self view"}
            stream={pipStream}
            mirrored
            videoMuted={pipVideoMuted}
            className="!min-h-[110px] h-full"
          />
        </div>
      ) : null}
    </div>
  );
}

export function ReceiveVideoStack({
  artistTitle,
  engineerTitle,
  artistSubtitle = "Artist (remote)",
  engineerSubtitle = "You (engineer)",
  artistStream,
  engineerStream,
  artistVideoMuted = false,
  engineerVideoMuted = true,
}: {
  artistTitle: string;
  engineerTitle: string;
  artistSubtitle?: string;
  engineerSubtitle?: string;
  artistStream?: MediaStream | null;
  engineerStream?: MediaStream | null;
  artistVideoMuted?: boolean;
  engineerVideoMuted?: boolean;
}) {
  return (
    <div className={cn(PANEL, "flex flex-col gap-2 p-2")}>
      <VideoPanel
        title={artistTitle}
        subtitle={artistSubtitle}
        stream={artistStream}
        videoMuted={artistVideoMuted}
        className="min-h-[120px] flex-1"
      />
      <VideoPanel
        title={engineerTitle}
        subtitle={engineerSubtitle}
        stream={engineerStream}
        mirrored
        videoMuted={engineerVideoMuted}
        className="min-h-[120px] flex-1"
      />
    </div>
  );
}

/** Push-to-talk: hold Talk, release to mute. */
export function ReceiveTalkRow({
  muted,
  talkbackActive,
  onMute,
  onTalkDown,
  onTalkUp,
  onSettings,
  disabled,
}: {
  muted: boolean;
  talkbackActive: boolean;
  onMute: () => void;
  onTalkDown: () => void;
  onTalkUp: () => void;
  onSettings: () => void;
  disabled?: boolean;
}) {
  const btn =
    "flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-zinc-700/80 bg-zinc-900/90 py-3 text-[9px] font-semibold uppercase tracking-wide text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-40 select-none touch-manipulation";
  return (
    <div className="grid grid-cols-3 gap-2">
      <button type="button" disabled={disabled} onClick={onMute} className={cn(btn, muted && "border-rose-700/50 bg-rose-950/30 text-rose-200")}>
        <Mic className="h-5 w-5 text-zinc-300" />
        Mute
      </button>
      <button
        type="button"
        disabled={disabled}
        onPointerDown={(e) => {
          e.preventDefault();
          onTalkDown();
        }}
        onPointerUp={onTalkUp}
        onPointerLeave={onTalkUp}
        onTouchStart={(e) => {
          e.preventDefault();
          onTalkDown();
        }}
        onTouchEnd={onTalkUp}
        className={cn(
          btn,
          talkbackActive ? "border-sky-600/70 bg-sky-950/40 text-sky-200 ring-1 ring-sky-500/30" : "",
        )}
      >
        <Radio className="h-5 w-5" />
        Talk
        <span className="text-[7px] font-normal normal-case text-zinc-500">Hold</span>
      </button>
      <button type="button" disabled={disabled} onClick={onSettings} className={btn}>
        <Settings className="h-5 w-5 text-zinc-300" />
        Settings
      </button>
    </div>
  );
}

export function ReceiveSyncPanel({
  disabled,
  onPlay,
  onStop,
  onRecord,
  recording = false,
  recordArmed = false,
}: {
  disabled?: boolean;
  onPlay?: () => void;
  onStop?: () => void;
  onRecord?: () => void;
  recording?: boolean;
  recordArmed?: boolean;
}) {
  const big =
    "flex flex-1 flex-col items-center justify-center rounded-lg border border-zinc-600/80 bg-gradient-to-b from-zinc-800 to-zinc-900 py-4 text-[10px] font-bold uppercase tracking-wide text-zinc-200 shadow-md disabled:opacity-40";
  const recordLocked = !recording && !recordArmed;
  return (
    <div className={cn(PANEL, "p-3")}>
      <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Sync controls</div>
      <p className="mb-3 text-center text-[10px] text-zinc-400">— Synced: 120 BPM —</p>
      <div className="flex gap-2">
        <button type="button" disabled={disabled} className={big} onClick={onPlay}>
          Play
        </button>
        <button type="button" disabled={disabled} className={big} onClick={onStop}>
          Stop
        </button>
        <button
          type="button"
          disabled={disabled || recordLocked}
          className={cn(
            big,
            recording
              ? "border-red-700/70 bg-gradient-to-b from-red-950/80 to-zinc-900 text-red-100 shadow-[0_0_16px_rgba(220,38,38,0.25)]"
              : "border-rose-800/60 text-rose-200",
            recordLocked && "opacity-45",
          )}
          onClick={onRecord}
        >
          <span
            className={cn(
              "mb-0.5 inline-block h-2 w-2 rounded-full bg-red-500",
              recording && "animate-pulse",
            )}
          />
          Record
        </button>
      </div>
    </div>
  );
}

export function ReceiveVocalInputPanel({
  level,
  channel,
  onChannel,
  onArm,
  armed,
  disabled,
}: {
  level: number;
  channel: 1 | 2 | 3;
  onChannel: (c: 1 | 2 | 3) => void;
  onArm: () => void;
  armed: boolean;
  disabled?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, level * 100));
  return (
    <div className={cn(PANEL, "p-3")}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Vocal input</span>
        <div className="flex gap-1">
          {([1, 2, 3] as const).map((c) => (
            <button
              key={c}
              type="button"
              disabled={disabled}
              onClick={() => onChannel(c)}
              className={cn(
                "h-6 w-6 rounded border text-[10px] font-bold",
                channel === c
                  ? "border-amber-500/70 bg-amber-950/50 text-amber-100"
                  : "border-zinc-700 bg-zinc-900 text-zinc-500",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-zinc-500">Remote vocal</div>
      <div className="mb-3 h-4 overflow-hidden rounded-sm bg-zinc-950 ring-1 ring-zinc-800">
        <div
          className="h-full rounded-sm bg-gradient-to-r from-emerald-600 via-amber-500 to-red-600 transition-[width] duration-75"
          style={{ width: `${pct}%` }}
        />
      </div>
      <button
        type="button"
        disabled={disabled || recording}
        onClick={onArm}
        className={cn(
          "w-full rounded-lg border py-3 text-xs font-bold uppercase tracking-wide transition",
          armed
            ? "border-amber-500/60 bg-amber-950/50 text-amber-100"
            : "border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700",
        )}
      >
        Arm record
      </button>
    </div>
  );
}

function VerticalLeds({
  value,
  count = 12,
  variant = "meter",
}: {
  value: number;
  count?: number;
  /** `meter` = VU-style colors; `control` = neutral steps for mix setpoints only */
  variant?: "meter" | "control";
}) {
  const lit = Math.round((value / 100) * count);
  return (
    <div className="flex flex-col-reverse gap-0.5" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const on = i < lit;
        if (variant === "control") {
          return (
            <div
              key={i}
              className="h-1 w-4 rounded-[1px]"
              style={{
                backgroundColor: on ? "#3a3d42" : "#18191c",
                boxShadow: on ? "inset 0 1px 0 rgba(255,255,255,0.05)" : undefined,
              }}
            />
          );
        }
        return (
          <div
            key={i}
            className={cn(
              "h-1 w-4 rounded-[1px]",
              on ? (i > 8 ? "bg-red-500/90" : i > 5 ? "bg-amber-400/90" : "bg-emerald-500/90") : "bg-zinc-800",
            )}
          />
        );
      })}
    </div>
  );
}

function HardwareKnob({ label, value, size = "lg" }: { label: string; value: number; size?: "lg" | "sm" }) {
  const deg = -135 + (value / 100) * 270;
  const dim = size === "lg" ? "h-[4.5rem] w-[4.5rem]" : "h-14 w-14";
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "relative rounded-full bg-gradient-to-b from-zinc-500 via-zinc-700 to-zinc-900 shadow-[inset_0_2px_4px_rgba(255,255,255,0.12),0_6px_14px_rgba(0,0,0,0.5)] ring-2 ring-black/60",
          dim,
        )}
      >
        <div className="absolute inset-[5px] rounded-full bg-gradient-to-b from-zinc-800 to-zinc-950" />
        <div
          className="absolute bottom-1/2 left-1/2 h-[35%] w-0.5 origin-bottom rounded-full bg-zinc-950"
          style={{ transform: `translateX(-50%) rotate(${deg}deg)` }}
        />
        <div className="pointer-events-none absolute inset-[18%] rounded-full bg-gradient-to-br from-zinc-700/30 to-transparent" />
      </div>
      <span className="max-w-[5rem] text-center text-[8px] font-semibold uppercase leading-tight tracking-wide text-zinc-500">
        {label}
      </span>
    </div>
  );
}

export function ReceiveMonitoringPanel({
  vocalKnobDisplay,
  talkbackKnobDisplay,
}: {
  /** 0–100 mix setpoint (knob + ladder — not live audio) */
  vocalKnobDisplay: number;
  talkbackKnobDisplay: number;
}) {
  return (
    <div className={cn(PANEL, "p-3")}>
      <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Monitoring</div>
      <div className="flex justify-around gap-2">
        <div className="flex items-end gap-2">
          <HardwareKnob label="Vocal level" value={vocalKnobDisplay} />
          <VerticalLeds value={vocalKnobDisplay} variant="control" />
        </div>
        <div className="flex items-end gap-2">
          <HardwareKnob label="Talkback level" value={talkbackKnobDisplay} />
          <VerticalLeds value={talkbackKnobDisplay} variant="control" />
        </div>
      </div>
    </div>
  );
}

export function ReceiveRightColumnWrap({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 lg:col-span-4">{children}</div>;
}

export function ReceiveEffectsPanel() {
  return (
    <div className={cn(PANEL, "p-3")}>
      <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Effects</div>
      <div className="flex justify-around">
        <HardwareKnob label="Comp" value={42} size="sm" />
        <HardwareKnob label="EQ" value={58} size="sm" />
        <HardwareKnob label="Reverb" value={33} size="sm" />
      </div>
    </div>
  );
}

export function ReceiveRoutingPanel() {
  return (
    <div className={cn(PANEL, "p-3")}>
      <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Routing status</div>
      <ul className="space-y-1 text-[10px] leading-snug text-zinc-500">
        <li>• Artist monitor send: ready</li>
        <li>• Record arm / takes: follow vocal panel</li>
        <li>• Buffer health: OK</li>
      </ul>
    </div>
  );
}

export function ReceiveWaveformFooter({
  vocalLevel,
  recording,
  disabled,
  recordArmed = false,
  takeCaptured = false,
  playing = false,
}: {
  vocalLevel: number;
  recording: boolean;
  disabled?: boolean;
  recordArmed?: boolean;
  takeCaptured?: boolean;
  playing?: boolean;
}) {
  const bars = useMemo(() => {
    const n = 48;
    const v = Math.min(1, Math.max(0, vocalLevel));
    return Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1);
      const shape = 0.15 + 0.85 * Math.sin(t * Math.PI);
      return Math.min(1, Math.max(0.02, v * shape));
    });
  }, [vocalLevel]);

  const takeLabel = recording
    ? "Recording…"
    : takeCaptured
      ? "Take saved"
      : recordArmed
        ? "Armed — ready"
        : playing
          ? "Playing"
          : "Ready";

  return (
    <div className={cn(PANEL, "overflow-hidden")}>
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-3 py-1.5">
        <span className="text-[10px] font-medium text-zinc-400">
          Jay&apos;s vocal take 4 · {takeLabel}
        </span>
        <Pause className="h-3.5 w-3.5 text-zinc-600" />
      </div>
      <div
        className={cn(
          "flex h-14 items-end gap-px bg-zinc-950 px-1 pb-1 pt-2",
          recording && "motion-safe:animate-pulse",
        )}
      >
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-[1px] bg-gradient-to-t from-emerald-900/40 via-amber-600/60 to-red-500/70"
            style={{ height: `${h * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800/80 bg-zinc-900/50 px-2 py-2">
        <button
          type="button"
          disabled={disabled}
          className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-[9px] font-bold uppercase text-zinc-300"
        >
          Punch in
        </button>
        <button type="button" disabled={disabled} className="rounded-md border border-zinc-700 p-1.5 text-zinc-400">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" disabled={disabled} className="rounded-md border border-zinc-700 p-1.5 text-zinc-400">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "ml-auto flex items-center gap-2 rounded-lg border px-4 py-2 text-[10px] font-bold uppercase tracking-wide",
            recording
              ? "border-red-600/80 bg-red-950/60 text-red-200 shadow-[0_0_20px_rgba(220,38,38,0.35)]"
              : recordArmed
                ? "border-amber-600/70 bg-amber-950/40 text-amber-100"
                : "border-zinc-600 bg-zinc-800 text-zinc-400",
          )}
        >
          <span
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              recording ? "animate-pulse bg-red-500" : recordArmed ? "bg-amber-400" : "bg-zinc-600",
            )}
          />
          Rec ·{" "}
          {recording ? "Recording…" : recordArmed ? "Armed" : takeCaptured ? "Take saved" : "Idle"}
        </button>
        <div className="flex items-center gap-2 pl-2">
          <VerticalLeds value={45} count={8} />
          <span className="text-[9px] font-semibold uppercase text-emerald-400">Auto upload: on</span>
        </div>
      </div>
    </div>
  );
}

export { PANEL };
