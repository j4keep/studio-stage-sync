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
  
} from "@/lib/post-editor";
import { EMOJI_CHARACTERS } from "@/lib/emoji-characters";

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
  immersive?: boolean;
  activeTool?: string | null;
  onActiveToolChange?: (tool: string | null) => void;
  musicPreviewUrl?: string | null;
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
  immersive = false,
  activeTool: activeToolProp,
  onActiveToolChange,
  musicPreviewUrl,
}: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const musicStopRef = useRef<(() => void) | null>(null);
  const uploadedAudioRef = useRef<HTMLAudioElement | null>(null);
  const [activeToolLocal, setActiveToolLocal] = useState<string | null>(null);
  const activeTool = activeToolProp !== undefined ? activeToolProp : activeToolLocal;
  const setActiveTool = onActiveToolChange ?? setActiveToolLocal;
  const [selectedOverlay, setSelectedOverlay] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const dragRef = useRef<{ id: string; kind: "text" | "sticker"; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const previewAreaRef = useRef<HTMLDivElement>(null);

  const duration = videoRef.current?.duration || 0;
  const trimStart = meta.trim?.start ?? 0;
  const trimEnd = meta.trim?.end ?? (duration || 30);

  useEffect(() => {
    return () => {
      musicStopRef.current?.();
      uploadedAudioRef.current?.pause();
    };
  }, []);

  // Preview uploaded music with photo/video
  useEffect(() => {
    musicStopRef.current?.();
    musicStopRef.current = null;
    uploadedAudioRef.current?.pause();
    uploadedAudioRef.current = null;

    if (!musicPreviewUrl) return;

    const audio = new Audio(musicPreviewUrl);
    audio.volume = meta.music?.volume ?? 0.6;
    audio.loop = true;
    void audio.play();
    uploadedAudioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [musicPreviewUrl, meta.music?.volume]);

  const updateMeta = (patch: Partial<PostEditorMeta>) => onMetaChange({ ...meta, ...patch });

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
      rotation: 0,
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
      stickerId: emojiId,
      emojiId,
      x: 50,
      y: 50,
      scale: 1,
      rotation: 0,
    };
    updateMeta({ stickers: [...meta.stickers, sticker] });
    setActiveTool(null);
  };

  const tools = [
    { id: "text", icon: Type, label: "Text" },
    { id: "sticker", icon: Sticker, label: "Stickers" },
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
    <div className={immersive ? "h-full flex flex-col relative" : "space-y-3"}>
      <div
        ref={previewAreaRef}
        className={
          immersive
            ? "relative flex-1 w-full overflow-hidden bg-black"
            : "relative aspect-[9/16] max-h-[50vh] w-full mx-auto rounded-xl overflow-hidden bg-black"
        }
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
            className={`absolute cursor-grab active:cursor-grabbing select-none px-2 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${selectedOverlay === o.id ? "ring-2 ring-primary rounded" : ""}`}
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

      {/* Tool strip — hidden in immersive mode (tools on right rail) */}
      {!immersive && (
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
      )}

      {/* Tool panels — bottom sheet in immersive, inline otherwise */}
      {activeTool && (
      <div className={immersive ? "absolute bottom-0 left-0 right-16 z-30 max-h-[40%] overflow-y-auto rounded-t-2xl bg-black/90 backdrop-blur-xl border-t border-white/10 p-3 scrollbar-hide" : ""}>
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
        <div className={`rounded-xl p-3 max-h-36 overflow-y-auto scrollbar-hide ${immersive ? "bg-transparent" : "border border-border bg-card"}`}>
          <div className="grid grid-cols-6 gap-2">
            {EMOJI_CHARACTERS.map((e) => (
              <button key={e.id} type="button" onClick={() => addSticker(e.id)} className="p-1 rounded-lg hover:bg-white/10">
                <img src={e.src} alt={e.label} className="w-8 h-8 object-contain mx-auto" />
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTool === "trim" && mediaType === "video" && (
        <div className={`rounded-xl p-3 space-y-2 ${immersive ? "" : "border border-border bg-card"}`}>
          <p className={`text-xs ${immersive ? "text-white/60" : "text-muted-foreground"}`}>Trim start / end (seconds)</p>
          <div className="flex gap-2 items-center text-xs">
            <input
              type="number"
              min={0}
              step={0.1}
              value={trimStart}
              onChange={(e) => updateMeta({ trim: { start: parseFloat(e.target.value) || 0, end: trimEnd } })}
              className="w-20 bg-white/10 rounded px-2 py-1 border border-white/15 text-white"
            />
            <span className={immersive ? "text-white" : ""}>to</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={trimEnd}
              onChange={(e) => updateMeta({ trim: { start: trimStart, end: parseFloat(e.target.value) || trimEnd } })}
              className="w-20 bg-white/10 rounded px-2 py-1 border border-white/15 text-white"
            />
          </div>
        </div>
      )}

      {activeTool === "crop" && (
        <div className={`rounded-xl p-3 space-y-2 ${immersive ? "" : "border border-border bg-card"}`}>
          <label className={`text-[10px] ${immersive ? "text-white/60" : "text-muted-foreground"}`}>Zoom</label>
          <input type="range" min={1} max={2} step={0.05} value={cropScale} onChange={(e) => updateMeta({ crop: { scale: parseFloat(e.target.value), x: cropX, y: cropY } })} className="w-full" />
          <label className={`text-[10px] ${immersive ? "text-white/60" : "text-muted-foreground"}`}>Position X</label>
          <input type="range" min={0} max={100} value={cropX} onChange={(e) => updateMeta({ crop: { scale: cropScale, x: parseInt(e.target.value, 10), y: cropY } })} className="w-full" />
          <label className={`text-[10px] ${immersive ? "text-white/60" : "text-muted-foreground"}`}>Position Y</label>
          <input type="range" min={0} max={100} value={cropY} onChange={(e) => updateMeta({ crop: { scale: cropScale, x: cropX, y: parseInt(e.target.value, 10) } })} className="w-full" />
        </div>
      )}

      {activeTool === "cover" && mediaType === "video" && (
        <div className={`rounded-xl p-3 space-y-2 ${immersive ? "" : "border border-border bg-card"}`}>
          <p className={`text-xs ${immersive ? "text-white/60" : "text-muted-foreground"}`}>Cover frame (seconds)</p>
          <input type="range" min={0} max={duration || 30} step={0.1} value={meta.coverTime ?? 0} onChange={(e) => updateMeta({ coverTime: parseFloat(e.target.value) })} className="w-full" />
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
          className={`w-full text-sm rounded-xl px-3 py-2 ${immersive ? "bg-white/10 border border-white/15 text-white placeholder:text-white/40" : "bg-card border border-border"}`}
        />
      )}

      {activeTool === "hashtags" && (
        <input
          value={hashtags}
          onChange={(e) => onHashtagsChange(e.target.value)}
          placeholder="#music #wheuat"
          className={`w-full text-sm rounded-xl px-3 py-2 ${immersive ? "bg-white/10 border border-white/15 text-white placeholder:text-white/40" : "bg-card border border-border"}`}
        />
      )}
      </div>
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
