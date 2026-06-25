import { useRef, useState, useCallback, useEffect } from "react";
import { Trash2 } from "lucide-react";
import type { PostEditorMeta, TextOverlay, StickerOverlay, DrawStroke } from "@/lib/post-editor";
import { strokeToSmoothPath, normalizeTextStyle } from "@/lib/post-editor";
import { getStickerSrc } from "@/lib/sticker-library";
import { getTextStyleInline, TEXT_STYLE_PRESETS } from "@/lib/text-styles";

type SelType = "text" | "sticker" | null;

interface Props {
  meta: PostEditorMeta;
  editable?: boolean;
  selected?: { id: string; type: SelType } | null;
  onSelect?: (sel: { id: string; type: SelType } | null) => void;
  onUpdateText?: (id: string, patch: Partial<TextOverlay>) => void;
  onUpdateSticker?: (id: string, patch: Partial<StickerOverlay>) => void;
  onDeleteSelected?: () => void;
  onTextTap?: (id: string) => void;
  drawing?: boolean;
  eraserMode?: boolean;
  drawColor?: string;
  drawWidth?: number;
  drawHighlighter?: boolean;
  onAddStroke?: (stroke: DrawStroke) => void;
  onEraseAt?: (x: number, y: number) => void;
  liveTextDraft?: { text: string; style: TextOverlay["style"]; color: string; x: number; y: number; scale: number } | null;
  hiddenOverlayId?: string | null;
  textEditing?: boolean;
  onLiveTextMove?: (patch: { x?: number; y?: number; scale?: number }) => void;
  onLiveTextFocus?: () => void;
  liveTextPlaceholder?: string;
  className?: string;
}

const newStroke = (color: string, width: number, highlighter?: boolean): DrawStroke => ({
  points: [],
  color,
  width,
  highlighter,
});

export default function PostOverlayRenderer({
  meta,
  editable = false,
  selected,
  onSelect,
  onUpdateText,
  onUpdateSticker,
  onDeleteSelected,
  onTextTap,
  drawing = false,
  eraserMode = false,
  drawColor = "#ffffff",
  drawWidth = 6,
  drawHighlighter = false,
  onAddStroke,
  onEraseAt,
  liveTextDraft,
  hiddenOverlayId = null,
  textEditing = false,
  onLiveTextMove,
  onLiveTextFocus,
  liveTextPlaceholder = "Add text",
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    type: "text" | "sticker" | "live";
    mode: "move" | "scale" | "rotate" | "pinch";
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origScale: number;
    origRot: number;
    pinchStartDist?: number;
    moved?: boolean;
  } | null>(null);
  const drawRef = useRef<DrawStroke | null>(null);
  const [liveStroke, setLiveStroke] = useState<DrawStroke | null>(null);
  const [trashHover, setTrashHover] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());

  useEffect(() => {
    const el = containerRef.current;
    if (!el || (!editable && !drawing)) return;
    const block = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, [editable, drawing]);

  const pctFromEvent = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    };
  };

  const renderTextBlock = (
    text: string,
    style: TextOverlay["style"],
    color: string,
    scale: number,
    isSel?: boolean,
    extraClass = "",
  ) => {
    const normalized = normalizeTextStyle(style);
    const preset = TEXT_STYLE_PRESETS.find((p) => p.id === normalized);
    const inline = getTextStyleInline(normalized, color || preset?.defaultColor || "#fff");
    const isRounded = normalized === "rounded";

    return (
      <span
        className={`inline-block text-center whitespace-pre-wrap break-words max-w-[85vw] ${preset?.className ?? ""} ${extraClass} ${isSel ? "ring-1 ring-white/60 rounded" : ""}`}
        style={{
          ...inline,
          fontSize: `${Math.round(24 * scale)}px`,
          ...(isRounded
            ? { backgroundColor: "rgba(255,255,255,0.92)", padding: "8px 16px", borderRadius: "12px", color: color === "#ffffff" ? "#1a1a1a" : color }
            : {}),
        }}
      >
        {text || "Text"}
      </span>
    );
  };

  const tryStartPinch = (selId: string, selType: "text" | "sticker" | "live") => {
    if (activePointers.current.size < 2) return false;
    const pts = [...activePointers.current.values()];
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    let item: { x: number; y: number; scale: number; rotation?: number } | undefined;
    if (selType === "live" && liveTextDraft) {
      item = liveTextDraft;
    } else if (selType === "text") {
      item = meta.overlays.find((o) => o.id === selId);
    } else {
      item = meta.stickers.find((s) => s.id === selId);
    }
    if (!item) return false;
    dragRef.current = {
      id: selId,
      type: selType,
      mode: "pinch",
      startX: pts[0].x,
      startY: pts[0].y,
      origX: item.x,
      origY: item.y,
      origScale: item.scale,
      origRot: item.rotation ?? 0,
      pinchStartDist: dist,
      moved: true,
    };
    setIsDragging(true);
    return true;
  };

  const startDrag = (
    e: React.PointerEvent,
    id: string,
    type: "text" | "sticker",
    mode: "move" | "scale" | "rotate",
    item: TextOverlay | StickerOverlay,
  ) => {
    if (!editable) return;
    e.stopPropagation();
    onSelect?.({ id, type });
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (tryStartPinch(id, type)) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    dragRef.current = {
      id,
      type,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: item.x,
      origY: item.y,
      origScale: item.scale,
      origRot: item.rotation ?? 0,
      moved: false,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (drawing) {
      e.preventDefault();
      const p = pctFromEvent(e.clientX, e.clientY);
      if (eraserMode) {
        onEraseAt?.(p.x, p.y);
      } else {
        drawRef.current = newStroke(drawColor, drawWidth, drawHighlighter);
        drawRef.current.points.push(p);
      }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (textEditing && liveTextDraft && activePointers.current.size >= 2) {
      if (tryStartPinch("live", "live")) return;
    }
    if (activePointers.current.size === 2 && selected) {
      if (tryStartPinch(selected.id, selected.type)) return;
    }
    if (!dragRef.current && editable && !textEditing) onSelect?.(null);
  };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (drawing && drawRef.current && !eraserMode) {
        const p = pctFromEvent(e.clientX, e.clientY);
        const pts = drawRef.current.points;
        if (pts.length === 0 || Math.hypot(p.x - pts[pts.length - 1].x, p.y - pts[pts.length - 1].y) > 0.25) {
          drawRef.current.points.push(p);
          setLiveStroke({ ...drawRef.current, points: [...drawRef.current.points] });
        }
        return;
      }
      if (drawing && eraserMode) {
        const p = pctFromEvent(e.clientX, e.clientY);
        onEraseAt?.(p.x, p.y);
        return;
      }

      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const d = dragRef.current;
      if (!d || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (d.mode === "pinch" && activePointers.current.size >= 2 && d.pinchStartDist) {
        const pts = [...activePointers.current.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const scale = Math.max(0.3, Math.min(4, d.origScale * (dist / d.pinchStartDist)));
        if (d.type === "live") onLiveTextMove?.({ scale });
        else if (d.type === "text") onUpdateText?.(d.id, { scale });
        else onUpdateSticker?.(d.id, { scale });
        return;
      }

      const dx = ((e.clientX - d.startX) / rect.width) * 100;
      const dy = ((e.clientY - d.startY) / rect.height) * 100;

      if (d.mode === "move") {
        const nx = Math.max(2, Math.min(98, d.origX + dx));
        const ny = Math.max(2, Math.min(98, d.origY + dy));
        if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) d.moved = true;
        if (d.type === "live") onLiveTextMove?.({ x: nx, y: ny });
        else if (d.type === "text") onUpdateText?.(d.id, { x: nx, y: ny });
        else onUpdateSticker?.(d.id, { x: nx, y: ny });
        setTrashHover(!textEditing && d.type !== "live" && ny > 85);
      } else if (d.mode === "scale") {
        const delta = (e.clientX - d.startX) / 80;
        const scale = Math.max(0.3, Math.min(4, d.origScale + delta));
        if (d.type === "text") onUpdateText?.(d.id, { scale });
        else onUpdateSticker?.(d.id, { scale });
      } else if (d.mode === "rotate") {
        const cx = rect.left + (d.origX / 100) * rect.width;
        const cy = rect.top + (d.origY / 100) * rect.height;
        const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
        const start = Math.atan2(d.startY - cy, d.startX - cx);
        const deg = d.origRot + ((angle - start) * 180) / Math.PI;
        if (d.type === "text") onUpdateText?.(d.id, { rotation: deg });
        else onUpdateSticker?.(d.id, { rotation: deg });
      }
    },
    [drawing, eraserMode, onEraseAt, onUpdateText, onUpdateSticker, onLiveTextMove],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      activePointers.current.delete(e.pointerId);

      if (drawing && drawRef.current && onAddStroke && drawRef.current.points.length > 1 && !eraserMode) {
        onAddStroke({ ...drawRef.current, points: [...drawRef.current.points] });
      }
      drawRef.current = null;
      setLiveStroke(null);
      if (drawing) return;

      if (trashHover && dragRef.current && onDeleteSelected) {
        onDeleteSelected();
        onSelect?.(null);
      } else if (
        dragRef.current?.mode === "move" &&
        dragRef.current.type === "text" &&
        !dragRef.current.moved &&
        onTextTap
      ) {
        onTextTap(dragRef.current.id);
      }
      dragRef.current = null;
      setTrashHover(false);
      setIsDragging(false);
    },
    [drawing, eraserMode, trashHover, onDeleteSelected, onSelect, onAddStroke, onTextTap],
  );

  const renderHandles = (id: string, type: SelType, item: TextOverlay | StickerOverlay) => {
    if (!editable || selected?.id !== id || type === "text") return null;
    return (
      <>
        <button
          type="button"
          className="absolute -top-12 left-1/2 -translate-x-1/2 w-11 h-11 rounded-full bg-white border-2 border-violet-500 z-30 editor-touch-none shadow-lg flex items-center justify-center"
          onPointerDown={(e) => startDrag(e, id, type!, "rotate", item)}
          aria-label="Rotate"
        >
          <span className="text-sm font-bold text-violet-600">↻</span>
        </button>
        <button
          type="button"
          className="absolute -bottom-5 -right-5 w-11 h-11 rounded-full bg-white border-2 border-violet-500 z-30 editor-touch-none shadow-lg flex items-center justify-center"
          onPointerDown={(e) => startDrag(e, id, type!, "scale", item)}
          aria-label="Resize"
        >
          <span className="text-sm font-bold text-violet-600">⤢</span>
        </button>
      </>
    );
  };

  const allDrawings = (meta.drawings || []).concat(liveStroke ? [liveStroke] : []);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-10 overflow-hidden editor-touch-none ${drawing || editable ? "touch-none" : ""} ${className}`}
      style={{ cursor: drawing ? (eraserMode ? "cell" : "crosshair") : undefined }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerDown={onPointerDown}
    >
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        {allDrawings.map((stroke, i) =>
          stroke.points.length > 1 ? (
            <path
              key={i}
              d={strokeToSmoothPath(stroke.points)}
              fill="none"
              stroke={stroke.color}
              strokeWidth={stroke.width / 16}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={stroke.highlighter ? 0.45 : 1}
            />
          ) : null,
        )}
      </svg>

      {meta.stickers.map((s) => {
        const src = getStickerSrc(s.stickerId || s.emojiId || "");
        if (!src) return null;
        const isSel = selected?.id === s.id;
        return (
          <div
            key={s.id}
            className={`absolute editor-touch-none ${editable ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              transform: `translate(-50%, -50%) scale(${s.scale}) rotate(${s.rotation ?? 0}deg)`,
              zIndex: isSel ? 30 : 20,
              padding: isSel ? "12px" : "8px",
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              startDrag(e, s.id, "sticker", "move", s);
            }}
          >
            <img
              src={src}
              alt=""
              className={`w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] pointer-events-none ${isSel ? "ring-2 ring-white rounded-xl" : ""}`}
              draggable={false}
            />
            {renderHandles(s.id, "sticker", s)}
          </div>
        );
      })}

      {meta.overlays.map((o) => {
        if (hiddenOverlayId === o.id) return null;
        const isSel = selected?.id === o.id;
        return (
          <div
            key={o.id}
            className={`absolute editor-touch-none select-none max-w-[90%] ${
              editable && !textEditing ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"
            }`}
            style={{
              left: `${o.x}%`,
              top: `${o.y}%`,
              transform: `translate(-50%, -50%) rotate(${o.rotation ?? 0}deg)`,
              zIndex: isSel ? 35 : 25,
              padding: "8px",
            }}
            onPointerDown={(e) => {
              if (textEditing) return;
              e.stopPropagation();
              startDrag(e, o.id, "text", "move", o);
            }}
          >
            {renderTextBlock(o.text, o.style, o.color || "#ffffff", o.scale, false)}
            {renderHandles(o.id, "text", o)}
          </div>
        );
      })}

      {liveTextDraft && (
        <div
          className="absolute editor-touch-none select-none max-w-[90%] cursor-grab active:cursor-grabbing"
          style={{
            left: `${liveTextDraft.x}%`,
            top: `${liveTextDraft.y}%`,
            transform: `translate(-50%, -50%)`,
            zIndex: 40,
            padding: "8px",
          }}
          onPointerDown={(e) => {
            if (!editable || !onLiveTextMove) return;
            e.stopPropagation();
            activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (tryStartPinch("live", "live")) {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              return;
            }
            dragRef.current = {
              id: "live",
              type: "live",
              mode: "move",
              startX: e.clientX,
              startY: e.clientY,
              origX: liveTextDraft.x,
              origY: liveTextDraft.y,
              origScale: liveTextDraft.scale,
              origRot: 0,
              moved: false,
            };
            setIsDragging(true);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerUp={(e) => {
            if (dragRef.current?.type === "live" && !dragRef.current.moved) {
              onLiveTextFocus?.();
            }
          }}
        >
          {renderTextBlock(
            liveTextDraft.text || liveTextPlaceholder,
            liveTextDraft.style,
            liveTextDraft.color,
            liveTextDraft.scale,
            false,
            liveTextDraft.text ? "" : "opacity-70",
          )}
        </div>
      )}

      {editable && isDragging && selected && !textEditing && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 z-50 w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            trashHover ? "bg-red-500 scale-110" : "bg-black/40 border border-red-400/60"
          }`}
          style={{ bottom: "max(env(safe-area-inset-bottom), 5.5rem)" }}
        >
          <Trash2 className={`w-5 h-5 ${trashHover ? "text-white" : "text-red-300"}`} />
        </div>
      )}
    </div>
  );
}

export { defaultEditorMeta } from "@/lib/post-editor";
