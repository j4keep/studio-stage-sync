import { useState, useRef, useEffect, useCallback } from "react";
import { Type, Sticker, Pencil, Crop, Volume2, VolumeX, Undo2, Check, X, Trash2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import PostOverlayRenderer from "./PostOverlayRenderer";
import StickerDrawer from "./StickerDrawer";
import type { PostEditorMeta, TextOverlay, StickerOverlay, DrawStroke, TextOverlayStyle } from "@/lib/post-editor";
import { BRUSH_PRESETS, DRAW_COLORS, eraseStrokesNear } from "@/lib/post-editor";
import { TEXT_COLORS, CREATE_TEXT_STYLES, getTextStyleInline } from "@/lib/text-styles";

const newId = () => Math.random().toString(36).slice(2, 9);

type Tool = "text" | "draw" | null;

interface Props {
  mediaType: "image" | "video";
  previewUrl: string | null;
  meta: PostEditorMeta;
  onMetaChange: (meta: PostEditorMeta) => void;
  caption: string;
  onCaptionChange: (v: string) => void;
  musicPreviewUrl?: string | null;
  onBack: () => void;
  onDone: () => void;
}

/** Done button using app theme primary color */
function ThemeDoneBtn({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg glow-primary editor-touch-none ${className}`}
      aria-label="Done"
    >
      <Check className="w-5 h-5" strokeWidth={3} />
    </button>
  );
}

/** Slim vertical color slider (text + draw) */
function SlimColorPicker({
  value,
  onChange,
  colors,
}: {
  value: string;
  onChange: (c: string) => void;
  colors: readonly string[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const colorToT = (color: string) => {
    const idx = colors.indexOf(color);
    return idx >= 0 ? idx / Math.max(1, colors.length - 1) : 0;
  };

  const [thumbT, setThumbT] = useState(() => colorToT(value));

  useEffect(() => {
    if (draggingRef.current) return;
    setThumbT(colorToT(value));
  }, [value, colors]);

  const pickFromY = useCallback(
    (clientY: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const idx = Math.round(t * (colors.length - 1));
      setThumbT(t);
      onChange(colors[idx]);
    },
    [onChange, colors],
  );

  const endDrag = useCallback(() => {
    draggingRef.current = false;
  }, []);

  return (
    <div
      ref={trackRef}
      className="relative flex items-center justify-center editor-touch-none touch-none cursor-pointer"
      style={{ width: 32, height: "min(34vh, 220px)" }}
      onPointerDown={(e) => {
        e.preventDefault();
        draggingRef.current = true;
        pickFromY(e.clientY);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) pickFromY(e.clientY);
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 6,
          height: "100%",
          background: `linear-gradient(to bottom, ${colors.join(", ")})`,
          boxShadow: "0 0 0 1px rgba(255,255,255,0.15)",
        }}
      />
      <div
        className="absolute left-1/2 pointer-events-none rounded-full border-2 border-white"
        style={{
          width: 20,
          height: 20,
          top: `${thumbT * 100}%`,
          transform: "translate(-50%, -50%)",
          backgroundColor: value,
          boxShadow: "0 1px 6px rgba(0,0,0,0.45)",
        }}
      />
    </div>
  );
}

export default function MediaEditView({
  mediaType,
  previewUrl,
  meta,
  onMetaChange,
  caption,
  musicPreviewUrl,
  onBack,
  onDone,
}: Props) {
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [showStickers, setShowStickers] = useState(false);
  const [selected, setSelected] = useState<{ id: string; type: "text" | "sticker" } | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [textStyle, setTextStyle] = useState<TextOverlayStyle>("bubble");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textPos, setTextPos] = useState({ x: 50, y: 42, scale: 1 });
  const [drawColor, setDrawColor] = useState("#39ff14");
  const [drawWidth, setDrawWidth] = useState(8);
  const [drawHighlighter, setDrawHighlighter] = useState(false);
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

  const isToolActive = activeTool !== null || showStickers;

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
    const id = requestAnimationFrame(() => textInputRef.current?.focus({ preventScroll: true }));
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

  const deleteEditingText = () => {
    if (editingTextId) {
      patch({ overlays: meta.overlays.filter((o) => o.id !== editingTextId) });
    }
    cancelText();
  };

  const adjustTextScale = (delta: number) => {
    setTextPos((prev) => ({ ...prev, scale: Math.max(0.35, Math.min(4, +(prev.scale + delta).toFixed(2))) }));
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
    const layerOffset = (meta.overlays.length % 5) * 7;
    setTextPos({ x: 50, y: 38 + layerOffset, scale: 1 });
    setTextStyle("bubble");
    setTextColor("#ffffff");
    setSelected(null);
  };

  const cancelText = () => {
    setActiveTool(null);
    setTextDraft("");
    setEditingTextId(null);
    textInputRef.current?.blur();
  };

  const saveText = () => {
    const t = textDraft.trim();
    textInputRef.current?.blur();
    if (!t) {
      cancelText();
      return;
    }
    if (editingTextId) {
      updateText(editingTextId, { text: t, style: textStyle, color: textColor, ...textPos });
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
    }
    setTextDraft("");
    setEditingTextId(null);
    setSelected(null);
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

  const applyBrushPreset = (id: string) => {
    const preset = BRUSH_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setBrushPreset(id);
    setDrawWidth(preset.width);
    setDrawHighlighter(!!(preset as { highlighter?: boolean }).highlighter);
    setDrawColor(drawColor);
  };

  const liveTextDraft =
    activeTool === "text"
      ? { text: textDraft, style: textStyle, color: textColor, ...textPos }
      : null;

  const bottomTools = [
    { id: "text" as const, icon: Type, label: "Text", action: startTextMode },
    { id: "sticker" as const, icon: Sticker, label: "Stickers", action: () => setShowStickers(true) },
    { id: "draw" as const, icon: Pencil, label: "Draw", action: () => setActiveTool("draw") },
    { id: "crop" as const, icon: Crop, label: "Crop", action: () => toast.info("Crop editor coming soon") },
    { id: "mute" as const, icon: meta.muteOriginal ? VolumeX : Volume2, label: "Mute", action: () => patch({ muteOriginal: !meta.muteOriginal }) },
  ];

  return (
    <div className="relative h-full w-full bg-black overscroll-none">
      {/* Full-screen media */}
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
        drawColor={drawColor}
        drawWidth={drawWidth}
        drawHighlighter={drawHighlighter}
        onAddStroke={addStroke}
        onEraseAt={eraseAt}
        liveTextDraft={liveTextDraft}
        hiddenOverlayId={editingTextId}
        textEditing={activeTool === "text"}
        onLiveTextMove={(p) => setTextPos((prev) => ({ ...prev, ...p }))}
        onTextTap={(id) => {
          if (activeTool === "text") return;
          editSelectedText(id);
        }}
        onLiveTextFocus={() => textInputRef.current?.focus({ preventScroll: true })}
        liveTextPlaceholder="Add text"
      />

      {/* ── Main chrome: back + done (hidden during text/draw/stickers) ── */}
      {!isToolActive && (
        <>
          <button
            type="button"
            onClick={onBack}
            className="absolute z-50 w-11 h-11 flex items-center justify-center text-white editor-touch-none"
            style={{ top: "max(env(safe-area-inset-top), 0.5rem)", left: "max(env(safe-area-inset-left), 0.75rem)" }}
            aria-label="Back"
          >
            <X className="w-7 h-7" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            onClick={onDone}
            className="absolute z-50 w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg glow-primary editor-touch-none"
            style={{ top: "max(env(safe-area-inset-top), 0.5rem)", right: "max(env(safe-area-inset-right), 0.75rem)" }}
            aria-label="Done"
          >
            <Check className="w-5 h-5" strokeWidth={3} />
          </button>
        </>
      )}

      {/* ── Bottom toolbar (main screen only) ── */}
      {!isToolActive && (
        <div
          className="absolute inset-x-0 z-50 flex justify-around items-center px-4 py-3 bg-gradient-to-t from-black/80 via-black/50 to-transparent editor-touch-none"
          style={{ bottom: 0, paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
        >
          {bottomTools.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={t.action}
                className="flex flex-col items-center gap-1 min-w-[3rem] py-1 text-white/90 active:scale-95 transition-transform"
                aria-label={t.label}
              >
                <Icon className="w-6 h-6" strokeWidth={1.75} />
              </button>
            );
          })}
        </div>
      )}

      {/* ── TEXT MODE — controls only while actively editing ── */}
      {activeTool === "text" && (
        <>
          <div
            className="absolute z-[110] flex items-center gap-2"
            style={{ top: "max(env(safe-area-inset-top), 0.5rem)", left: "max(env(safe-area-inset-left), 0.75rem)" }}
          >
            <ThemeDoneBtn onClick={saveText} />
          </div>

          <button
            type="button"
            onClick={deleteEditingText}
            className="absolute z-[110] w-10 h-10 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center editor-touch-none"
            style={{ top: "max(env(safe-area-inset-top), 0.5rem)", right: "max(env(safe-area-inset-right), 0.75rem)" }}
            aria-label="Delete text"
          >
            <Trash2 className="w-[18px] h-[18px] text-white" />
          </button>

          {/* Slim color picker */}
          <div
            className="absolute z-[105]"
            style={{
              right: "max(env(safe-area-inset-right), 0.5rem)",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <SlimColorPicker value={textColor} onChange={setTextColor} colors={TEXT_COLORS} />
          </div>

          {/* Size +/- */}
          <div
            className="absolute z-[105] flex flex-col gap-2 editor-touch-none"
            style={{
              left: "max(env(safe-area-inset-left), 0.75rem)",
              top: "calc(max(env(safe-area-inset-top), 0.5rem) + 3.5rem)",
            }}
          >
            <button
              type="button"
              onClick={() => adjustTextScale(0.12)}
              className="w-9 h-9 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-white border border-white/20"
              aria-label="Increase text size"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => adjustTextScale(-0.12)}
              className="w-9 h-9 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-white border border-white/20"
              aria-label="Decrease text size"
            >
              <Minus className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>

          <input
            ref={bindTextInput}
            type="text"
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            className="fixed opacity-0 w-px h-px editor-no-zoom-input"
            style={{ bottom: keyboardOffset || 0, left: 0 }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            inputMode="text"
            aria-label="Add text"
          />

          {/* Aa styles — only while keyboard is open */}
          {keyboardOffset > 0 && (
            <div
              className="absolute inset-x-0 z-[108] px-3 editor-touch-none"
              style={{ bottom: keyboardOffset + 6 }}
            >
              <div className="flex gap-2.5 overflow-x-auto scrollbar-hide touch-pan-x py-1.5 justify-center">
                {CREATE_TEXT_STYLES.map((p) => {
                  const active = textStyle === p.id;
                  const previewStyle = getTextStyleInline(p.id, p.defaultColor);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setTextStyle(p.id);
                        setTextColor(p.defaultColor);
                      }}
                      className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                        active ? "bg-white text-black" : "bg-black/40 text-white border border-white/15"
                      }`}
                    >
                      <span style={{ fontFamily: previewStyle.fontFamily, fontSize: "13px" }}>Aa</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── DRAW MODE (WhatsApp style) ── */}
      {activeTool === "draw" && (
        <>
          <div
            className="absolute z-[110]"
            style={{ top: "max(env(safe-area-inset-top), 0.5rem)", left: "max(env(safe-area-inset-left), 0.75rem)" }}
          >
            <ThemeDoneBtn onClick={() => setActiveTool(null)} />
          </div>
          <button
            type="button"
            onClick={undoDraw}
            className="absolute z-[110] w-11 h-11 rounded-full bg-black/40 flex items-center justify-center editor-touch-none"
            style={{ top: "max(env(safe-area-inset-top), 0.5rem)", right: "max(env(safe-area-inset-right), 0.75rem)" }}
            aria-label="Undo"
          >
            <Undo2 className="w-5 h-5 text-white" />
          </button>

          <div
            className="absolute z-[105]"
            style={{
              right: "max(env(safe-area-inset-right), 0.5rem)",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <SlimColorPicker value={drawColor} onChange={setDrawColor} colors={DRAW_COLORS} />
          </div>

          {/* Brush styles — bottom row */}
          <div
            className="absolute inset-x-0 z-[108] flex justify-center gap-2.5 px-4 py-3 bg-gradient-to-t from-black/80 to-transparent editor-touch-none"
            style={{ bottom: 0, paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
          >
            {BRUSH_PRESETS.slice(0, 4).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyBrushPreset(p.id)}
                className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all ${
                  brushPreset === p.id ? "border-white bg-white/20 scale-105" : "border-white/30 bg-black/40"
                }`}
                aria-label={p.label}
              >
                <svg viewBox="0 0 40 20" className="w-6 h-3">
                  <path
                    d="M2 12 Q10 4 20 10 T38 8"
                    fill="none"
                    stroke="white"
                    strokeWidth={Math.max(1.5, p.width / 4)}
                    strokeLinecap="round"
                    opacity={p.highlighter ? 0.5 : 1}
                  />
                </svg>
              </button>
            ))}
          </div>
        </>
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
