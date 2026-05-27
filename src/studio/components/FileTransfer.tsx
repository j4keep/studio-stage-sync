import { useRef, useState } from "react";
import { useStudio } from "../state/StudioContext";
import { Upload, FileAudio, FileVideo, FileText, FileQuestion, Download, Trash2 } from "lucide-react";

function iconFor(type: string) {
  if (type.startsWith("audio/")) return FileAudio;
  if (type.startsWith("video/")) return FileVideo;
  if (type.includes("pdf") || type.startsWith("text/")) return FileText;
  return FileQuestion;
}

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function FileTransfer({ uploader }: { uploader: string }) {
  const { files, addFile, removeFile } = useStudio();
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    Array.from(list).forEach((f) =>
      addFile({ name: f.name, size: f.size, type: f.type || "application/octet-stream", uploadedBy: uploader }),
    );
  };

  return (
    <div className="studio-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--studio-text-muted))] mb-2">File Transfer</div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`studio-card-inset p-5 text-center cursor-pointer border-dashed transition-all ${
          drag ? "border-[hsl(var(--studio-blue))] bg-[hsl(var(--studio-blue)/0.05)]" : ""
        }`}
      >
        <Upload className="w-6 h-6 mx-auto text-[hsl(var(--studio-text-muted))] mb-1" />
        <div className="text-sm">Drag & drop files here</div>
        <div className="text-xs text-[hsl(var(--studio-text-muted))]">or click to browse</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          accept=".wav,.mp3,.m4a,.aiff,.flac,.mp4,.mov,.pdf,.txt,.zip,audio/*,video/*"
        />
      </div>

      <div className="mt-3 space-y-2 max-h-[200px] overflow-y-auto scrollbar-hide">
        {files.length === 0 && (
          <div className="text-xs text-[hsl(var(--studio-text-muted))] text-center py-3">No files shared.</div>
        )}
        {files.map((f) => {
          const Icon = iconFor(f.type);
          return (
            <div key={f.id} className="flex items-center gap-2 p-2 studio-card-inset">
              <Icon className="w-4 h-4 text-[hsl(var(--studio-blue))] shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{f.name}</div>
                <div className="text-[10px] text-[hsl(var(--studio-text-muted))]">
                  {fmtSize(f.size)} · by {f.uploadedBy}
                </div>
                <div className="studio-meter-track mt-1"><div className="studio-meter-fill" style={{ width: "100%" }} /></div>
              </div>
              <button className="p-1 hover:text-[hsl(var(--studio-blue))]" title="Download (demo)">
                <Download className="w-4 h-4" />
              </button>
              <button className="p-1 hover:text-[hsl(var(--studio-red))]" onClick={() => removeFile(f.id)} title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
