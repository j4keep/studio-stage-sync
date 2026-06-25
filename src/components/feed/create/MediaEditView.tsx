import { useState, useRef, useEffect, useCallback } from "react";
import { Type, Sticker, Pencil, Crop, Volume2, VolumeX, Undo2, Check, X } from "lucide-react";
import { toast } from "sonner";
import PostOverlayRenderer from "./PostOverlayRenderer";
import StickerDrawer from "./StickerDrawer";
import type { PostEditorMeta, TextOverlay, StickerOverlay, DrawStroke, TextOverlayStyle } from "@/lib/post-editor";
import { BRUSH_PRESETS, eraseStrokesNear } from "@/lib/post-editor";
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

/** WhatsApp-style green action button */
function GreenDoneBtn({ onClick, className = "" }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-11 h-11 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg editor-touch-none ${className}`}
      aria-label="Done"
    >
      <Check className="w-5 h-5 text-white" strokeWidth={3} />
    </button>
  );
}

/** Vertical color picker like WhatsApp Status */
function VerticalColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const pickFromY = useCallback((clientY: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const idx = Math.round(t * (TEXT_COLORS.length - 1));
    onChange(TEXT_COLORS[idx]);
  }, [onChange]);

  const activeIdx = Math.max(0, TEXT_COLORS.indexOf(value));

  return (
    <div
      ref={trackRef}
      className="relative w-9 rounded-full overflow-hidden editor-touch-none cursor-pointer"
      style={{
        height: "min(42vh, 280px)",
        background: `linear-gradient(to bottom, ${TEXT_COLORS.join(", ")})`,
      }}
      onPointerDown={(e) => {
        pickFromY(e.clientY);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) pickFromY(e.clientY);
      }}
    >
      <div
        className="absolute left-1/2 -translate-x-1/2 w-7 h-7 rounded-full border-2 border-white shadow-md pointer-events-none"
        style={{
          top: `${(activeIdx / Math.max(1, TEXT_COLORS.length - 1)) * 100}%`,
          transform: "translate(-50%, -50%)",
          backgroundColor: value,
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
    setTextPos({ x: 50, y: 42, scale: 1 });
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
        onLiveTextMove={(p) => setTextPos((prev) => ({ ...prev, ...p }))}
        onTextTap={(id) => editSelectedText(id)}
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
            className="absolute z-50 w-11 h-11 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg editor-touch-none"
            style={{ top: "max(env(safe-area-inset-top), 0.5rem)", right: "max(env(safe-area-inset-right), 0.75rem)" }}
            aria-label="Done"
          >
            <Check className="w-5 h-5 text-white" strokeWidth={3} />
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

      {/* ── TEXT MODE (WhatsApp style) ── */}
      {activeTool === "text" && (
        <>
          <div
            className="absolute z-[110]"
            style={{ top: "max(env(safe-area-inset-top), 0.5rem)", left: "max(env(safe-area-inset-left), 0.75rem)" }}
          >
            <GreenDoneBtn onClick={saveText} />
          </div>

          {/* Color picker — right side */}
          <div
            className="absolute z-[105] flex items-center"
            style={{
              right: "max(env(safe-area-inset-right), 0.75rem)",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <VerticalColorPicker value={textColor} onChange={setTextColor} />
          </div>

          {/* Hidden input — drives keyboard, no visible textbox */}
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

          {/* Font style row — above keyboard */}
          <div
            className="absolute inset-x-0 z-[108] px-3 editor-touch-none"
            style={{
              bottom: keyboardOffset > 0 ? keyboardOffset + 8 : "max(env(safe-area-inset-bottom), 5rem)",
            }}
          >
            <div className="flex gap-3 overflow-x-auto scrollbar-hide touch-pan-x py-2 justify-center">
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
                    className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                      active ? "bg-white text-black scale-110" : "bg-black/50 text-white border border-white/20"
                    }`}
                  >
                    <span style={{ fontFamily: previewStyle.fontFamily, fontSize: "14px" }}>Aa</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── DRAW MODE (WhatsApp style) ── */}
      {activeTool === "draw" && (
        <>
          <div
            className="absolute z-[110]"
            style={{ top: "max(env(safe-area-inset-top), 0.5rem)", left: "max(env(safe-area-inset-left), 0.75rem)" }}
          >
            <GreenDoneBtn onClick={() => setActiveTool(null)} />
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
              right: "max(env(safe-area-inset-right), 0.75rem)",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <VerticalColorPicker value={drawColor} onChange={setDrawColor} />
          </div>

          {/* Brush styles — bottom row */}
          <div
            className="absolute inset-x-0 z-[108] flex justify-center gap-4 px-4 py-4 bg-gradient-to-t from-black/80 to-transparent editor-touch-none"
            style={{ bottom: 0, paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
          >
            {BRUSH_PRESETS.slice(0, 4).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyBrushPreset(p.id)}
                className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all ${
                  brushPreset === p.id ? "border-white bg-white/20 scale-110" : "border-white/30 bg-black/40"
                }`}
                aria-label={p.label}
              >
                <svg viewBox="0 0 40 20" className="w-8 h-4">
                  <path
                    d="M2 12 Q10 4 20 10 T38 8"
                    fill="none"
                    stroke="white"
                    strokeWidth={p.width / 2}
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
