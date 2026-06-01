import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useStudio } from "../state/StudioContext";
import { useArtistSessionSync } from "../state/sessionSync";
import LevelMeter from "./LevelMeter";
import { useStudioPluginStatus } from "../audio/useStudioTransport";

/**
 * Engineer-side HQ Audio panel.
 *
 * Reads real data only:
 *  - Artist input level → shared session state from the artist tab
 *  - DAW return level   → helper plugin feed (0 until helper emits real data)
 *  - Plugin connected   → helper /status (plugin.connected or fresh PLUGIN_STATE)
 *
 * No fake meter animation. No mic-test / beat-test / latency-check buttons.
 */
export default function HQAudioPanel() {
  const { sessionId } = useParams();
  const { status: artistStatus } = useArtistSessionSync(sessionId);
  const { checklist, toggleCheck, setPlugin } = useStudio();

  const pluginStatus = useStudioPluginStatus(true);
  const pluginConnected = pluginStatus.state === "LIVE" || pluginStatus.state === "DETECTED";
  const pluginLive = pluginStatus.state === "LIVE";

  // Mirror helper-reported plugin state into shared StudioContext.
  useEffect(() => {
    setPlugin(pluginConnected ? (pluginLive ? "connected" : "connecting") : "disconnected");
    toggleCheck("pluginConnected", pluginConnected);
  }, [pluginConnected, pluginLive, setPlugin, toggleCheck]);

  const allReady =
    checklist.artistMic &&
    checklist.artistHeadphones &&
    checklist.artistHearsBeat &&
    checklist.pluginConnected;

  return (
    <div className="studio-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--studio-text-muted))]">HQ Audio Channel</div>
          <div className="text-base font-semibold">Studio Audio Bus</div>
          <div className="text-[10px] text-[hsl(var(--studio-text-dim))] mt-0.5">{pluginStatus.routingLabel}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`studio-status-dot ${pluginLive ? "live" : pluginConnected ? "warn" : ""}`} />
          <span className="text-xs font-medium uppercase">
            {pluginLive ? "live" : pluginConnected ? "ready" : "offline"}
          </span>
        </div>
      </div>

      <LevelMeter
        label="Artist Input"
        level={artistStatus.micLevel}
        active={artistStatus.micLive}
        offlineLabel={artistStatus.micLive ? undefined : "mic off"}
      />
      <LevelMeter
        label="DAW Return"
        level={artistStatus.dawReturnLevel}
        active={pluginLive}
        offlineLabel={pluginLive ? undefined : "plugin offline"}
      />

      <div className="studio-card-inset p-3 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--studio-text-muted))]">Artist Checklist</div>
        {[
          ["artistMic", "Artist mic detected", artistStatus.micLive],
          ["artistHeadphones", "Artist headphones confirmed", artistStatus.headphonesOk],
          ["artistHearsBeat", "Artist can hear beat", artistStatus.artistCanHearBeat],
          ["artistReady", "Artist ready", artistStatus.artistReady],
          ["pluginConnected", "Plugin connected", pluginConnected],
        ].map(([k, label, on]) => (
          <div key={String(k)} className="flex items-center gap-2 text-sm">
            <span className={`studio-status-dot ${on ? "live" : ""}`} />
            <span className={on ? "" : "text-[hsl(var(--studio-text-dim))]"}>{label}</span>
          </div>
        ))}
      </div>

      <div className={`rounded-xl p-4 text-center font-semibold tracking-wide transition-all ${
        allReady
          ? "studio-glow-green bg-[hsl(var(--studio-green)/0.08)] text-[hsl(var(--studio-green))]"
          : "studio-card-inset text-[hsl(var(--studio-text-muted))]"
      }`}>
        {allReady ? "READY TO RECORD" : "Awaiting artist + plugin…"}
      </div>
    </div>
  );
}
