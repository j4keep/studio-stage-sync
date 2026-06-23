import { useRef, useState, useCallback, useEffect } from "react";
import type { PostEditorMeta, TextOverlay, StickerOverlay, DrawStroke } from "@/lib/post-editor";
import { TEXT_STYLE_CLASSES } from "@/lib/post-editor";
import { getStickerSrc } from "@/lib/sticker-library";

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
  drawColor?: string;
  drawWidth?: number;
  onAddStroke?: (stroke: DrawStroke) => void;
  className?: string;
}

const newStroke = (color: string, width: number): DrawStroke => ({ points: [], color, width });

export default function PostOverlayRenderer({
  meta,
  editable = false,
  selected,
  onSelect,
  onUpdateText,
  onUpdateSticker,
  onDeleteSelected,
  drawing = false,
  drawColor = "#ffffff",
  drawWidth = 4,
  onAddStroke,
  className = "",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    type: "text" | "sticker";
    mode: "move" | "scale" | "rotate";
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origScale: number;
    origRot: number;
  } | null>(null);
  const drawRef = useRef<DrawStroke | null>(null);
  const [liveStroke, setLiveStroke] = useState<DrawStroke | null>(null);
  const [trashHover, setTrashHover] = useState(false);

  const pctFromEvent = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    };
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

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (drawing && drawRef.current) {
        const p = pctFromEvent(e.clientX, e.clientY);
        drawRef.current.points.push(p);
        setLiveStroke({ ...drawRef.current, points: [...drawRef.current.points] });
        return;
      }
      const d = dragRef.current;
      if (!d || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = ((e.clientX - d.startX) / rect.width) * 100;
      const dy = ((e.clientY - d.startY) / rect.height) * 100;

      if (d.mode === "move") {
        const nx = Math.max(2, Math.min(98, d.origX + dx));
        const ny = Math.max(2, Math.min(98, d.origY + dy));
        if (d.type === "text") onUpdateText?.(d.id, { x: nx, y: ny });
        else onUpdateSticker?.(d.id, { x: nx, y: ny });
        if (ny > 88) setTrashHover(true);
        else setTrashHover(false);
      } else if (d.mode === "scale") {
        const delta = (e.clientX - d.startX) / 120;
        const scale = Math.max(0.4, Math.min(3, d.origScale + delta));
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
    [drawing, onAddStroke, onUpdateText, onUpdateSticker],
  );

  const onPointerUp = useCallback(() => {
    if (drawing && drawRef.current && onAddStroke && drawRef.current.points.length > 1) {
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
  }, [drawing, trashHover, onDeleteSelected, onSelect, onAddStroke]);

  const onDrawStart = (e: React.PointerEvent) => {
    if (!drawing || !onAddStroke) return;
    e.preventDefault();
    const p = pctFromEvent(e.clientX, e.clientY);
    drawRef.current = newStroke(drawColor, drawWidth);
    drawRef.current.points.push(p);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const renderHandles = (id: string, type: SelType, item: TextOverlay | StickerOverlay) => {
    if (!editable || selected?.id !== id) return null;
    return (
      <>
        <button
          type="button"
          className="absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border-2 border-primary z-30 touch-none"
          onPointerDown={(e) => startDrag(e, id, type!, "rotate", item)}
          aria-label="Rotate"
        />
        <button
          type="button"
          className="absolute -bottom-3 -right-3 w-6 h-6 rounded-full bg-white border-2 border-primary z-30 touch-none"
          onPointerDown={(e) => startDrag(e, id, type!, "scale", item)}
          aria-label="Resize"
        />
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-10 overflow-hidden ${drawing ? "touch-none cursor-crosshair" : ""} ${className}`}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onPointerDown={drawing ? onDrawStart : () => editable && onSelect?.(null)}
    >
      {/* Drawing SVG */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        {(meta.drawings || []).concat(liveStroke ? [liveStroke] : []).map((stroke, i) =>
          stroke.points.length > 1 ? (
            <polyline
              key={i}
              fill="none"
              stroke={stroke.color}
              strokeWidth={stroke.width / 25}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={stroke.points.map((p) => `${p.x},${p.y}`).join(" ")}
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
            }}
            onPointerDown={(e) => startDrag(e, s.id, "sticker", "move", s)}
            onClick={(e) => {
              e.stopPropagation();
              if (editable) onSelect?.({ id: s.id, type: "sticker" });
            }}
          >
            <img
              src={src}
              alt=""
              className={`w-16 h-16 object-contain drop-shadow-lg ${isSel ? "ring-2 ring-primary rounded-lg" : ""}`}
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
            className={`absolute touch-none select-none max-w-[85%] text-center ${TEXT_STYLE_CLASSES[o.style]} ${editable ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}
            style={{
              left: `${o.x}%`,
              top: `${o.y}%`,
              transform: `translate(-50%, -50%) scale(${o.scale}) rotate(${o.rotation ?? 0}deg)`,
              fontSize: `${Math.round(18 * o.scale)}px`,
              color: o.color && o.style === "white" ? o.color : undefined,
            }}
            onPointerDown={(e) => startDrag(e, o.id, "text", "move", o)}
            onClick={(e) => {
              e.stopPropagation();
              if (editable) onSelect?.({ id: o.id, type: "text" });
            }}
          >
            <span className={isSel ? "ring-2 ring-primary rounded px-1" : ""}>{o.text || "Text"}</span>
            {renderHandles(o.id, "text", o)}
          </div>
        );
      })}

      {editable && trashHover && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-red-500/90 text-white text-xs font-bold">
          Release to delete
        </div>
      )}
    </div>
  );
}

export { defaultEditorMeta } from "@/lib/post-editor";
