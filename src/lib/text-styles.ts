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

/** WhatsApp / TikTok text presets shown in create editor */
export const CREATE_TEXT_STYLES: TextStylePreset[] = [
  {
    id: "bubble",
    label: "Plain",
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
    id: "rounded",
    label: "Bubble",
    fontFamily: "'Inter', sans-serif",
    className: "font-semibold",
    defaultColor: "#1a1a1a",
  },
  {
    id: "neon",
    label: "Neon",
    fontFamily: "'Inter', sans-serif",
    className: "font-bold",
    defaultColor: "#39ff14",
  },
  {
    id: "marker",
    label: "Yellow",
    fontFamily: "'Permanent Marker', cursive",
    className: "font-normal",
    defaultColor: "#fef08a",
  },
  {
    id: "shadow3d",
    label: "Shadow",
    fontFamily: "'Inter', sans-serif",
    className: "font-black",
    defaultColor: "#ffffff",
  },
];

/** Full preset library for rendering saved overlays */
export const TEXT_STYLE_PRESETS: TextStylePreset[] = [
  ...CREATE_TEXT_STYLES,
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
];

export const TEXT_COLORS = [
  "#ffffff",
  "#000000",
  "#fef08a",
  "#39ff14",
  "#00e5ff",
  "#ef4444",
  "#a855f7",
  "#ec4899",
  "#f97316",
  "#3b82f6",
];

export function getTextStyleInline(style: TextOverlayStyle, color: string): CSSProperties {
  const normalized = normalizeTextStyle(style);
  const preset = TEXT_STYLE_PRESETS.find((p) => p.id === normalized);
  const base: CSSProperties = {
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
        textShadow: "2px 2px 0 #000",
      };
    case "bubble":
      return {
        ...base,
        color,
        fontWeight: 700,
        textShadow: "0 2px 12px rgba(0,0,0,0.85)",
      };
    case "rounded":
      return { ...base, color };
    case "shadow3d":
      return {
        ...base,
        color,
        textShadow: "2px 2px 0 rgba(0,0,0,0.9), 4px 4px 0 rgba(0,0,0,0.5)",
      };
    case "marker":
      return {
        ...base,
        color,
        transform: "rotate(-1deg)",
      };
    default:
      return base;
  }
}
