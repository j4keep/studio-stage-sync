import { useRef, useState, useCallback } from "react";
import type { PostEditorMeta, TextOverlay, StickerOverlay, DrawStroke } from "@/lib/post-editor";
import { strokeToSmoothPath, eraseStrokesNear, normalizeTextStyle } from "@/lib/post-editor";
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
  drawing?: boolean;
  eraserMode?: boolean;
  drawColor?: string;
  drawWidth?: number;
  drawHighlighter?: boolean;
  onAddStroke?: (stroke: DrawStroke) => void;
  onEraseAt?: (x: number, y: number) => void;
  /** Live text draft shown on media while typing (TikTok style) */
  liveTextDraft?: { text: string; style: TextOverlay["style"]; color: string; x: number; y: number; scale: number } | null;
  onLiveTextMove?: (patch: { x?: number; y?: number; scale?: number }) => void;
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
  drawing = false,
  eraserMode = false,
  drawColor = "#ffffff",
  drawWidth = 6,
  drawHighlighter = false,
  onAddStroke,
  onEraseAt,
  liveTextDraft,
  onLiveTextMove,
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
  } | null>(null);
  const drawRef = useRef<DrawStroke | null>(null);
  const [liveStroke, setLiveStroke] = useState<DrawStroke | null>(null);
  const [trashHover, setTrashHover] = useState(false);
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());

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
        className={`inline-block text-center whitespace-pre-wrap break-words max-w-[90vw] ${preset?.className ?? ""} ${extraClass} ${isSel ? "ring-2 ring-violet-400 rounded px-1" : ""}`}
        style={{
          ...inline,
          fontSize: `${Math.round(22 * scale)}px`,
          ...(isRounded
            ? { backgroundColor: "rgba(0,0,0,0.55)", padding: "6px 14px", borderRadius: "12px" }
            : {}),
        }}
      >
        {text || "Text"}
      </span>
    );
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
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (drawing) {
      e.preventDefault();
      const p = pctFromEvent(e.clientX, e.clientY);
      if (eraserMode) {
        onEraseAt?.(p.x, p.y);
        return;
      }
      drawRef.current = newStroke(drawColor, drawWidth, drawHighlighter);
      drawRef.current.points.push(p);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.current.size === 2 && selected) {
      const pts = [...activePointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const item =
        selected.type === "text"
          ? meta.overlays.find((o) => o.id === selected.id)
          : meta.stickers.find((s) => s.id === selected.id);
      if (item) {
        dragRef.current = {
          id: selected.id,
          type: selected.type,
          mode: "pinch",
          startX: e.clientX,
          startY: e.clientY,
          origX: item.x,
          origY: item.y,
          origScale: item.scale,
          origRot: item.rotation ?? 0,
          pinchStartDist: dist,
        };
      }
    } else if (!dragRef.current) {
      editable && onSelect?.(null);
    }
  };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (drawing && drawRef.current && !eraserMode) {
        const p = pctFromEvent(e.clientX, e.clientY);
        const pts = drawRef.current.points;
        if (pts.length === 0 || Math.hypot(p.x - pts[pts.length - 1].x, p.y - pts[pts.length - 1].y) > 0.3) {
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
        if (d.type === "text") onUpdateText?.(d.id, { scale });
        else onUpdateSticker?.(d.id, { scale });
        return;
      }

      const dx = ((e.clientX - d.startX) / rect.width) * 100;
      const dy = ((e.clientY - d.startY) / rect.height) * 100;

      if (d.mode === "move") {
        const nx = Math.max(2, Math.min(98, d.origX + dx));
        const ny = Math.max(2, Math.min(98, d.origY + dy));
        if (d.type === "live") onLiveTextMove?.({ x: nx, y: ny });
        else if (d.type === "text") onUpdateText?.(d.id, { x: nx, y: ny });
        else onUpdateSticker?.(d.id, { x: nx, y: ny });
        setTrashHover(d.type !== "live" && ny > 88);
      } else if (d.mode === "scale") {
        const delta = (e.clientX - d.startX) / 100;
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
    [drawing, eraserMode, drawHighlighter, onEraseAt, onUpdateText, onUpdateSticker, onLiveTextMove],
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
      }
      dragRef.current = null;
      setTrashHover(false);
    },
    [drawing, eraserMode, trashHover, onDeleteSelected, onSelect, onAddStroke],
  );

  const renderHandles = (id: string, type: SelType, item: TextOverlay | StickerOverlay) => {
    if (!editable || selected?.id !== id) return null;
    return (
      <>
        <button
          type="button"
          className="absolute -top-8 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white border-2 border-violet-500 z-30 touch-none shadow-lg"
          onPointerDown={(e) => startDrag(e, id, type!, "rotate", item)}
          aria-label="Rotate"
        />
        <button
          type="button"
          className="absolute -bottom-3 -right-3 w-7 h-7 rounded-full bg-white border-2 border-violet-500 z-30 touch-none shadow-lg"
          onPointerDown={(e) => startDrag(e, id, type!, "scale", item)}
          aria-label="Resize"
        />
      </>
    );
  };

  const allDrawings = (meta.drawings || []).concat(liveStroke ? [liveStroke] : []);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-10 overflow-hidden ${drawing ? "touch-none" : ""} ${className}`}
      style={{ cursor: drawing ? (eraserMode ? "cell" : "crosshair") : undefined }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
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
              strokeWidth={stroke.width / 18}
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
            className={`absolute touch-none ${editable ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              transform: `translate(-50%, -50%) scale(${s.scale}) rotate(${s.rotation ?? 0}deg)`,
              zIndex: isSel ? 30 : 20,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              startDrag(e, s.id, "sticker", "move", s);
            }}
          >
            <img
              src={src}
              alt=""
              className={`w-[4.5rem] h-[4.5rem] object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] ${isSel ? "ring-2 ring-violet-400 rounded-xl" : ""}`}
              draggable={false}
            />
            {renderHandles(s.id, "sticker", s)}
          </div>
        );
      })}

      {meta.overlays.map((o) => {
        const isSel = selected?.id === o.id;
        return (
          <div
            key={o.id}
            className={`absolute touch-none select-none max-w-[88%] ${editable ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}
            style={{
              left: `${o.x}%`,
              top: `${o.y}%`,
              transform: `translate(-50%, -50%) scale(${o.scale}) rotate(${o.rotation ?? 0}deg)`,
              zIndex: isSel ? 35 : 25,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              startDrag(e, o.id, "text", "move", o);
            }}
          >
            {renderTextBlock(o.text, o.style, o.color || "#ffffff", 1, isSel)}
            {renderHandles(o.id, "text", o)}
          </div>
        );
      })}

      {liveTextDraft && (
        <div
          className="absolute touch-none select-none max-w-[88%] cursor-grab active:cursor-grabbing"
          style={{
            left: `${liveTextDraft.x}%`,
            top: `${liveTextDraft.y}%`,
            transform: `translate(-50%, -50%) scale(${liveTextDraft.scale})`,
            zIndex: 40,
          }}
          onPointerDown={(e) => {
            if (!editable || !onLiveTextMove) return;
            e.stopPropagation();
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
            };
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
        >
          {renderTextBlock(
            liveTextDraft.text || "Tap to type",
            liveTextDraft.style,
            liveTextDraft.color,
            1,
            true,
            liveTextDraft.text ? "" : "opacity-60",
          )}
        </div>
      )}

      {editable && trashHover && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-red-500 text-white text-xs font-bold shadow-lg">
          Release to delete
        </div>
      )}
    </div>
  );
}

export { defaultEditorMeta } from "@/lib/post-editor";
