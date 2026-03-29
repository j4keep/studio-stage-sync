import { useState, useRef } from "react";
import { ArrowLeft, Music, Download, Image, MoreHorizontal, Mic, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { TakeLocal } from "./DAWScreen";

interface ExportScreenProps {
  sessionName: string;
  takes: TakeLocal[];
  activeTakeId: string | null;
  isExporting: boolean;
  onExport: (title: string, artist: string, format: string, artwork: File | null) => void;
  onBack: () => void;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

/* Combined waveform preview (blue + purple gradient) */
function ExportWaveform({ peaks }: { peaks: number[] }) {
  const displayed = peaks.length > 100
    ? Array.from({ length: 100 }, (_, i) => peaks[Math.floor(i * peaks.length / 100)])
    : peaks.length > 0 ? peaks : Array.from({ length: 100 }, () => 0.15 + Math.random() * 0.5);

  return (
    <div className="flex items-center h-full w-full gap-[0.3px] px-1">
      {displayed.map((peak, i) => {
        const h = Math.max(peak * 85, 3);
        const pct = i / displayed.length;
        // Gradient from cyan to purple
        const r = Math.round(99 + pct * 84);
        const g = Math.round(179 - pct * 60);
        const b = Math.round(237 + pct * 7);
        const color = `rgb(${r},${g},${b})`;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-center" style={{ minWidth: 1 }}>
            <div style={{ height: `${h / 2}%`, background: color, opacity: 0.8, borderRadius: "1px 1px 0 0", width: "100%" }} />
            <div style={{ height: `${h / 2}%`, background: color, opacity: 0.4, borderRadius: "0 0 1px 1px", width: "100%" }} />
          </div>
        );
      })}
    </div>
  );
}

/* Spectrogram-like visual for the export preview */
function SpectrogramPreview() {
  return (
    <div className="w-full h-20 rounded-lg overflow-hidden border border-[#333]" style={{ background: "#0a0a1a" }}>
      <div className="w-full h-full flex items-end gap-[1px] px-1 py-1">
        {Array.from({ length: 60 }, (_, i) => (
          <div key={i} className="flex-1 flex flex-col-reverse gap-[0.5px]">
            {Array.from({ length: 8 }, (_, j) => {
              const intensity = Math.random() * 0.6 + (j < 3 ? 0.3 : 0);
              return (
                <div key={j} style={{
                  flex: 1, background: "#63b3ed",
                  opacity: intensity * 0.5,
                  borderRadius: 0.5,
                }} />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExportScreen({ sessionName, takes, activeTakeId, isExporting, onExport, onBack }: ExportScreenProps) {
  const [title, setTitle] = useState(sessionName || "");
  const [artist, setArtist] = useState("");
  const [format, setFormat] = useState("WebM");
  const [artwork, setArtwork] = useState<File | null>(null);
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeTake = takes.find(t => t.id === activeTakeId);
  const formats = ["WebM", "WAV", "MP3"];

  const handleArtwork = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setArtwork(file);
      setArtworkPreview(URL.createObjectURL(file));
    }
  };

  // Combine all waveforms for export preview
  const combinedPeaks = activeTake?.waveform || [];

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-3 border-b border-[#333]" style={{ background: "#1a1a2e" }}>
        <button onClick={onBack} className="p-1">
          <ArrowLeft className="w-5 h-5 text-[#888]" />
        </button>
        <span className="text-[#555]">-</span>
        <h1 className="text-lg font-bold text-white">Export Track</h1>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4" style={{ background: "#111122" }}>
        {/* Session info card */}
        <div className="rounded-xl overflow-hidden border border-[#333]" style={{ background: "#1a1a2e" }}>
          <div className="flex items-center gap-3 p-3">
            <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-[#333]"
              style={{ background: "#151525" }}>
              {artworkPreview ? (
                <img src={artworkPreview} alt="" className="w-full h-full object-cover" />
              ) : activeTake && activeTake.waveform.length > 0 ? (
                <div className="w-full h-full flex items-center px-0.5 gap-[0.5px]">
                  {activeTake.waveform.slice(0, 30).map((p, i) => (
                    <div key={i} className="flex-1" style={{
                      height: `${Math.max(p * 80, 5)}%`, background: "#63b3ed", opacity: 0.6, borderRadius: 1
                    }} />
                  ))}
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music className="w-5 h-5 text-[#333]" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">{sessionName || "Untitled"}</p>
              <p className="text-[11px] text-[#888]">
                {activeTake ? `Created ${timeAgo(activeTake.createdAt)} ago` : "No take selected"}
              </p>
            </div>
            <button className="p-1"><MoreHorizontal className="w-5 h-5 text-[#555]" /></button>
          </div>
        </div>

        {/* Free Trial label */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-[#333]" />
          <span className="text-[10px] font-bold text-[#888] uppercase tracking-widest">Free Trial</span>
          <div className="flex-1 h-px bg-[#333]" />
        </div>

        {/* Song waveform preview */}
        <div className="rounded-xl border border-[#333] overflow-hidden" style={{ background: "#1a1a2e" }}>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-semibold text-[#ccc]">Song Title</span>
            <span className="text-[10px] font-mono text-[#63b3ed]">
              {activeTake ? `${Math.floor(activeTake.duration / 60)}:${String(Math.floor(activeTake.duration % 60)).padStart(2, "0")}` : "0:00"}
            </span>
          </div>
          <div className="h-12 px-1 pb-2">
            <ExportWaveform peaks={combinedPeaks} />
          </div>
        </div>

        {/* Title + metadata */}
        <div className="flex items-center gap-2 rounded-xl border border-[#333] px-3 py-2"
          style={{ background: "#1a1a2e" }}>
          <Mic className="w-4 h-4 text-[#555]" />
          <Music className="w-4 h-4 text-[#555]" />
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="border-0 bg-transparent text-white text-sm h-8 p-0 focus-visible:ring-0 placeholder:text-[#555] flex-1"
          />
          <span className="text-[10px] font-mono text-[#63b3ed]">
            {activeTake ? `${activeTake.duration.toFixed(1)}s` : "00:00.0"}
          </span>
        </div>

        {/* Format selector */}
        <div className="flex gap-2">
          {formats.map(f => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                format === f
                  ? "bg-[#2a3a5a] text-[#63b3ed] border border-[#3a5a8a]"
                  : "text-[#666] border border-[#333]"
              }`}
            >
              {format === f && "✓ "}
              {f}
            </button>
          ))}
        </div>

        {/* Spectrogram preview */}
        <SpectrogramPreview />

        {/* Export button */}
        <button
          onClick={() => onExport(title, artist, format, artwork)}
          disabled={isExporting || !activeTakeId}
          className="w-full py-3.5 rounded-xl text-base font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          style={{
            background: "linear-gradient(135deg, #f59e0b, #d97706, #b45309)",
            boxShadow: "0 4px 15px #f59e0b40",
            border: "1px solid #f59e0b60",
          }}
        >
          <Download className="w-5 h-5" />
          {isExporting ? "Exporting..." : "Export Audio"}
        </button>

        {/* Bottom links */}
        <div className="flex justify-center gap-6 pt-1 pb-2">
          <button className="flex items-center gap-1.5 text-sm text-[#888]">
            <Download className="w-4 h-4" /> Export Up
          </button>
          <button className="text-sm text-[#888]">Reverb</button>
        </div>
      </div>
    </div>
  );
}
