import type { CSSProperties } from "react";
import type { TextOverlayStyle } from "./post-editor";
import { normalizeTextStyle } from "./post-editor";

export interface TextStylePreset {
  id: TextOverlayStyle;
  label: string;
  fontFamily: string;
  className: string;
  defaultColor: string;
}

/** Primary text styles shown in create editor (TikTok / WhatsApp) */
export const CREATE_TEXT_STYLES: TextStylePreset[] = [
  {
    id: "bubble",
    label: "White",
    fontFamily: "'Inter', sans-serif",
    className: "font-bold",
    defaultColor: "#ffffff",
  },
  {
    id: "outline",
    label: "Outline",
    fontFamily: "'Inter', sans-serif",
    className: "font-black",
    defaultColor: "#ffffff",
  },
  {
    id: "marker",
    label: "Yellow",
    fontFamily: "'Permanent Marker', cursive",
    className: "font-normal",
    defaultColor: "#fef08a",
  },
  {
    id: "neon",
    label: "Neon",
    fontFamily: "'Inter', sans-serif",
    className: "font-bold",
    defaultColor: "#00e5ff",
  },
  {
    id: "rounded",
    label: "Rounded",
    fontFamily: "'Inter', sans-serif",
    className: "font-semibold",
    defaultColor: "#ffffff",
  },
];

/** TikTok / Stories-style text presets */
export const TEXT_STYLE_PRESETS: TextStylePreset[] = [
  {
    id: "bubble",
    label: "Bubble",
    fontFamily: "'Fredoka', 'Arial Rounded MT Bold', sans-serif",
    className: "font-bold tracking-wide",
    defaultColor: "#ffffff",
  },
  {
    id: "neon",
    label: "Neon",
    fontFamily: "'Inter', sans-serif",
    className: "font-bold",
    defaultColor: "#00e5ff",
  },
  {
    id: "outline",
    label: "Outline",
    fontFamily: "'Inter', sans-serif",
    className: "font-black",
    defaultColor: "#ffffff",
  },
  {
    id: "comic",
    label: "Comic",
    fontFamily: "'Bangers', 'Comic Sans MS', cursive",
    className: "font-normal tracking-wide uppercase",
    defaultColor: "#fef08a",
  },
  {
    id: "typewriter",
    label: "Typewriter",
    fontFamily: "'Courier New', Courier, monospace",
    className: "font-bold",
    defaultColor: "#f8fafc",
  },
  {
    id: "marker",
    label: "Marker",
    fontFamily: "'Permanent Marker', 'Marker Felt', cursive",
    className: "font-normal",
    defaultColor: "#fef08a",
  },
  {
    id: "rounded",
    label: "Rounded",
    fontFamily: "'Inter', sans-serif",
    className: "font-semibold",
    defaultColor: "#ffffff",
  },
  {
    id: "graffiti",
    label: "Graffiti",
    fontFamily: "'Rubik Wet Paint', 'Impact', sans-serif",
    className: "font-normal uppercase",
    defaultColor: "#f472b6",
  },
  {
    id: "handwritten",
    label: "Handwritten",
    fontFamily: "'Caveat', 'Segoe Script', cursive",
    className: "font-bold",
    defaultColor: "#ffffff",
  },
  {
    id: "shadow3d",
    label: "3D",
    fontFamily: "'Inter', sans-serif",
    className: "font-black uppercase",
    defaultColor: "#ffffff",
  },
];

export const TEXT_COLORS = [
  "#ffffff",
  "#000000",
  "#ef4444",
  "#3b82f6",
  "#a855f7",
  "#39ff14",
  "#eab308",
  "#ec4899",
  "#f97316",
];

export function getTextStyleInline(style: TextOverlayStyle, color: string): CSSProperties {
  const normalized = normalizeTextStyle(style);
  const preset = TEXT_STYLE_PRESETS.find((p) => p.id === normalized);
  const base: React.CSSProperties = {
    fontFamily: preset?.fontFamily,
    color,
  };

  switch (normalized) {
    case "neon":
      return {
        ...base,
        color,
        textShadow: `0 0 8px ${color}, 0 0 16px ${color}, 0 0 24px ${color}88`,
      };
    case "outline":
      return {
        ...base,
        color,
        WebkitTextStroke: "2px #000",
        paintOrder: "stroke fill",
        textShadow: "2px 2px 0 #000, -1px -1px 0 #000",
      };
    case "bubble":
      return {
        ...base,
        color,
        fontWeight: 700,
        textShadow: "0 2px 10px rgba(0,0,0,0.75), 0 0 2px rgba(0,0,0,0.9)",
      };
    case "rounded":
      return { ...base, color };
    case "shadow3d":
      return {
        ...base,
        color,
        textShadow: "3px 3px 0 #a855f7, 6px 6px 0 #000",
      };
    case "marker":
      return {
        ...base,
        color,
        transform: "rotate(-2deg)",
      };
    case "graffiti":
      return {
        ...base,
        color,
        WebkitTextStroke: "1.5px #1a1a1a",
        textShadow: "3px 3px 0 #000",
      };
    default:
      return base;
  }
}
