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
  Eraser,
} from "lucide-react";
import PostOverlayRenderer from "./PostOverlayRenderer";
import StickerDrawer from "./StickerDrawer";
import type { PostEditorMeta, TextOverlay, StickerOverlay, DrawStroke, TextOverlayStyle } from "@/lib/post-editor";
import { DRAW_COLORS, BRUSH_PRESETS, eraseStrokesNear } from "@/lib/post-editor";
import { TEXT_COLORS, CREATE_TEXT_STYLES } from "@/lib/text-styles";

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
  const [textStyle, setTextStyle] = useState<TextOverlayStyle>("bubble");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textPos, setTextPos] = useState({ x: 50, y: 38, scale: 1 });
  const [drawColor, setDrawColor] = useState("#ffffff");
  const [drawWidth, setDrawWidth] = useState(6);
  const [drawHighlighter, setDrawHighlighter] = useState(false);
  const [eraserMode, setEraserMode] = useState(false);
  const [brushPreset, setBrushPreset] = useState("medium");
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const textInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
    };
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);

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

  useEffect(() => {
    if (activeTool === "text") {
      setTimeout(() => textInputRef.current?.focus(), 80);
    }
  }, [activeTool, editingTextId]);

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
      scale: 1.1,
      rotation: 0,
    };
    patch({ stickers: [...meta.stickers, sticker] });
    setSelected({ id: sticker.id, type: "sticker" });
  };

  const startTextMode = () => {
    setActiveTool("text");
    setEditingTextId(null);
    setTextDraft("");
    setTextPos({ x: 50, y: 38, scale: 1 });
    setTextStyle("bubble");
    setTextColor("#ffffff");
  };

  const saveText = () => {
    const t = textDraft.trim();
    if (!t) {
      setActiveTool(null);
      return;
    }
    if (editingTextId) {
      updateText(editingTextId, { text: t, style: textStyle, color: textColor, ...textPos });
      setSelected({ id: editingTextId, type: "text" });
    } else {
      const overlay: TextOverlay = {
        id: newId(),
        text: t,
        x: textPos.x,
        y: textPos.y,
        scale: textPos.scale,
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

  const editSelectedText = (id?: string) => {
    const targetId = id ?? selected?.id;
    if (!targetId) return;
    const o = meta.overlays.find((x) => x.id === targetId);
    if (!o) return;
    setEditingTextId(o.id);
    setTextDraft(o.text);
    setTextStyle(o.style);
    setTextColor(o.color || "#ffffff");
    setTextPos({ x: o.x, y: o.y, scale: o.scale });
    setActiveTool("text");
    setSelected({ id: o.id, type: "text" });
  };

  const addStroke = (stroke: DrawStroke) => {
    patch({ drawings: [...(meta.drawings || []), stroke] });
  };

  const eraseAt = (x: number, y: number) => {
    patch({ drawings: eraseStrokesNear(meta.drawings || [], x, y, 8) });
  };

  const undoDraw = () => patch({ drawings: (meta.drawings || []).slice(0, -1) });
  const clearDraw = () => patch({ drawings: [] });

  const applyBrushPreset = (id: string) => {
    const preset = BRUSH_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setBrushPreset(id);
    setDrawWidth(preset.width);
    setDrawHighlighter(!!(preset as { highlighter?: boolean }).highlighter);
    setEraserMode(false);
  };

  const tools: { id: Tool; icon: typeof Type; label: string; show?: boolean }[] = [
    { id: "text", icon: Type, label: "Text" },
    { id: "sticker", icon: Sticker, label: "Stickers" },
    { id: "draw", icon: Pencil, label: "Draw" },
    { id: "crop", icon: Crop, label: "Crop" },
    { id: "trim", icon: Scissors, label: "Trim", show: mediaType === "video" },
  ];

  const liveTextDraft =
    activeTool === "text"
      ? { text: textDraft, style: textStyle, color: textColor, ...textPos }
      : null;

  return (
    <div className="relative h-full w-full bg-black">
      {previewUrl &&
        (mediaType === "video" ? (
          <video src={previewUrl} className="absolute inset-0 w-full h-full object-cover" playsInline loop muted={meta.muteOriginal} autoPlay />
        ) : (
          <img src={previewUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ))}

      <PostOverlayRenderer
        meta={meta}
        editable={activeTool !== "draw"}
        selected={selected}
        onSelect={setSelected}
        onUpdateText={updateText}
        onUpdateSticker={updateSticker}
        onDeleteSelected={deleteSelected}
        drawing={activeTool === "draw"}
        eraserMode={eraserMode}
        drawColor={drawColor}
        drawWidth={drawWidth}
        drawHighlighter={drawHighlighter}
        onAddStroke={addStroke}
        onEraseAt={eraseAt}
        liveTextDraft={liveTextDraft}
        onLiveTextMove={(p) => setTextPos((prev) => ({ ...prev, ...p }))}
        onTextTap={(id) => editSelectedText(id)}
      />

      {/* Draw mode — colors on right, controls top */}
      {activeTool === "draw" && (
        <>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 py-2 px-1 rounded-2xl bg-black/60 backdrop-blur-md border border-white/15">
            {DRAW_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setDrawColor(c); setEraserMode(false); }}
                className={`shrink-0 w-9 h-9 rounded-full border-2 ${drawColor === c && !eraserMode ? "border-violet-400 scale-110" : "border-white/30"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+3.5rem)] z-40 px-3 space-y-2">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {BRUSH_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyBrushPreset(p.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold ${
                    brushPreset === p.id ? "bg-violet-500 text-white" : "bg-black/60 text-white/80 border border-white/20"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-black/70 backdrop-blur-md border border-white/15 px-3 py-2">
              <input
                type="range"
                min={2}
                max={28}
                value={drawWidth}
                onChange={(e) => setDrawWidth(parseInt(e.target.value, 10))}
                className="flex-1 accent-violet-500"
                aria-label="Brush size"
              />
              <button type="button" onClick={() => setEraserMode((v) => !v)} className={`p-2 rounded-full ${eraserMode ? "bg-violet-500" : "bg-white/10"}`}>
                <Eraser className="w-4 h-4 text-white" />
              </button>
              <button type="button" onClick={undoDraw} className="p-2 rounded-full bg-white/10">
                <Undo2 className="w-4 h-4 text-white" />
              </button>
              <button type="button" onClick={clearDraw} className="p-2 rounded-full bg-white/10">
                <Trash2 className="w-4 h-4 text-white" />
              </button>
              <button type="button" onClick={() => setActiveTool(null)} className="p-2 rounded-full bg-violet-500">
                <Check className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* TikTok-style text: live on media + style bar at bottom */}
      {activeTool === "text" && (
        <>
          <div className="absolute top-14 inset-x-0 z-40 flex justify-end px-3 gap-2">
            <button type="button" onClick={() => setActiveTool(null)} className="px-4 py-2 rounded-full bg-black/50 text-white text-sm font-semibold">
              Cancel
            </button>
            <button type="button" onClick={saveText} className="px-4 py-2 rounded-full bg-violet-500 text-white text-sm font-bold flex items-center gap-1 shadow-[0_0_16px_rgba(168,85,247,0.6)]">
              <Check className="w-4 h-4" /> Done
            </button>
          </div>
          <div
            className="absolute inset-x-0 z-40 px-2 transition-[bottom] duration-150"
            style={{ bottom: `calc(env(safe-area-inset-bottom) + 5.75rem + ${keyboardOffset}px)` }}
          >
            <button
              type="button"
              onClick={() => textInputRef.current?.focus()}
              className="w-full mb-2 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white/60 text-xs font-semibold"
            >
              {textDraft ? "Tap to keep typing" : "Tap to type on video"}
            </button>
            <div className="overflow-x-auto scrollbar-hide flex gap-2 pb-2">
              {CREATE_TEXT_STYLES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setTextStyle(p.id);
                    setTextColor(p.defaultColor);
                  }}
                  className={`shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold border ${
                    textStyle === p.id
                      ? "border-violet-400 bg-violet-500/25 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                      : "border-white/15 bg-black/60 text-white/80"
                  }`}
                  style={{ fontFamily: p.fontFamily }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-center items-center mt-2">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setTextColor(c)}
                  className={`w-7 h-7 rounded-full border-2 ${textColor === c ? "border-violet-400 scale-110" : "border-white/25"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="range"
                min={0.6}
                max={2.5}
                step={0.05}
                value={textPos.scale}
                onChange={(e) => setTextPos((p) => ({ ...p, scale: parseFloat(e.target.value) }))}
                className="w-24 ml-2 accent-violet-500"
                aria-label="Text size"
              />
            </div>
          </div>
          <input
            ref={textInputRef}
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            className="fixed left-0 right-0 h-12 z-[95] bg-transparent text-transparent caret-violet-400 border-0 outline-none px-4 text-base"
            style={{ bottom: keyboardOffset }}
            aria-label="Type text on video"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
          />
        </>
      )}

      {activeTool === "crop" && (
        <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-40 rounded-2xl bg-zinc-900/95 border border-white/10 p-3 space-y-2">
          <label className="text-[10px] text-white/50">Zoom</label>
          <input type="range" min={1} max={2} step={0.05} value={meta.crop?.scale ?? 1} onChange={(e) => patch({ crop: { scale: parseFloat(e.target.value), x: meta.crop?.x ?? 50, y: meta.crop?.y ?? 50 } })} className="w-full accent-violet-500" />
          <button type="button" onClick={() => setActiveTool(null)} className="w-full py-2.5 rounded-xl bg-violet-500 text-white font-bold text-sm">Done</button>
        </div>
      )}

      {activeTool === "trim" && mediaType === "video" && (
        <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-40 rounded-2xl bg-zinc-900/95 border border-white/10 p-3 space-y-2">
          <p className="text-xs text-white/60">Trim start / end (seconds)</p>
          <div className="flex gap-2 items-center text-xs text-white">
            <input type="number" min={0} step={0.1} value={meta.trim?.start ?? 0} onChange={(e) => patch({ trim: { start: parseFloat(e.target.value) || 0, end: meta.trim?.end ?? 30 } })} className="w-20 bg-white/10 rounded-lg px-2 py-1.5" />
            <span>to</span>
            <input type="number" min={0} step={0.1} value={meta.trim?.end ?? 30} onChange={(e) => patch({ trim: { start: meta.trim?.start ?? 0, end: parseFloat(e.target.value) || 30 } })} className="w-20 bg-white/10 rounded-lg px-2 py-1.5" />
          </div>
          <button type="button" onClick={() => setActiveTool(null)} className="w-full py-2.5 rounded-xl bg-violet-500 text-white font-bold text-sm">Done</button>
        </div>
      )}

      {/* Bottom toolbar */}
      {!showStickers && (
      <div className="absolute bottom-[max(env(safe-area-inset-bottom),0.25rem)] inset-x-0 z-40 px-2">
        <div className="flex justify-around mb-2 px-1">
          {tools.filter((t) => t.show !== false).map((t) => {
            const Icon = t.icon;
            const active = activeTool === t.id || (t.id === "sticker" && showStickers);
            return (
              <button
                key={t.id!}
                type="button"
                onClick={() => {
                  if (t.id === "sticker") {
                    setShowStickers(true);
                    setActiveTool(null);
                  } else if (t.id === "text") startTextMode();
                  else setActiveTool(active ? null : t.id);
                }}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl min-w-[3.5rem] transition-all ${
                  active ? "bg-violet-500/25 shadow-[0_0_14px_rgba(168,85,247,0.45)]" : ""
                }`}
              >
                <Icon
                  className={`w-6 h-6 transition-all ${
                    active ? "text-violet-300 drop-shadow-[0_0_8px_rgba(196,181,253,0.9)]" : "text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                  }`}
                  strokeWidth={active ? 2.5 : 2}
                />
                <span className={`text-[10px] font-bold ${active ? "text-violet-200" : "text-white/90"}`}>{t.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => patch({ muteOriginal: !meta.muteOriginal })}
            className="flex flex-col items-center gap-1 px-3 py-1.5 min-w-[3.5rem]"
          >
            {meta.muteOriginal ? (
              <VolumeX className="w-6 h-6 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" strokeWidth={2} />
            ) : (
              <Volume2 className="w-6 h-6 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" strokeWidth={2} />
            )}
            <span className="text-[10px] font-bold text-white/90">Mute</span>
          </button>
        </div>
        {activeTool !== "text" && activeTool !== "draw" && (
          <>
            {mediaType === "video" && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <Volume2 className="w-4 h-4 text-white/70 shrink-0" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={meta.originalVolume ?? 1}
                  onChange={(e) => patch({ originalVolume: parseFloat(e.target.value) })}
                  className="flex-1 accent-violet-500"
                  aria-label="Original audio volume"
                />
              </div>
            )}
            <input
              value={caption}
              onChange={(e) => onCaptionChange(e.target.value)}
              placeholder="Write a caption…"
              className="w-full bg-black/50 backdrop-blur-md border border-white/20 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-violet-400/50"
            />
          </>
        )}
      </div>
      )}

      {selected && activeTool !== "text" && !showStickers && (
        <button
          type="button"
          onClick={deleteSelected}
          className="absolute top-[calc(env(safe-area-inset-top)+3.5rem)] right-3 z-40 w-10 h-10 rounded-full bg-red-500/90 flex items-center justify-center shadow-lg"
          aria-label="Delete selected"
        >
          <Trash2 className="w-5 h-5 text-white" />
        </button>
      )}

      <StickerDrawer
        open={showStickers}
        onClose={() => setShowStickers(false)}
        onPick={addSticker}
        mediaType={mediaType}
        hasMusic={!!meta.music?.loopId || !!meta.music?.audioUrl || !!musicPreviewUrl}
        caption={caption}
      />
    </div>
  );
}
