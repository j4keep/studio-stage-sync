import { useCallback, useEffect, useRef, useState } from "react";
import { FlipHorizontal2, RotateCcw, Scan } from "lucide-react";
import {
  applyImageCrop,
  clampCropRect,
  cropRectForAspect,
  CROP_ASPECT_PRESETS,
  fullCropRect,
  imageFitRect,
  type CropAspectKey,
  type CropRectPct,
} from "@/lib/apply-image-crop";

type Handle = "move" | "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

interface Props {
  imageUrl: string;
  onCancel: () => void;
  onSave: (file: File, previewUrl: string) => void;
}

function aspectForKey(key: CropAspectKey, imageAspect: number): number | null {
  if (key === "free") return null;
  if (key === "original") return imageAspect;
  const preset = CROP_ASPECT_PRESETS.find((p) => p.key === key);
  return preset?.ratio ?? null;
}

function resizeWithHandle(
  orig: CropRectPct,
  handle: Handle,
  dx: number,
  dy: number,
  lockAspect: number | null,
): CropRectPct {
  let { left, top, width, height } = orig;

  if (handle === "move") {
    return clampCropRect({ left: left + dx, top: top + dy, width, height });
  }

  if (handle.includes("e")) width += dx;
  if (handle.includes("w")) {
    width -= dx;
    left += dx;
  }
  if (handle.includes("s")) height += dy;
  if (handle.includes("n")) {
    height -= dy;
    top += dy;
  }

  if (lockAspect && width > 0 && height > 0) {
    const current = width / height;
    if (Math.abs(current - lockAspect) > 0.001) {
      if (handle === "n" || handle === "s") {
        width = height * lockAspect;
      } else if (handle === "e" || handle === "w") {
        height = width / lockAspect;
      } else {
        if (Math.abs(dx) > Math.abs(dy)) height = width / lockAspect;
        else width = height * lockAspect;
      }
      if (handle.includes("w")) left = orig.left + orig.width - width;
      if (handle.includes("n")) top = orig.top + orig.height - height;
    }
  }

  return clampCropRect({ left, top, width, height });
}

function AspectIcon({ ratio, active }: { ratio: number | null; active: boolean }) {
  const w = 22;
  const h = ratio ? w / ratio : 18;
  const maxH = 22;
  const scale = h > maxH ? maxH / h : 1;
  const bw = w * scale;
  const bh = (ratio ? h : 18) * scale;
  return (
    <div
      className={`rounded-sm border-2 ${active ? "border-white" : "border-white/70"} ${ratio === null ? "border-dashed" : ""}`}
      style={{ width: bw, height: ratio === null ? 16 : bh }}
    />
  );
}

export default function CropEditorView({ imageUrl, onCancel, onSave }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [aspectKey, setAspectKey] = useState<CropAspectKey>("original");
  const [crop, setCrop] = useState<CropRectPct>(fullCropRect());
  const [fit, setFit] = useState({ left: 0, top: 0, width: 0, height: 0, effW: 0, effH: 0 });
  const [saving, setSaving] = useState(false);

  const dragRef = useRef<{
    handle: Handle;
    startX: number;
    startY: number;
    orig: CropRectPct;
  } | null>(null);

  const imageAspect = fit.effH > 0 ? fit.effW / fit.effH : 1;
  const lockAspect = aspectForKey(aspectKey, imageAspect);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el || !natural.w) return;
    const rect = el.getBoundingClientRect();
    const nextFit = imageFitRect(rect.width, rect.height, natural.w, natural.h, rotation);
    setFit(nextFit);
  }, [natural.w, natural.h, rotation]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = imageUrl;
  }, [imageUrl]);

  const applyAspect = (key: CropAspectKey) => {
    setAspectKey(key);
    const aspect = aspectForKey(key, imageAspect);
    if (aspect === null) return;
    setCrop(cropRectForAspect(aspect, imageAspect));
  };

  const resetAll = () => {
    setRotation(0);
    setFlipH(false);
    setAspectKey("original");
    setCrop(fullCropRect());
  };

  const rotateLeft = () => {
    setRotation((r) => (r + 270) % 360);
    setCrop(fullCropRect());
    setAspectKey("original");
  };

  const startHandle = (e: React.PointerEvent, handle: Handle) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { handle, startX: e.clientX, startY: e.clientY, orig: crop };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !fit.width) return;
    const dx = ((e.clientX - d.startX) / fit.width) * 100;
    const dy = ((e.clientY - d.startY) / fit.height) * 100;
    setCrop(resizeWithHandle(d.orig, d.handle, dx, dy, lockAspect));
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const blob = await applyImageCrop(imageUrl, crop, rotation, flipH);
      const file = new File([blob], `crop-${Date.now()}.jpg`, { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);
      onSave(file, url);
    } catch {
      setSaving(false);
    }
  };

  const cropPx = {
    left: fit.left + (crop.left / 100) * fit.width,
    top: fit.top + (crop.top / 100) * fit.height,
    width: (crop.width / 100) * fit.width,
    height: (crop.height / 100) * fit.height,
  };

  const rot = ((rotation % 360) + 360) % 360;
  const imgW = rot === 90 || rot === 270 ? fit.height : fit.width;
  const imgH = rot === 90 || rot === 270 ? fit.width : fit.height;
  const imgLeft = fit.left + fit.width / 2 - imgW / 2;
  const imgTop = fit.top + fit.height / 2 - imgH / 2;
  const imgTransform = [flipH ? "scaleX(-1)" : "", rot ? `rotate(${rot}deg)` : ""].filter(Boolean).join(" ");

  const handleHit = "absolute z-20 editor-touch-none touch-none";
  const cornerLen = 22;
  const edgeLen = 28;

  return (
    <div className="absolute inset-0 z-[100] flex flex-col bg-black">
      {/* Top tools — reset, flip, rotate */}
      <div
        className="shrink-0 flex items-center justify-between px-4 pb-2 editor-touch-none"
        style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}
      >
        <button
          type="button"
          onClick={resetAll}
          className="w-11 h-11 flex items-center justify-center text-white/90"
          aria-label="Reset crop"
        >
          <Scan className="w-6 h-6" strokeWidth={1.75} />
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFlipH((f) => !f)}
            className={`w-11 h-11 flex items-center justify-center rounded-lg ${flipH ? "bg-white/15" : ""}`}
            aria-label="Flip horizontal"
          >
            <FlipHorizontal2 className="w-6 h-6 text-white" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={rotateLeft}
            className="w-11 h-11 flex items-center justify-center text-white"
            aria-label="Rotate left"
          >
            <RotateCcw className="w-6 h-6" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Crop viewport */}
      <div ref={containerRef} className="relative flex-1 min-h-0 overflow-hidden">
        <img
          src={imageUrl}
          alt=""
          className="absolute pointer-events-none select-none"
          style={{
            left: imgLeft,
            top: imgTop,
            width: imgW,
            height: imgH,
            transform: imgTransform || undefined,
            transformOrigin: "center center",
          }}
          draggable={false}
        />

        {/* Dimmed mask */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-x-0 top-0 bg-black/55" style={{ height: cropPx.top }} />
          <div
            className="absolute inset-x-0 bg-black/55"
            style={{ top: cropPx.top + cropPx.height, bottom: 0 }}
          />
          <div
            className="absolute bg-black/55"
            style={{ top: cropPx.top, left: 0, width: cropPx.left, height: cropPx.height }}
          />
          <div
            className="absolute bg-black/55"
            style={{
              top: cropPx.top,
              left: cropPx.left + cropPx.width,
              right: 0,
              height: cropPx.height,
            }}
          />
        </div>

        {/* Crop frame + handles */}
        <div
          className="absolute z-10 editor-touch-none touch-none"
          style={{
            left: cropPx.left,
            top: cropPx.top,
            width: cropPx.width,
            height: cropPx.height,
          }}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* Move area */}
          <div
            className="absolute inset-0 cursor-move"
            onPointerDown={(e) => startHandle(e, "move")}
          />

          {/* Border */}
          <div className="absolute inset-0 border border-white/90 pointer-events-none" />

          {/* Corner L-brackets */}
          {(
            [
              ["nw", "left-0 top-0 cursor-nwse-resize"],
              ["ne", "right-0 top-0 cursor-nesw-resize"],
              ["sw", "left-0 bottom-0 cursor-nesw-resize"],
              ["se", "right-0 bottom-0 cursor-nwse-resize"],
            ] as const
          ).map(([h, pos]) => (
            <div
              key={h}
              className={`${handleHit} ${pos}`}
              style={{ width: cornerLen + 8, height: cornerLen + 8 }}
              onPointerDown={(e) => startHandle(e, h)}
            >
              <div
                className="absolute bg-white"
                style={{
                  width: cornerLen,
                  height: 3,
                  ...(h.includes("n") ? { top: 0 } : { bottom: 0 }),
                  ...(h.includes("w") ? { left: 0 } : { right: 0 }),
                }}
              />
              <div
                className="absolute bg-white"
                style={{
                  width: 3,
                  height: cornerLen,
                  ...(h.includes("n") ? { top: 0 } : { bottom: 0 }),
                  ...(h.includes("w") ? { left: 0 } : { right: 0 }),
                }}
              />
            </div>
          ))}

          {/* Edge handles */}
          {(
            [
              ["n", "top-0 left-1/2 -translate-x-1/2 cursor-ns-resize"],
              ["s", "bottom-0 left-1/2 -translate-x-1/2 cursor-ns-resize"],
              ["w", "left-0 top-1/2 -translate-y-1/2 cursor-ew-resize"],
              ["e", "right-0 top-1/2 -translate-y-1/2 cursor-ew-resize"],
            ] as const
          ).map(([h, pos]) => (
            <div
              key={h}
              className={`${handleHit} ${pos}`}
              style={{
                width: h === "n" || h === "s" ? edgeLen + 16 : 14,
                height: h === "w" || h === "e" ? edgeLen + 16 : 14,
              }}
              onPointerDown={(e) => startHandle(e, h)}
            >
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full"
                style={{
                  width: h === "n" || h === "s" ? edgeLen : 3,
                  height: h === "w" || h === "e" ? edgeLen : 3,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Aspect ratio presets */}
      <div
        className="shrink-0 flex gap-5 overflow-x-auto scrollbar-hide px-5 py-4 editor-touch-none"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.25rem)" }}
      >
        {CROP_ASPECT_PRESETS.map((p) => {
          const active = aspectKey === p.key;
          const ratio = p.key === "original" ? imageAspect : p.ratio;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => applyAspect(p.key)}
              className="flex flex-col items-center gap-2 shrink-0 min-w-[3.25rem]"
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${active ? "bg-white/20" : ""}`}
              >
                <AspectIcon ratio={p.key === "free" ? null : ratio} active={active} />
              </div>
              <span className={`text-[11px] font-medium ${active ? "text-white" : "text-white/55"}`}>
                {p.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Cancel / Save */}
      <div
        className="shrink-0 flex items-center justify-between px-6 pb-4 editor-touch-none"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
      >
        <button type="button" onClick={onCancel} className="text-white/80 text-base font-medium px-2 py-2">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-white text-base font-bold px-2 py-2 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
