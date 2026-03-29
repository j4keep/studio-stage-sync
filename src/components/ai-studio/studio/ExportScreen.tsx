import { useState, useRef } from "react";
import { ArrowLeft, Music, Download, Image, MoreHorizontal } from "lucide-react";
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

      <div className="flex-1 px-4 py-4 space-y-5" style={{ background: "#111122" }}>
        {/* Session card */}
        <div className="rounded-xl overflow-hidden border border-[#333]" style={{ background: "#1a1a2e" }}>
          <div className="flex items-center gap-3 p-3">
            <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-[#333]"
              style={{ background: "#151525" }}>
              {activeTake ? (
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
        <div className="text-center">
          <span className="text-[11px] font-bold text-[#888] uppercase tracking-widest">Free Trial</span>
        </div>

        {/* Song title with waveform */}
        <div className="rounded-xl border border-[#333] overflow-hidden" style={{ background: "#1a1a2e" }}>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-semibold text-[#888]">Song Title</span>
            <span className="text-[10px] font-mono text-[#555]">
              {activeTake ? `${Math.floor(activeTake.duration / 60)}:${String(Math.floor(activeTake.duration % 60)).padStart(2, "0")}` : "0:00"}
            </span>
          </div>
          {activeTake && activeTake.waveform.length > 0 && (
            <div className="h-10 px-2 pb-2">
              <div className="flex items-center h-full gap-[0.5px]">
                {activeTake.waveform.slice(0, 80).map((p, i) => (
                  <div key={i} className="flex-1" style={{
                    height: `${Math.max(p * 80, 3)}%`, background: "#63b3ed", opacity: 0.5, borderRadius: 1
                  }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Title input */}
        <div className="flex items-center gap-2 rounded-xl border border-[#333] px-3 py-2"
          style={{ background: "#1a1a2e" }}>
          <Music className="w-4 h-4 text-[#555]" />
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="border-0 bg-transparent text-white text-sm h-8 p-0 focus-visible:ring-0 placeholder:text-[#555]"
          />
          <span className="text-[10px] font-mono text-[#555]">
            {activeTake ? `${activeTake.duration.toFixed(1)}` : "00.00"}
          </span>
        </div>

        {/* Cover artwork */}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleArtwork} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center gap-3 rounded-xl border border-dashed border-[#444] px-3 py-3"
          style={{ background: "#1a1a2e" }}
        >
          {artworkPreview ? (
            <img src={artworkPreview} className="w-10 h-10 rounded-lg object-cover" alt="" />
          ) : (
            <Image className="w-5 h-5 text-[#555]" />
          )}
          <span className="text-sm text-[#888]">{artwork ? artwork.name : "Add cover artwork"}</span>
        </button>

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
              {f === "WebM" && "✓ "}
              {f}
            </button>
          ))}
        </div>

        {/* Export button */}
        <button
          onClick={() => onExport(title, artist, format, artwork)}
          disabled={isExporting || !activeTakeId}
          className="w-full py-3.5 rounded-xl text-base font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          style={{
            background: "linear-gradient(135deg, #f59e0b, #d97706, #b45309)",
            boxShadow: "0 4px 15px #f59e0b40",
          }}
        >
          <Download className="w-5 h-5" />
          {isExporting ? "Exporting..." : "Export Audio"}
        </button>

        {/* Bottom links */}
        <div className="flex justify-center gap-6 pt-2">
          <button className="flex items-center gap-1.5 text-sm text-[#888]">
            <Download className="w-4 h-4" /> Export Up
          </button>
          <button className="text-sm text-[#888]">Record</button>
        </div>
      </div>
    </div>
  );
}
