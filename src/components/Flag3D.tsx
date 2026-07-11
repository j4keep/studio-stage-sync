import { useMemo } from "react";
import type { FlagTheme } from "@/lib/flag-themes";
import { flagBackgroundCss, getFlagImageUrl } from "@/lib/flag-themes";

type Flag3DVariant = "thumb" | "background";

interface Props {
  flag: FlagTheme;
  variant?: Flag3DVariant;
  className?: string;
}

/** Fabric-style 3D flag — real image for countries, waved stripes for identity flags. */
export default function Flag3D({ flag, variant = "thumb", className = "" }: Props) {
  const imageUrl = useMemo(() => getFlagImageUrl(flag), [flag]);
  const stripeBg = useMemo(() => flagBackgroundCss(flag), [flag]);
  const showPole = variant === "thumb";

  return (
    <div
      className={`flag-3d flag-3d--${variant} ${className}`.trim()}
      aria-hidden
    >
      {showPole && <div className="flag-3d__pole" />}
      <div className="flag-3d__scene">
        <div className="flag-3d__fabric">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="flag-3d__image" loading="lazy" decoding="async" />
          ) : (
            <div className="flag-3d__stripes" style={{ background: stripeBg }} />
          )}
          <div className="flag-3d__fold" />
          <div className="flag-3d__highlight" />
          <div className="flag-3d__shadow-edge" />
        </div>
        <div className="flag-3d__fabric flag-3d__fabric--back" aria-hidden>
          {imageUrl ? (
            <img src={imageUrl} alt="" className="flag-3d__image flag-3d__image--dim" loading="lazy" decoding="async" />
          ) : (
            <div className="flag-3d__stripes flag-3d__stripes--dim" style={{ background: stripeBg }} />
          )}
        </div>
      </div>
    </div>
  );
}
