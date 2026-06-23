import { useState, useRef, useEffect } from "react";
import {
  Type,
  Sticker,
  Music,
  Scissors,
  Crop,
  Volume2,
  VolumeX,
  Image as ImageIcon,
  MapPin,
  Hash,
  Play,
  Pause,
  Plus,
  Trash2,
} from "lucide-react";
import {
  type PostEditorMeta,
  type TextOverlay,
  type StickerOverlay,
  type TextOverlayStyle,
  defaultEditorMeta,
  TEXT_STYLE_CLASSES,
} from "@/lib/post-editor";
import { EMOJI_CHARACTERS } from "@/lib/emoji-characters";
import { FEED_MUSIC_PRESETS, playFeedMusicLoop } from "@/lib/feed-music";

interface Props {
  file: File | null;
  mediaType: "image" | "video";
  previewUrl: string | null;
  meta: PostEditorMeta;
  onMetaChange: (meta: PostEditorMeta) => void;
  hashtags: string;
  onHashtagsChange: (v: string) => void;
  location: string;
  onLocationChange: (v: string) => void;
}

const newId = () => Math.random().toString(36).slice(2, 9);

const PostMediaEditor = ({
  file,
  mediaType,
  previewUrl,
  meta,
  onMetaChange,
  hashtags,
  onHashtagsChange,
  location,
  onLocationChange,
}: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const musicStopRef = useRef<(() => void) | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [selectedOverlay, setSelectedOverlay] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [musicPreviewing, setMusicPreviewing] = useState(false);
  const dragRef = useRef<{ id: string; kind: "text" | "sticker"; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const previewAreaRef = useRef<HTMLDivElement>(null);

  const duration = videoRef.current?.duration || 0;
  const trimStart = meta.trim?.start ?? 0;
  const trimEnd = meta.trim?.end ?? (duration || 30);

  useEffect(() => {
    return () => {
      musicStopRef.current?.();
    };
  }, []);

  const updateMeta = (patch: Partial<PostEditorMeta>) => onMetaChange({ ...meta, ...patch });

  const stopMusicPreview = () => {
    musicStopRef.current?.();
    musicStopRef.current = null;
    setMusicPreviewing(false);
  };

  const previewMusic = (loopId: string) => {
    stopMusicPreview();
    const player = playFeedMusicLoop(loopId, meta.music?.volume ?? 0.6);
    if (!player) return;
    musicStopRef.current = player.stop;
    setMusicPreviewing(true);
    updateMeta({ music: { loopId, volume: meta.music?.volume ?? 0.6 } });
  };

  const handlePointerDown = (e: React.PointerEvent, id: string, kind: "text" | "sticker", x: number, y: number) => {
    e.stopPropagation();
    setSelectedOverlay(id);
    dragRef.current = { id, kind, startX: e.clientX, startY: e.clientY, origX: x, origY: y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !previewAreaRef.current) return;
    const rect = previewAreaRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragRef.current.startX) / rect.width) * 100;
    const dy = ((e.clientY - dragRef.current.startY) / rect.height) * 100;
    const nx = Math.max(5, Math.min(95, dragRef.current.origX + dx));
    const ny = Math.max(5, Math.min(95, dragRef.current.origY + dy));
    const { id, kind } = dragRef.current;
    if (kind === "text") {
      updateMeta({
        overlays: meta.overlays.map((o) => (o.id === id ? { ...o, x: nx, y: ny } : o)),
      });
    } else {
      updateMeta({
        stickers: meta.stickers.map((s) => (s.id === id ? { ...s, x: nx, y: ny } : s)),
      });
    }
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const addTextOverlay = () => {
    const overlay: TextOverlay = {
      id: newId(),
      text: "Your text",
      x: 50,
      y: 40,
      scale: 1,
      style: "white",
    };
    updateMeta({ overlays: [...meta.overlays, overlay] });
    setSelectedOverlay(overlay.id);
    setActiveTool("text");
  };

  const addSticker = (emojiId: string) => {
    const src = EMOJI_CHARACTERS.find((e) => e.id === emojiId);
    if (!src) return;
    const sticker: StickerOverlay = {
      id: newId(),
      emojiId,
      x: 50,
      y: 50,
      scale: 1,
    };
    updateMeta({ stickers: [...meta.stickers, sticker] });
    setActiveTool(null);
  };

  const tools = [
    { id: "text", icon: Type, label: "Text" },
    { id: "sticker", icon: Sticker, label: "Stickers" },
    { id: "music", icon: Music, label: "Music" },
    { id: "trim", icon: Scissors, label: "Trim" },
    { id: "crop", icon: Crop, label: "Crop" },
    { id: "cover", icon: ImageIcon, label: "Cover" },
    { id: "location", icon: MapPin, label: "Location" },
    { id: "hashtags", icon: Hash, label: "Tags" },
  ];

  const cropScale = meta.crop?.scale ?? 1;
  const cropX = meta.crop?.x ?? 50;
  const cropY = meta.crop?.y ?? 50;

  const mediaStyle: React.CSSProperties = {
    transform: `scale(${cropScale})`,
    objectPosition: `${cropX}% ${cropY}%`,
  };

  return (
    <div className="space-y-3">
      {/* Preview */}
      <div
        ref={previewAreaRef}
        className="relative aspect-[9/16] max-h-[50vh] w-full mx-auto rounded-xl overflow-hidden bg-black"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {mediaType === "video" && previewUrl && (
          <video
            ref={videoRef}
            src={previewUrl}
            className="absolute inset-0 h-full w-full object-cover"
            style={mediaStyle}
            playsInline
            muted={meta.muteOriginal}
            loop
            onLoadedMetadata={() => {
              if (!meta.trim && videoRef.current?.duration) {
                updateMeta({ trim: { start: 0, end: videoRef.current.duration } });
              }
            }}
          />
        )}
        {mediaType === "image" && previewUrl && (
          <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" style={mediaStyle} />
        )}

        {meta.overlays.map((o) => (
          <div
            key={o.id}
            className={`absolute cursor-grab active:cursor-grabbing select-none px-2 ${TEXT_STYLE_CLASSES[o.style]} ${selectedOverlay === o.id ? "ring-2 ring-primary rounded" : ""}`}
            style={{
              left: `${o.x}%`,
              top: `${o.y}%`,
              transform: `translate(-50%, -50%) scale(${o.scale})`,
              fontSize: `${Math.round(16 * o.scale)}px`,
            }}
            onPointerDown={(e) => handlePointerDown(e, o.id, "text", o.x, o.y)}
          >
            {o.text}
          </div>
        ))}

        {meta.stickers.map((s) => {
          const emoji = EMOJI_CHARACTERS.find((e) => e.id === s.emojiId);
          if (!emoji) return null;
          return (
            <img
              key={s.id}
              src={emoji.src}
              alt=""
              className={`absolute cursor-grab active:cursor-grabbing ${selectedOverlay === s.id ? "ring-2 ring-primary rounded" : ""}`}
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: `${48 * s.scale}px`,
                height: `${48 * s.scale}px`,
                transform: "translate(-50%, -50%)",
              }}
              onPointerDown={(e) => handlePointerDown(e, s.id, "sticker", s.x, s.y)}
            />
          );
        })}

        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
          {mediaType === "video" && (
            <button
              type="button"
              onClick={() => {
                const v = videoRef.current;
                if (!v) return;
                if (v.paused) {
                  v.play();
                  setIsPlayingPreview(true);
                } else {
                  v.pause();
                  setIsPlayingPreview(false);
                }
              }}
              className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center"
            >
              {isPlayingPreview ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => updateMeta({ muteOriginal: !meta.muteOriginal })}
            className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center ml-auto"
          >
            {meta.muteOriginal ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>

      {/* Tool strip */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTool(activeTool === t.id ? null : t.id)}
              className={`shrink-0 flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl text-[10px] font-medium transition-colors ${
                activeTool === t.id ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tool panels */}
      {activeTool === "text" && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <button type="button" onClick={addTextOverlay} className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Plus className="w-3.5 h-3.5" /> Add text
          </button>
          {meta.overlays.map((o) => (
            <div key={o.id} className="flex flex-wrap gap-2 items-center">
              <input
                value={o.text}
                onChange={(e) =>
                  updateMeta({ overlays: meta.overlays.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })
                }
                className="flex-1 min-w-[8rem] text-xs bg-secondary rounded-lg px-2 py-1.5 border border-border"
              />
              <div className="flex gap-1">
                {(["white", "outline", "yellow", "neon"] as TextOverlayStyle[]).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => updateMeta({ overlays: meta.overlays.map((x) => (x.id === o.id ? { ...x, style } : x)) })}
                    className={`text-[9px] px-2 py-0.5 rounded-full border ${o.style === style ? "border-primary bg-primary/20" : "border-border"}`}
                  >
                    {style}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={0.6}
                max={2}
                step={0.1}
                value={o.scale}
                onChange={(e) =>
                  updateMeta({ overlays: meta.overlays.map((x) => (x.id === o.id ? { ...x, scale: parseFloat(e.target.value) } : x)) })
                }
                className="w-16"
              />
              <button type="button" onClick={() => updateMeta({ overlays: meta.overlays.filter((x) => x.id !== o.id) })}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTool === "sticker" && (
        <div className="rounded-xl border border-border bg-card p-3 max-h-36 overflow-y-auto scrollbar-hide">
          <div className="grid grid-cols-6 gap-2">
            {EMOJI_CHARACTERS.map((e) => (
              <button key={e.id} type="button" onClick={() => addSticker(e.id)} className="p-1 rounded-lg hover:bg-secondary">
                <img src={e.src} alt={e.label} className="w-8 h-8 object-contain mx-auto" />
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTool === "music" && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">Sound library</p>
          <div className="flex flex-wrap gap-1.5">
            {FEED_MUSIC_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => previewMusic(p.id)}
                className={`text-[10px] px-2.5 py-1 rounded-full border ${meta.music?.loopId === p.id ? "border-primary bg-primary/15" : "border-border"}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) updateMeta({ music: { fileName: f.name, volume: meta.music?.volume ?? 0.6 } });
              }}
            />
            <span className="px-2.5 py-1 rounded-full border border-border hover:bg-secondary">Upload audio</span>
          </label>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Music volume</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={meta.music?.volume ?? 0.6}
              onChange={(e) => updateMeta({ music: { ...meta.music, volume: parseFloat(e.target.value) } })}
              className="w-full"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Original audio</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={meta.originalVolume ?? 1}
              onChange={(e) => updateMeta({ originalVolume: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>
          {musicPreviewing && (
            <button type="button" onClick={stopMusicPreview} className="text-[10px] text-primary">
              Stop preview
            </button>
          )}
        </div>
      )}

      {activeTool === "trim" && mediaType === "video" && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <p className="text-xs text-muted-foreground">Trim start / end (seconds)</p>
          <div className="flex gap-2 items-center text-xs">
            <input
              type="number"
              min={0}
              step={0.1}
              value={trimStart}
              onChange={(e) => updateMeta({ trim: { start: parseFloat(e.target.value) || 0, end: trimEnd } })}
              className="w-20 bg-secondary rounded px-2 py-1 border border-border"
            />
            <span>to</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={trimEnd}
              onChange={(e) => updateMeta({ trim: { start: trimStart, end: parseFloat(e.target.value) || trimEnd } })}
              className="w-20 bg-secondary rounded px-2 py-1 border border-border"
            />
          </div>
        </div>
      )}

      {activeTool === "crop" && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <label className="text-[10px] text-muted-foreground">Zoom</label>
          <input
            type="range"
            min={1}
            max={2}
            step={0.05}
            value={cropScale}
            onChange={(e) => updateMeta({ crop: { scale: parseFloat(e.target.value), x: cropX, y: cropY } })}
            className="w-full"
          />
          <label className="text-[10px] text-muted-foreground">Position X</label>
          <input
            type="range"
            min={0}
            max={100}
            value={cropX}
            onChange={(e) => updateMeta({ crop: { scale: cropScale, x: parseInt(e.target.value, 10), y: cropY } })}
            className="w-full"
          />
          <label className="text-[10px] text-muted-foreground">Position Y</label>
          <input
            type="range"
            min={0}
            max={100}
            value={cropY}
            onChange={(e) => updateMeta({ crop: { scale: cropScale, x: cropX, y: parseInt(e.target.value, 10) } })}
            className="w-full"
          />
        </div>
      )}

      {activeTool === "cover" && mediaType === "video" && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <p className="text-xs text-muted-foreground">Cover frame (seconds)</p>
          <input
            type="range"
            min={0}
            max={duration || 30}
            step={0.1}
            value={meta.coverTime ?? 0}
            onChange={(e) => updateMeta({ coverTime: parseFloat(e.target.value) })}
            className="w-full"
          />
        </div>
      )}

      {activeTool === "location" && (
        <input
          value={location}
          onChange={(e) => {
            onLocationChange(e.target.value);
            updateMeta({ location: e.target.value || undefined });
          }}
          placeholder="Add location (optional)"
          className="w-full text-sm bg-card border border-border rounded-xl px-3 py-2"
        />
      )}

      {activeTool === "hashtags" && (
        <input
          value={hashtags}
          onChange={(e) => onHashtagsChange(e.target.value)}
          placeholder="#music #wheuat"
          className="w-full text-sm bg-card border border-border rounded-xl px-3 py-2"
        />
      )}
    </div>
  );
};

/** Bake image overlays into a single blob for upload. */
export async function exportEditedImage(
  imageUrl: string,
  meta: PostEditorMeta,
): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = imageUrl;
  });

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const scale = meta.crop?.scale ?? 1;
  const cx = (meta.crop?.x ?? 50) / 100;
  const cy = (meta.crop?.y ?? 50) / 100;
  const sw = w / scale;
  const sh = h / scale;
  const sx = (w - sw) * cx;
  const sy = (h - sh) * cy;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);

  for (const o of meta.overlays) {
    const fontSize = Math.round(32 * o.scale);
    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const x = (o.x / 100) * w;
    const y = (o.y / 100) * h;
    if (o.style === "outline") {
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 4;
      ctx.strokeText(o.text, x, y);
      ctx.fillStyle = "#fff";
    } else if (o.style === "yellow") {
      ctx.fillStyle = "#fde047";
    } else if (o.style === "neon") {
      ctx.fillStyle = "#00a8ff";
      ctx.shadowColor = "#00a8ff";
      ctx.shadowBlur = 12;
    } else {
      ctx.fillStyle = "#fff";
    }
    ctx.fillText(o.text, x, y);
    ctx.shadowBlur = 0;
  }

  for (const s of meta.stickers) {
    const emoji = EMOJI_CHARACTERS.find((e) => e.id === s.emojiId);
    if (!emoji) continue;
    const stickerImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = emoji.src;
    });
    const size = 64 * s.scale;
    const x = (s.x / 100) * w - size / 2;
    const y = (s.y / 100) * h - size / 2;
    ctx.drawImage(stickerImg, x, y, size, size);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/jpeg", 0.92);
  });
}

export { defaultEditorMeta };
export default PostMediaEditor;
