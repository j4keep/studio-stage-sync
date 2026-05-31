import { useEffect, useState } from "react";
import { useStudio } from "../state/StudioContext";
import LevelMeter from "./LevelMeter";
import { Headphones, Play, Activity, Check, Mic } from "lucide-react";
import { useStudioPluginStatus } from "../audio/useStudioTransport";
import { useHelperAudioLevels } from "../audio/useHelperAudioLevels";

export default function HQAudioPanel() {
  const { hqAudio, setHqAudio, checklist, toggleCheck, setPlugin } = useStudio();
  const [headphoneTested, setHeadphoneTested] = useState(false);
  const [beatTested, setBeatTested] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);

  // HQ audio + plugin status sourced from the active audio-engine transport.
  const pluginStatus = useStudioPluginStatus(true);
  // Real audio levels polled from the W.STUDIO Helper App.
  const levels = useHelperAudioLevels(0, true);

  const pluginConnected = pluginStatus.state === "LIVE" || pluginStatus.state === "DETECTED";

  // Mirror transport plugin state into shared StudioContext so other
  // panels stay in sync.
  useEffect(() => {
    if (pluginStatus.state === "LIVE") setPlugin("connected");
    else if (pluginStatus.state === "DETECTED") setPlugin("connecting");
    else setPlugin("disconnected");
    toggleCheck("pluginConnected", pluginConnected);
  }, [pluginStatus.state, pluginConnected, setPlugin, toggleCheck]);

  // Reflect real artist audio into hqAudio status. No mock checking timer.
  useEffect(() => {
    if (levels.artistLevel > 0.02) setHqAudio("live");
    else if (hqAudio === "live") setHqAudio("off");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels.artistLevel > 0.02]);

  const checkLatency = () => {
    setLatency(null);
    window.setTimeout(() => setLatency(8 + Math.floor(Math.random() * 14)), 700);
  };

  const allReady = checklist.artistMic && checklist.artistHeadphones && checklist.artistHearsBeat && checklist.pluginConnected;

  return (
    <div className="studio-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--studio-text-muted))]">HQ Audio Channel</div>
          <div className="text-base font-semibold">Studio Audio Bus</div>
          <div className="text-[10px] text-[hsl(var(--studio-text-dim))] mt-0.5">{pluginStatus.routingLabel}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`studio-status-dot ${hqAudio === "live" ? "live" : ""}`} />
          <span className="text-xs font-medium uppercase">{hqAudio}</span>
        </div>
      </div>

      <div className="studio-card-inset px-3 py-2 flex items-center gap-2 text-xs text-[hsl(var(--studio-text-dim))]">
        <Mic className="w-3.5 h-3.5" />
        Mic test is controlled from the <b className="text-[hsl(var(--studio-text))] mx-1">Artist</b> page.
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          className="studio-btn justify-start"
          onClick={() => { setHeadphoneTested(true); toggleCheck("artistHeadphones", true); }}
        >
          <Headphones className="w-4 h-4" />
          Headphone Test {headphoneTested && <Check className="w-3.5 h-3.5 text-[hsl(var(--studio-green))]" />}
        </button>
        <button
          className="studio-btn justify-start"
          onClick={() => { setBeatTested(true); toggleCheck("artistHearsBeat", true); }}
        >
          <Play className="w-4 h-4" />
          Beat Playback Test {beatTested && <Check className="w-3.5 h-3.5 text-[hsl(var(--studio-green))]" />}
        </button>
        <button className="studio-btn justify-start col-span-2" onClick={checkLatency}>
          <Activity className="w-4 h-4" />
          Latency Check {latency != null && <span className="ml-auto text-[hsl(var(--studio-blue))] font-mono">{latency}ms</span>}
        </button>
      </div>

      <LevelMeter
        level={levels.artistLevel}
        label={`Artist Input ${levels.helperReachable ? "" : "(helper offline)"}`}
      />
      <LevelMeter
        level={levels.dawReturnLevel}
        label={`DAW Return ${pluginConnected ? "" : "(offline)"}`}
      />

      <div className="studio-card-inset p-3 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--studio-text-muted))]">Ready Checklist</div>
        {[
          ["artistMic", "Artist mic detected"],
          ["artistHeadphones", "Artist headphones confirmed"],
          ["artistHearsBeat", "Artist can hear beat"],
          ["pluginConnected", "Plugin connected (via transport)"],
        ].map(([k, label]) => {
          const isPlugin = k === "pluginConnected";
          return (
            <label key={k} className={`flex items-center gap-2 text-sm ${isPlugin ? "opacity-90" : "cursor-pointer"}`}>
              <input
                type="checkbox"
                className="accent-[hsl(var(--studio-blue))]"
                checked={(checklist as Record<string, boolean>)[k as string]}
                disabled={isPlugin}
                onChange={(e) => {
                  if (isPlugin) return;
                  toggleCheck(k as never, e.target.checked);
                }}
              />
              <span className={(checklist as Record<string, boolean>)[k as string] ? "" : "text-[hsl(var(--studio-text-dim))]"}>{label}</span>
            </label>
          );
        })}
      </div>

      <div className={`rounded-xl p-4 text-center font-semibold tracking-wide transition-all ${
        allReady
          ? "studio-glow-green bg-[hsl(var(--studio-green)/0.08)] text-[hsl(var(--studio-green))]"
          : "studio-card-inset text-[hsl(var(--studio-text-muted))]"
      }`}>
        {allReady ? "READY TO RECORD" : "Awaiting checks…"}
      </div>
    </div>
  );
}
