import { useEffect, useState } from "react";
import { X } from "lucide-react";

/**
 * App-wide image viewer. Any image on the app opens full-screen (phone-size)
 * when tapped, instead of staying boxed inside its card.
 *
 * Opt out on a specific image/container with `data-no-zoom`.
 * Force-enable inside a button/link with `data-zoom`.
 */
const ImageLightbox = () => {
  const [src, setSrc] = useState<string | null>(null);
  const [alt, setAlt] = useState("");

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const img = target.closest("img") as HTMLImageElement | null;
      if (!img || !img.currentSrc && !img.src) return;
      if (img.closest("[data-no-zoom]")) return;

      const forced = !!img.closest("[data-zoom]");
      if (!forced) {
        // Don't hijack images that are part of a control (buttons, links, inputs)
        if (img.closest("button, a, [role='button'], label")) return;
      }
      // Ignore tiny decorative images (icons, badges, small avatars)
      const rect = img.getBoundingClientRect();
      if (!forced && (rect.width < 72 || rect.height < 72)) return;

      e.preventDefault();
      e.stopPropagation();
      setSrc(img.currentSrc || img.src);
      setAlt(img.alt || "Image");
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSrc(null);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [src]);

  if (!src) return null;

  return (
    <div
      data-no-zoom
      onClick={() => setSrc(null)}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-2 animate-in fade-in"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          setSrc(null);
        }}
        aria-label="Close image"
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-[100vw] object-contain"
      />
    </div>
  );
};

export default ImageLightbox;
