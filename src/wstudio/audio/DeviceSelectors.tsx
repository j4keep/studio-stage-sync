import { useEffect, useState } from "react";

/** Mic / output device UI — enumerateDevices wiring can replace static lists later. */
export function MicInputSelector({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    let active = true;

    const readDevices = async () => {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        if (!active) return;
        setDevices(all.filter((device) => device.kind === "audioinput"));
      } catch {
        if (!active) return;
        setDevices([]);
      }
    };

    void readDevices();
    navigator.mediaDevices.addEventListener?.("devicechange", readDevices);

    return () => {
      active = false;
      navigator.mediaDevices.removeEventListener?.("devicechange", readDevices);
    };
  }, []);

  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Microphone</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-50"
      >
        <option value="default">Default input</option>
        {devices.map((device, index) => (
          <option key={device.deviceId || `${device.kind}-${index}`} value={device.deviceId}>
            {device.label || `Microphone ${index + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}

export function OutputSelector({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Output</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-50"
      >
        <option value="default">Default output</option>
        <option value="headphones">Headphones</option>
        <option value="interface">Audio interface</option>
      </select>
    </label>
  );
}
