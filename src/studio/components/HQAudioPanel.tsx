import { useEffect, useState } from "react";
import { useStudio } from "../state/StudioContext";
import LevelMeter from "./LevelMeter";
import { Headphones, Play, Activity, Check } from "lucide-react";

export default function HQAudioPanel() {
  const { hqAudio, setHqAudio, checklist, toggleCheck, setPlugin, plugin } = useStudio();
  const [headphoneTested, setHeadphoneTested] = useState(false);
  const [beatTested, setBeatTested] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    if (hqAudio === "checking") {
      const t = window.setTimeout(() => setHqAudio("live"), 1600);
      return () => window.clearTimeout(t);
    }
  }, [hqAudio, setHqAudio]);

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
        </div>
        <div className="flex items-center gap-2">
          <span className={`studio-status-dot ${hqAudio === "live" ? "live" : hqAudio === "checking" ? "warn" : ""}`} />
          <span className="text-xs font-medium uppercase">{hqAudio}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button className="studio-btn justify-start" onClick={() => setHqAudio(hqAudio === "off" ? "checking" : "off")}>
          <Activity className="w-4 h-4" />
          {hqAudio === "off" ? "Start Mic Test" : "Stop Test"}
        </button>
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
        <button className="studio-btn justify-start" onClick={checkLatency}>
          <Activity className="w-4 h-4" />
          Latency Check {latency != null && <span className="ml-auto text-[hsl(var(--studio-blue))] font-mono">{latency}ms</span>}
        </button>
      </div>

      <LevelMeter active={hqAudio !== "off"} label="Mic Input" />
      <LevelMeter active={hqAudio === "live"} label="HQ Bus" />

      <div className="studio-card-inset p-3 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--studio-text-muted))]">Ready Checklist</div>
        {[
          ["artistMic", "Artist mic detected"],
          ["artistHeadphones", "Artist headphones confirmed"],
          ["artistHearsBeat", "Artist can hear beat"],
          ["pluginConnected", "Plugin connected"],
        ].map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="accent-[hsl(var(--studio-blue))]"
              checked={(checklist as any)[k]}
              onChange={(e) => {
                if (k === "pluginConnected") setPlugin(e.target.checked ? "connected" : "disconnected");
                toggleCheck(k as any, e.target.checked);
              }}
            />
            <span className={(checklist as any)[k] ? "" : "text-[hsl(var(--studio-text-dim))]"}>{label}</span>
          </label>
        ))}
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
