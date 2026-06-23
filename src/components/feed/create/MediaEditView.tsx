import { useState, useRef, useEffect } from "react";
import {
  Type,
  Sticker,
  Pencil,
  Crop,
  Scissors,
  Volume2,
  VolumeX,
  Check,
  Undo2,
  Trash2,
} from "lucide-react";
import PostOverlayRenderer from "./PostOverlayRenderer";
import StickerDrawer from "./StickerDrawer";
import type { PostEditorMeta, TextOverlay, StickerOverlay, DrawStroke, TextOverlayStyle } from "@/lib/post-editor";
import { DRAW_COLORS } from "@/lib/post-editor";

const newId = () => Math.random().toString(36).slice(2, 9);

type Tool = "text" | "sticker" | "draw" | "crop" | "trim" | null;

interface Props {
  mediaType: "image" | "video";
  previewUrl: string | null;
  meta: PostEditorMeta;
  onMetaChange: (meta: PostEditorMeta) => void;
  caption: string;
  onCaptionChange: (v: string) => void;
  musicPreviewUrl?: string | null;
}

const TEXT_STYLES: TextOverlayStyle[] = ["white", "outline", "yellow", "neon", "rounded"];

export default function MediaEditView({
  mediaType,
  previewUrl,
  meta,
  onMetaChange,
  caption,
  onCaptionChange,
  musicPreviewUrl,
}: Props) {
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [showStickers, setShowStickers] = useState(false);
  const [selected, setSelected] = useState<{ id: string; type: "text" | "sticker" } | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [textStyle, setTextStyle] = useState<TextOverlayStyle>("white");
  const [textColor, setTextColor] = useState("#ffffff");
  const [drawColor, setDrawColor] = useState("#ffffff");
  const [drawWidth, setDrawWidth] = useState(4);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!musicPreviewUrl) return;
    const audio = new Audio(musicPreviewUrl);
    audio.volume = meta.music?.volume ?? 0.6;
    audio.loop = true;
    void audio.play();
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [musicPreviewUrl, meta.music?.volume]);

  const patch = (p: Partial<PostEditorMeta>) => onMetaChange({ ...meta, ...p });

  const updateText = (id: string, p: Partial<TextOverlay>) =>
    patch({ overlays: meta.overlays.map((o) => (o.id === id ? { ...o, ...p } : o)) });

  const updateSticker = (id: string, p: Partial<StickerOverlay>) =>
    patch({ stickers: meta.stickers.map((s) => (s.id === id ? { ...s, ...p } : s)) });

  const deleteSelected = () => {
    if (!selected) return;
    if (selected.type === "text") patch({ overlays: meta.overlays.filter((o) => o.id !== selected.id) });
    else patch({ stickers: meta.stickers.filter((s) => s.id !== selected.id) });
    setSelected(null);
  };

  const addSticker = (stickerId: string) => {
    const sticker: StickerOverlay = {
      id: newId(),
      stickerId,
      x: 50,
      y: 45,
      scale: 1,
      rotation: 0,
    };
    patch({ stickers: [...meta.stickers, sticker] });
    setSelected({ id: sticker.id, type: "sticker" });
  };

  const startTextMode = () => {
    setActiveTool("text");
    setEditingTextId(null);
    setTextDraft("");
    setTimeout(() => textInputRef.current?.focus(), 100);
  };

  const saveText = () => {
    const t = textDraft.trim();
    if (!t) {
      setActiveTool(null);
      return;
    }
    if (editingTextId) {
      updateText(editingTextId, { text: t, style: textStyle, color: textColor });
    } else {
      const overlay: TextOverlay = {
        id: newId(),
        text: t,
        x: 50,
        y: 40,
        scale: 1,
        rotation: 0,
        style: textStyle,
        color: textColor,
      };
      patch({ overlays: [...meta.overlays, overlay] });
      setSelected({ id: overlay.id, type: "text" });
    }
    setTextDraft("");
    setEditingTextId(null);
    setActiveTool(null);
  };

  const editSelectedText = () => {
    if (selected?.type !== "text") return;
    const o = meta.overlays.find((x) => x.id === selected.id);
    if (!o) return;
    setEditingTextId(o.id);
    setTextDraft(o.text);
    setTextStyle(o.style);
    setTextColor(o.color || "#ffffff");
    setActiveTool("text");
    setTimeout(() => textInputRef.current?.focus(), 100);
  };

  const addStroke = (stroke: DrawStroke) => {
    patch({ drawings: [...(meta.drawings || []), stroke] });
  };

  const undoDraw = () => patch({ drawings: (meta.drawings || []).slice(0, -1) });
  const clearDraw = () => patch({ drawings: [] });

  const tools: { id: Tool; icon: typeof Type; label: string; show?: boolean }[] = [
    { id: "text", icon: Type, label: "Text" },
    { id: "sticker", icon: Sticker, label: "Stickers" },
    { id: "draw", icon: Pencil, label: "Draw" },
    { id: "crop", icon: Crop, label: "Crop" },
    { id: "trim", icon: Scissors, label: "Trim", show: mediaType === "video" },
  ];

  return (
    <div className="relative h-full w-full bg-black">
      {previewUrl && (
        mediaType === "video" ? (
          <video src={previewUrl} className="absolute inset-0 w-full h-full object-cover" playsInline loop muted={meta.muteOriginal} autoPlay />
        ) : (
          <img src={previewUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )
      )}

      <PostOverlayRenderer
        meta={meta}
        editable={activeTool !== "draw"}
        selected={selected}
        onSelect={setSelected}
        onUpdateText={updateText}
        onUpdateSticker={updateSticker}
        onDeleteSelected={deleteSelected}
        drawing={activeTool === "draw"}
        drawColor={drawColor}
        drawWidth={drawWidth}
        onAddStroke={addStroke}
      />

      {/* Draw color rail */}
      {activeTool === "draw" && (
        <div className="absolute right-2 top-1/3 z-30 flex flex-col gap-2">
          {DRAW_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setDrawColor(c)}
              className={`w-7 h-7 rounded-full border-2 ${drawColor === c ? "border-white scale-110" : "border-white/30"}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="range"
            min={2}
            max={12}
            value={drawWidth}
            onChange={(e) => setDrawWidth(parseInt(e.target.value, 10))}
            className="w-7 accent-white"
            orient="vertical"
          />
          <button type="button" onClick={undoDraw} className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
            <Undo2 className="w-4 h-4 text-white" />
          </button>
          <button type="button" onClick={clearDraw} className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
            <Trash2 className="w-4 h-4 text-white" />
          </button>
          <button type="button" onClick={() => setActiveTool(null)} className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-4 h-4 text-black" />
          </button>
        </div>
      )}

      {/* Text editor panel */}
      {activeTool === "text" && (
        <div className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-30 px-3">
          <div className="rounded-2xl bg-zinc-900/95 border border-white/10 p-3 space-y-2 backdrop-blur-xl">
            <input
              ref={textInputRef}
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              placeholder="Type your text…"
              className="w-full bg-white/10 rounded-xl px-3 py-2.5 text-white text-base focus:outline-none placeholder:text-white/40"
            />
            <div className="flex flex-wrap gap-1">
              {TEXT_STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTextStyle(s)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${textStyle === s ? "border-primary bg-primary/20 text-white" : "border-white/20 text-white/70"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {DRAW_COLORS.slice(0, 6).map((c) => (
                <button key={c} type="button" onClick={() => setTextColor(c)} className="w-6 h-6 rounded-full border border-white/30" style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setActiveTool(null)} className="flex-1 py-2 rounded-xl bg-white/10 text-white text-sm">Cancel</button>
              <button type="button" onClick={saveText} className="flex-1 py-2 rounded-xl bg-primary text-black font-semibold text-sm flex items-center justify-center gap-1">
                <Check className="w-4 h-4" /> Done
              </button>
            </div>
          </div>
          {textDraft && (
            <p className="text-center mt-3 text-lg font-bold text-white drop-shadow-lg pointer-events-none">{textDraft}</p>
          )}
        </div>
      )}

      {/* Crop panel */}
      {activeTool === "crop" && (
        <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-30 rounded-2xl bg-zinc-900/95 border border-white/10 p-3 space-y-2">
          <label className="text-[10px] text-white/50">Zoom</label>
          <input type="range" min={1} max={2} step={0.05} value={meta.crop?.scale ?? 1} onChange={(e) => patch({ crop: { scale: parseFloat(e.target.value), x: meta.crop?.x ?? 50, y: meta.crop?.y ?? 50 } })} className="w-full" />
          <button type="button" onClick={() => setActiveTool(null)} className="w-full py-2 rounded-xl bg-primary text-black font-semibold text-sm">Done</button>
        </div>
      )}

      {/* Trim panel */}
      {activeTool === "trim" && mediaType === "video" && (
        <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-30 rounded-2xl bg-zinc-900/95 border border-white/10 p-3 space-y-2">
          <p className="text-xs text-white/60">Trim start / end (seconds)</p>
          <div className="flex gap-2 items-center text-xs text-white">
            <input type="number" min={0} step={0.1} value={meta.trim?.start ?? 0} onChange={(e) => patch({ trim: { start: parseFloat(e.target.value) || 0, end: meta.trim?.end ?? 30 } })} className="w-20 bg-white/10 rounded px-2 py-1" />
            <span>to</span>
            <input type="number" min={0} step={0.1} value={meta.trim?.end ?? 30} onChange={(e) => patch({ trim: { start: meta.trim?.start ?? 0, end: parseFloat(e.target.value) || 30 } })} className="w-20 bg-white/10 rounded px-2 py-1" />
          </div>
          <button type="button" onClick={() => setActiveTool(null)} className="w-full py-2 rounded-xl bg-primary text-black font-semibold text-sm">Done</button>
        </div>
      )}

      {/* Bottom tool row */}
      <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+0.25rem)] inset-x-0 z-30 px-2">
        <div className="flex justify-around mb-2">
          {tools.filter((t) => t.show !== false).map((t) => {
            const Icon = t.icon;
            const active = activeTool === t.id;
            return (
              <button
                key={t.id!}
                type="button"
                onClick={() => {
                  if (t.id === "sticker") setShowStickers(true);
                  else if (t.id === "text") startTextMode();
                  else setActiveTool(active === t.id ? null : t.id);
                }}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl ${active ? "bg-white/20" : ""}`}
              >
                <Icon className="w-5 h-5 text-white" />
                <span className="text-[9px] text-white/80 font-medium">{t.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => patch({ muteOriginal: !meta.muteOriginal })}
            className="flex flex-col items-center gap-0.5 px-2 py-1"
          >
            {meta.muteOriginal ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
            <span className="text-[9px] text-white/80 font-medium">Mute</span>
          </button>
        </div>
        <input
          value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          placeholder="Write a caption…"
          className="w-full bg-white/10 backdrop-blur-md border border-white/15 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none"
        />
      </div>

      {selected?.type === "text" && activeTool !== "text" && (
        <button
          type="button"
          onClick={editSelectedText}
          className="absolute top-20 right-3 z-30 px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-semibold"
        >
          Edit text
        </button>
      )}

      <StickerDrawer open={showStickers} onClose={() => setShowStickers(false)} onPick={addSticker} />
    </div>
  );
}
