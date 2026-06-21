import { useMemo, useRef, useState } from "react";
import { Search, Upload, Trash2, Image as ImageIcon, Sparkles, X } from "lucide-react";
import { BUILTIN_BACKGROUNDS, PodcastBackgrounds, type PodcastBg, type BgCategory } from "./podcastBackgrounds";
import { toast } from "@/hooks/use-toast";

type Tab = "built-in" | "search" | "uploads";

export default function PodcastBackgroundPicker({
  value, onChange,
}: {
  value: PodcastBg;
  onChange: (bg: PodcastBg) => void;
}) {
  const [tab, setTab] = useState<Tab>("built-in");
  const [category, setCategory] = useState<BgCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [uploads, setUploads] = useState(() => PodcastBackgrounds.listUploads());
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const base = category === "all" ? BUILTIN_BACKGROUNDS : BUILTIN_BACKGROUNDS.filter(b => b.category === category);
    const q = query.trim().toLowerCase();
    if (!q || tab !== "built-in") return base;
    return base.filter(b => b.label.toLowerCase().includes(q) || b.category.includes(q));
  }, [category, query, tab]);

  const runSearch = () => {
    if (!query.trim()) { setSearchResults([]); return; }
    setSearchResults(PodcastBackgrounds.searchUrls(query, 12));
  };

  const onUpload = async (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast({ title: "Image files only" }); return; }
    try {
      const up = await PodcastBackgrounds.saveUpload(f);
      setUploads(PodcastBackgrounds.listUploads());
      onChange({ kind: "image", id: up.id, url: up.dataUrl, label: up.label });
      toast({ title: "Background uploaded" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message });
    }
  };

  const selectedId = value.kind === "image" ? value.id : value.kind;

  return (
    <div>
      {/* Quick effects: none / blur */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={() => onChange({ kind: "none" })}
          className={`p-2 rounded-lg border text-xs flex items-center justify-center gap-2 ${selectedId === "none" ? "border-primary bg-primary/15 text-foreground" : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"}`}
        >
          <X className="w-3.5 h-3.5" /> No background
        </button>
        <button
          onClick={() => onChange({ kind: "blur" })}
          className={`p-2 rounded-lg border text-xs flex items-center justify-center gap-2 ${selectedId === "blur" ? "border-primary bg-primary/15 text-foreground" : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"}`}
        >
          <Sparkles className="w-3.5 h-3.5" /> Blur background
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 border-b border-zinc-800">
        {([
          ["built-in", "Library", ImageIcon],
          ["search", "Search", Search],
          ["uploads", "Uploads", Upload],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3 py-1.5 text-xs flex items-center gap-1.5 -mb-px border-b-2 ${tab === id ? "border-primary text-foreground" : "border-transparent text-zinc-400 hover:text-zinc-200"}`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "built-in" && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(["all", "studio", "office", "city", "room", "nature", "abstract"] as const).map(c => (
              <button key={c}
                onClick={() => setCategory(c)}
                className={`px-2 py-0.5 text-[11px] rounded-full border capitalize ${category === c ? "border-primary bg-primary/15 text-foreground" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"}`}>
                {c}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter library…"
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs mb-2"
          />
          <Grid
            items={filtered.map(b => ({ id: b.id, url: b.url, label: b.label }))}
            value={value}
            onPick={(it) => onChange({ kind: "image", id: it.id, url: it.url, label: it.label })}
          />
        </>
      )}

      {tab === "search" && (
        <>
          <form
            onSubmit={(e) => { e.preventDefault(); runSearch(); }}
            className="flex gap-1.5 mb-3"
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the web (city, beach, studio…)"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1"
            >
              <Search className="w-3.5 h-3.5" /> Search
            </button>
          </form>
          {searchResults.length === 0 ? (
            <p className="text-[11px] text-zinc-500">Type a query and hit search — results come from Unsplash.</p>
          ) : (
            <Grid
              items={searchResults.map((url, i) => ({ id: `srch-${i}-${url}`, url, label: query }))}
              value={value}
              onPick={(it) => onChange({ kind: "image", id: it.id, url: it.url, label: it.label })}
            />
          )}
        </>
      )}

      {tab === "uploads" && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; onUpload(f || null); e.target.value = ""; }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full mb-3 px-3 py-2 text-xs rounded bg-primary/15 border border-primary/40 text-foreground hover:bg-primary/25 flex items-center justify-center gap-2"
          >
            <Upload className="w-3.5 h-3.5" /> Upload your own background
          </button>
          {uploads.length === 0 ? (
            <p className="text-[11px] text-zinc-500">No uploads yet. PNG/JPG up to 6MB.</p>
          ) : (
            <Grid
              items={uploads.map(u => ({ id: u.id, url: u.dataUrl, label: u.label }))}
              value={value}
              onPick={(it) => onChange({ kind: "image", id: it.id, url: it.url, label: it.label })}
              onRemove={(it) => {
                PodcastBackgrounds.deleteUpload(it.id);
                setUploads(PodcastBackgrounds.listUploads());
                if (value.kind === "image" && value.id === it.id) onChange({ kind: "none" });
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function Grid({
  items, value, onPick, onRemove,
}: {
  items: { id: string; url: string; label?: string }[];
  value: PodcastBg;
  onPick: (it: { id: string; url: string; label?: string }) => void;
  onRemove?: (it: { id: string; url: string }) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[40vh] overflow-y-auto pr-1">
      {items.map((it) => {
        const selected = value.kind === "image" && value.id === it.id;
        return (
          <div key={it.id} className="relative group">
            <button
              onClick={() => onPick(it)}
              className={`block w-full rounded-lg overflow-hidden border ${selected ? "border-primary ring-2 ring-primary/50" : "border-zinc-800 hover:border-zinc-700"}`}
            >
              <div className="aspect-video bg-zinc-900">
                <img src={it.url} alt={it.label || ""} loading="lazy" className="w-full h-full object-cover" />
              </div>
              {it.label && <div className="px-2 py-1 bg-zinc-900 text-[10px] text-zinc-300 truncate">{it.label}</div>}
            </button>
            {onRemove && (
              <button
                onClick={() => onRemove(it)}
                title="Delete"
                className="absolute top-1 right-1 p-1 rounded bg-black/70 hover:bg-red-600/80 opacity-0 group-hover:opacity-100 transition"
              >
                <Trash2 className="w-3 h-3 text-white" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
