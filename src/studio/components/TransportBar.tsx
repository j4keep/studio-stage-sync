import { useStudio } from "../state/StudioContext";
import { Mic, MicOff, Radio, Headphones } from "lucide-react";
import LevelMeter from "./LevelMeter";

export default function TransportBar() {
  const {
    isLive, setIsLive, isTalkback, setIsTalkback, isMonitor, setIsMonitor,
    micMuted, setMicMuted, artistGain, setArtistGain, setSessionState, sessionState,
  } = useStudio();

  const goLive = () => {
    const next = !isLive;
    setIsLive(next);
    setSessionState(next ? "recording" : sessionState === "recording" ? "paused" : sessionState);
  };

  return (
    <div className="studio-card p-4 flex flex-col lg:flex-row items-center gap-5">
      <button
        onClick={goLive}
        className={`studio-live-orb ${isLive ? "is-live" : ""}`}
        aria-pressed={isLive}
      >
        {isLive ? "● REC" : "LIVE"}
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className={`studio-btn ${isTalkback ? "studio-glow-blue" : ""}`}
          onClick={() => setIsTalkback(!isTalkback)}
        >
          <Radio className="w-4 h-4" /> Talkback
        </button>
        <button
          className={`studio-btn ${isMonitor ? "studio-glow-blue" : ""}`}
          onClick={() => setIsMonitor(!isMonitor)}
        >
          <Headphones className="w-4 h-4" /> Monitor
        </button>
        <button
          className={`studio-btn ${micMuted ? "studio-btn-danger" : ""}`}
          onClick={() => setMicMuted(!micMuted)}
        >
          {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />} {micMuted ? "Muted" : "Mute"}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="studio-knob"
          style={{ transform: `rotate(${(artistGain - 50) * 2.4}deg)` }}
          onWheel={(e) => {
            e.preventDefault();
            setArtistGain(Math.max(0, Math.min(100, artistGain + (e.deltaY < 0 ? 4 : -4))));
          }}
          title="Artist Gain (scroll to adjust)"
        />
        <div className="text-xs">
          <div className="text-[hsl(var(--studio-text-muted))] uppercase tracking-wider">Artist Gain</div>
          <div className="font-mono text-[hsl(var(--studio-blue))]">{artistGain}</div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-3 w-full min-w-[200px]">
        <LevelMeter active={!micMuted} label="Input" />
        <LevelMeter active={isMonitor} label="Output" />
      </div>

      <div className="text-xs text-[hsl(var(--studio-text-dim))]">
        Selected: <span className="text-[hsl(var(--studio-text))] font-medium">Artist 1</span>
      </div>
    </div>
  );
}
