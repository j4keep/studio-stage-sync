import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  getActiveHelperTransport,
  type HelperStatus,
} from "@/wstudio/audio-engine/helper";
import {
  getActivePluginTransport,
  type PluginConnectionInfo,
  type PluginErrorEvent,
  type PluginMetersFrame,
} from "@/wstudio/audio-engine/plugin";
import type { ArtistLevelFrame, DawReturnFrame } from "@/wstudio/audio-engine/helper";

/**
 * /studio — DEV-ONLY Native Integration Readiness panel.
 *
 * Floats fixed in the corner of /studio routes; renders nothing in
 * production builds. Reads exclusively from the HelperTransport and
 * PluginTransport contracts — no localhost / JUCE / native code.
 */
export default function NativeIntegrationReadinessPanel() {
  if (!import.meta.env.DEV) return null;

  const helper = getActiveHelperTransport();
  const plugin = getActivePluginTransport();

  const [open, setOpen] = useState(true);

  // Helper state
  const [helperStatus, setHelperStatus] = useState<HelperStatus>(helper.getStatus());
  const [artistLevel, setArtistLevel] = useState<ArtistLevelFrame | null>(null);
  const [dawReturn, setDawReturn] = useState<DawReturnFrame | null>(null);

  // Plugin state
  const [pluginInfo, setPluginInfo] = useState<PluginConnectionInfo | null>(null);
  const [pluginMeters, setPluginMeters] = useState<PluginMetersFrame | null>(null);
  const [pluginError, setPluginError] = useState<PluginErrorEvent | null>(null);

  // Control surface snapshot (dev only — tracked locally via outgoing sendControlState).
  // We don't have a subscription for control state in the contract, so we just
  // surface whatever the mock initialised with as a starting view.
  const [selectedArtist] = useState<string | null>(null);
  const [gain] = useState<number>(0);
  const [talkActive, setTalkActive] = useState(false);
  const [monitorActive, setMonitorActive] = useState(true);

  useEffect(() => {
    const offHelper = helper.subscribeToHelperStatus(setHelperStatus);
    const offLevel = helper.subscribeToArtistLevel(setArtistLevel);
    const offReturn = helper.subscribeToDawReturn(setDawReturn);
    const offPlugin = plugin.subscribePluginConnection(setPluginInfo);
    const offMeters = plugin.subscribePluginMeters((f) => {
      setPluginMeters(f);
      setTalkActive(f.talkbackPeak > 0.01);
      setMonitorActive(f.outputPeak > 0.01);
    });
    const offErr = plugin.subscribePluginErrors(setPluginError);
    return () => {
      offHelper(); offLevel(); offReturn();
      offPlugin(); offMeters(); offErr();
    };
  }, [helper, plugin]);

  const helperInstalled = helperStatus.state !== "NOT_INSTALLED";
  const helperRunning =
    helperStatus.state === "CONNECTING" || helperStatus.state === "CONNECTED";
  const pluginConnected = pluginInfo?.state === "CONNECTED";

  return (
    <div className="fixed bottom-3 right-3 z-[9999] w-[280px] text-[11px] font-mono pointer-events-auto">
      <div className="rounded-md border border-[hsl(var(--studio-border))] bg-[hsl(var(--studio-bg))]/95 backdrop-blur shadow-lg">
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] uppercase tracking-wider text-[hsl(var(--studio-text-muted))] hover:text-[hsl(var(--studio-text))]"
        >
          <span>Native Integration · dev</span>
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </button>

        {open && (
          <div className="px-3 pb-2 space-y-2">
            <Section title="HELPER">
              <Row k="transport" v={helper.id} />
              <Row k="state" v={helperStatus.state} tone={toneForHelper(helperStatus.state)} />
              <Row k="installed" v={helperInstalled ? "yes" : "no"} tone={helperInstalled ? "ok" : "warn"} />
              <Row k="running" v={helperRunning ? "yes" : "no"} tone={helperRunning ? "ok" : "warn"} />
              {helperStatus.error && <Row k="err" v={helperStatus.error} tone="err" />}
            </Section>

            <Section title="PLUGIN">
              <Row k="transport" v={plugin.id} />
              <Row k="state" v={pluginInfo?.state ?? "OFFLINE"} tone={toneForPlugin(pluginInfo?.state)} />
              <Row k="connected" v={pluginConnected ? "yes" : "no"} tone={pluginConnected ? "ok" : "warn"} />
              <Row k="artist" v={selectedArtist ?? "—"} />
              <Row k="gain" v={`${gain.toFixed(1)} dB`} />
              {pluginError && <Row k="lastErr" v={pluginError.message} tone={pluginError.fatal ? "err" : "warn"} />}
            </Section>

            <Section title="AUDIO">
              <Row k="artist lvl" v={fmtLevel(artistLevel?.peak ?? pluginMeters?.inputPeak ?? 0)} />
              <Row k="daw return" v={fmtLevel(dawReturn?.peak ?? pluginMeters?.outputPeak ?? 0)} />
              <Row k="talkback" v={talkActive ? "active" : "—"} tone={talkActive ? "ok" : undefined} />
              <Row k="monitor" v={monitorActive ? "active" : "—"} tone={monitorActive ? "ok" : undefined} />
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function toneForHelper(s: HelperStatus["state"]) {
  if (s === "CONNECTED") return "ok";
  if (s === "ERROR") return "err";
  if (s === "CONNECTING") return "info";
  return "warn";
}
function toneForPlugin(s: PluginConnectionInfo["state"] | undefined) {
  if (s === "CONNECTED") return "ok";
  if (s === "ERROR") return "err";
  if (s === "CONNECTING") return "info";
  return "warn";
}
function fmtLevel(v: number) {
  return `${Math.round(Math.min(1, Math.max(0, v)) * 100)}%`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="studio-card-inset px-2 py-1.5 space-y-0.5">
      <div className="text-[9px] uppercase tracking-wider text-[hsl(var(--studio-text-muted))] mb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: "ok" | "warn" | "err" | "info" }) {
  const color =
    tone === "ok"   ? "text-[hsl(var(--studio-green))]" :
    tone === "warn" ? "text-[hsl(var(--studio-amber))]" :
    tone === "err"  ? "text-[hsl(var(--studio-red))]"   :
    tone === "info" ? "text-[hsl(var(--studio-blue))]"  :
                      "text-[hsl(var(--studio-text))]";
  return (
    <div className="flex gap-2 leading-tight">
      <span className="text-[hsl(var(--studio-text-muted))] w-16 shrink-0">{k}</span>
      <span className={`${color} break-all`}>{v}</span>
    </div>
  );
}
