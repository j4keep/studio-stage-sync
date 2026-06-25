import { useState, useRef, useEffect } from "react";
import {
  Type,
  Sticker,
  Pencil,
  Crop,
  Scissors,
  Volume2,
  VolumeX,
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
  const pendingTextFocus = useRef(false);

  const bindTextInput = (el: HTMLInputElement | null) => {
    textInputRef.current = el;
    if (el && pendingTextFocus.current) {
      pendingTextFocus.current = false;
      el.focus({ preventScroll: true });
    }
  };

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - Math.max(0, vv.offsetTop));
      setKeyboardOffset(offset);
    };
    onResize();
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
    if (activeTool !== "text") return;
    const id = requestAnimationFrame(() => {
      textInputRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
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
    pendingTextFocus.current = true;
    setActiveTool("text");
    setEditingTextId(null);
    setTextDraft("");
    setTextPos({ x: 50, y: 38, scale: 1 });
    setTextStyle("bubble");
    setTextColor("#ffffff");
    setSelected(null);
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
    pendingTextFocus.current = true;
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

  const handleToolPress = (t: (typeof tools)[0]) => {
    if (t.id === "sticker") {
      setShowStickers(true);
      setActiveTool(null);
    } else if (t.id === "text") startTextMode();
    else setActiveTool(activeTool === t.id ? null : t.id);
  };

  const toolbarButtons = (
    <>
      {tools.filter((t) => t.show !== false).map((t) => {
        const Icon = t.icon;
        const active = activeTool === t.id;
        return (
          <button
            key={t.id!}
            type="button"
            onClick={() => handleToolPress(t)}
            className={`flex items-center justify-center rounded-xl transition-all editor-touch-none ${
              active ? "bg-white text-black shadow-lg" : "text-white"
            } w-12 h-12 sm:w-11 sm:h-11`}
            aria-label={t.label}
          >
            <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => patch({ muteOriginal: !meta.muteOriginal })}
        className="w-12 h-12 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl text-white editor-touch-none"
        aria-label="Mute original audio"
      >
        {meta.muteOriginal ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>
    </>
  );

  return (
    <div className="relative h-full w-full bg-black overscroll-none">
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
        onLiveTextFocus={() => textInputRef.current?.focus({ preventScroll: true })}
      />

      {activeTool === "draw" && (
        <>
          <div className="absolute left-[max(env(safe-area-inset-left),0.5rem)] top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 py-2 px-1 rounded-2xl bg-black/60 backdrop-blur-md max-h-[50vh] overflow-y-auto touch-pan-y scrollbar-hide">
            {DRAW_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setDrawColor(c); setEraserMode(false); }}
                className={`shrink-0 w-10 h-10 rounded-full border-2 editor-touch-none ${drawColor === c && !eraserMode ? "border-white scale-110" : "border-white/25"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="absolute top-[max(env(safe-area-inset-top),0.25rem)] left-2 right-2 z-40 flex items-center gap-1.5 rounded-xl bg-black/60 backdrop-blur-md px-2 py-2 overflow-x-auto scrollbar-hide touch-pan-x">
            {BRUSH_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyBrushPreset(p.id)}
                className={`shrink-0 px-3 py-2 rounded-lg text-[11px] font-bold editor-touch-none ${
                  brushPreset === p.id ? "bg-white text-black" : "text-white/70"
                }`}
              >
                {p.label}
              </button>
            ))}
            <button type="button" onClick={() => setEraserMode((v) => !v)} className={`shrink-0 p-2.5 rounded-lg editor-touch-none ${eraserMode ? "bg-white text-black" : "text-white"}`}>
              <Eraser className="w-5 h-5" />
            </button>
            <button type="button" onClick={undoDraw} className="shrink-0 p-2.5 text-white editor-touch-none"><Undo2 className="w-5 h-5" /></button>
            <button type="button" onClick={clearDraw} className="shrink-0 p-2.5 text-white editor-touch-none"><Trash2 className="w-5 h-5" /></button>
            <button type="button" onClick={() => setActiveTool(null)} className="shrink-0 px-4 py-2 rounded-lg bg-white text-black text-xs font-bold editor-touch-none ml-auto">Done</button>
          </div>
        </>
      )}

      {activeTool === "text" && (
        <>
          <div className="absolute top-[max(env(safe-area-inset-top),0.25rem)] right-[max(env(safe-area-inset-right),0.75rem)] z-[101] flex gap-2">
            <button type="button" onClick={() => { setActiveTool(null); setTextDraft(""); }} className="px-3 py-2.5 rounded-full bg-black/50 text-white text-sm font-semibold editor-touch-none">
              Cancel
            </button>
            <button type="button" onClick={saveText} className="px-4 py-2.5 rounded-full bg-white text-black text-sm font-bold shadow-lg editor-touch-none">
              Done
            </button>
          </div>
          <div
            className="absolute inset-x-0 z-[100] px-3 safe-area-x transition-[bottom] duration-150"
            style={{ bottom: keyboardOffset > 0 ? keyboardOffset : "max(env(safe-area-inset-bottom), 0.5rem)" }}
          >
            <input
              ref={bindTextInput}
              type="text"
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              placeholder="Type your text…"
              className="w-full mb-2 py-3.5 px-4 rounded-xl bg-zinc-900/95 border border-white/20 text-white editor-no-zoom-input placeholder:text-white/40 focus:outline-none focus:border-white/50"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              inputMode="text"
              onKeyDown={(e) => e.key === "Enter" && saveText()}
            />
            <div className="overflow-x-auto scrollbar-hide flex gap-2 touch-pan-x pb-1">
              {CREATE_TEXT_STYLES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setTextStyle(p.id); setTextColor(p.defaultColor); }}
                  className={`shrink-0 px-4 py-2.5 rounded-lg text-xs font-bold editor-touch-none ${
                    textStyle === p.id ? "bg-white text-black" : "bg-black/60 text-white/80"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide touch-pan-x pb-1">
              {TEXT_COLORS.slice(0, 8).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setTextColor(c)}
                  className={`shrink-0 w-9 h-9 rounded-full border-2 editor-touch-none ${textColor === c ? "border-white scale-110" : "border-white/20"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {activeTool === "crop" && (
        <div className="absolute inset-x-3 z-40 rounded-2xl bg-zinc-900/95 border border-white/10 p-4 space-y-3" style={{ bottom: "max(env(safe-area-inset-bottom), 1rem)" }}>
          <label className="text-[10px] text-white/50">Zoom</label>
          <input type="range" min={1} max={2} step={0.05} value={meta.crop?.scale ?? 1} onChange={(e) => patch({ crop: { scale: parseFloat(e.target.value), x: meta.crop?.x ?? 50, y: meta.crop?.y ?? 50 } })} className="w-full accent-violet-500" />
          <button type="button" onClick={() => setActiveTool(null)} className="w-full py-2.5 rounded-xl bg-violet-500 text-white font-bold text-sm">Done</button>
        </div>
      )}

      {activeTool === "trim" && mediaType === "video" && (
        <div className="absolute inset-x-3 z-40 rounded-2xl bg-zinc-900/95 border border-white/10 p-4 space-y-3" style={{ bottom: "max(env(safe-area-inset-bottom), 1rem)" }}>
          <p className="text-xs text-white/60">Trim start / end (seconds)</p>
          <div className="flex gap-2 items-center text-xs text-white">
            <input type="number" min={0} step={0.1} value={meta.trim?.start ?? 0} onChange={(e) => patch({ trim: { start: parseFloat(e.target.value) || 0, end: meta.trim?.end ?? 30 } })} className="w-20 bg-white/10 rounded-lg px-2 py-1.5" />
            <span>to</span>
            <input type="number" min={0} step={0.1} value={meta.trim?.end ?? 30} onChange={(e) => patch({ trim: { start: meta.trim?.start ?? 0, end: parseFloat(e.target.value) || 30 } })} className="w-20 bg-white/10 rounded-lg px-2 py-1.5" />
          </div>
          <button type="button" onClick={() => setActiveTool(null)} className="w-full py-2.5 rounded-xl bg-violet-500 text-white font-bold text-sm">Done</button>
        </div>
      )}

      {/* Mobile: bottom toolbar (thumb-friendly) */}
      {!showStickers && activeTool !== "text" && activeTool !== "draw" && (
        <div
          className="sm:hidden absolute inset-x-3 z-40 flex justify-around items-center gap-1 px-2 py-2 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 editor-touch-none"
          style={{ bottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
        >
          {toolbarButtons}
        </div>
      )}

      {/* Desktop / tablet: right sidebar */}
      {!showStickers && activeTool !== "text" && activeTool !== "draw" && (
        <div
          className="hidden sm:flex absolute top-1/2 -translate-y-1/2 z-40 flex-col items-center gap-2 py-2 px-1 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 editor-touch-none"
          style={{ right: "max(env(safe-area-inset-right), 0.5rem)" }}
        >
          {toolbarButtons}
        </div>
      )}

      {selected?.type === "text" && activeTool !== "text" && !showStickers && (
        <button
          type="button"
          onClick={() => editSelectedText()}
          className="absolute z-40 px-3 py-2 rounded-full bg-white text-black text-xs font-bold shadow-lg editor-touch-none"
          style={{ top: "max(env(safe-area-inset-top), 3.5rem)", right: "max(env(safe-area-inset-right), 0.75rem)" }}
        >
          Edit text
        </button>
      )}

      {selected && activeTool !== "text" && !showStickers && (
        <button
          type="button"
          onClick={deleteSelected}
          className="absolute z-40 w-11 h-11 rounded-full bg-black/60 flex items-center justify-center editor-touch-none"
          style={{ top: "max(env(safe-area-inset-top), 0.5rem)", left: "max(env(safe-area-inset-left), 0.75rem)" }}
          aria-label="Delete selected"
        >
          <Trash2 className="w-5 h-5 text-red-400" />
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
