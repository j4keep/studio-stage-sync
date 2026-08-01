import { supabase } from "@/integrations/supabase/client";

export type FoodRating = "good" | "moderate" | "limit";
export type ShouldEat = "yes" | "in_moderation" | "better_choice";

export type FoodScanItem = {
  name: string;
  portion?: string;
  calories?: number;
};

export type FoodScanResult = {
  is_food: boolean;
  title: string;
  summary: string;
  rating: FoodRating;
  rating_label: string;
  should_eat: ShouldEat;
  should_eat_label: string;
  guidance: string;
  calories: {
    estimate: number;
    low: number;
    high: number;
    confidence: "low" | "medium" | "high";
  };
  items: FoodScanItem[];
  highlights: string[];
  watch_outs: string[];
  better_swaps: string[];
  disclaimer: string;
};

/** Resize/compress a photo to a JPEG data URL suitable for vision APIs. */
export async function foodPhotoToDataUrl(file: File, maxEdge = 1280, quality = 0.82): Promise<string> {
  const rawUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error || new Error("Could not read photo"));
    r.readAsDataURL(file);
  });

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not load photo"));
      el.src = rawUrl;
    });

    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return rawUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return rawUrl;
  }
}

export async function analyzeFoodPhoto(images: string[], notes?: string): Promise<FoodScanResult> {
  const { data, error } = await supabase.functions.invoke("yaj-food-scan", {
    body: { images, notes },
  });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) {
    throw new Error((data as { error: string }).error);
  }
  const result = (data as { result: FoodScanResult }).result;
  if (!result) throw new Error("No scan result returned");
  return normalizeResult(result);
}

function normalizeResult(raw: Partial<FoodScanResult>): FoodScanResult {
  const rating = (raw.rating === "good" || raw.rating === "limit" ? raw.rating : "moderate") as FoodRating;
  const should =
    raw.should_eat === "yes" || raw.should_eat === "better_choice"
      ? raw.should_eat
      : "in_moderation";
  const estimate = Number(raw.calories?.estimate) || 0;
  const low = Number(raw.calories?.low) || Math.max(0, Math.round(estimate * 0.8));
  const high = Number(raw.calories?.high) || Math.round(estimate * 1.2 || 0);

  return {
    is_food: raw.is_food !== false,
    title: raw.title || "Food scan",
    summary: raw.summary || "",
    rating,
    rating_label:
      raw.rating_label ||
      (rating === "good"
        ? "Good choice"
        : rating === "limit"
          ? "Limit / occasional"
          : "Okay in moderation"),
    should_eat: should,
    should_eat_label:
      raw.should_eat_label ||
      (should === "yes"
        ? "Yes — enjoy it"
        : should === "better_choice"
          ? "Consider a better choice"
          : "Yes — in moderation"),
    guidance: raw.guidance || "",
    calories: {
      estimate,
      low,
      high,
      confidence:
        raw.calories?.confidence === "high" || raw.calories?.confidence === "low"
          ? raw.calories.confidence
          : "medium",
    },
    items: Array.isArray(raw.items) ? raw.items : [],
    highlights: Array.isArray(raw.highlights) ? raw.highlights : [],
    watch_outs: Array.isArray(raw.watch_outs) ? raw.watch_outs : [],
    better_swaps: Array.isArray(raw.better_swaps) ? raw.better_swaps : [],
    disclaimer:
      raw.disclaimer ||
      "Ballpark estimate only — not medical or dietitian advice.",
  };
}

export function ratingTone(rating: FoodRating): {
  bg: string;
  text: string;
  ring: string;
  emoji: string;
} {
  if (rating === "good") {
    return {
      bg: "from-emerald-700 to-teal-900",
      text: "text-emerald-50",
      ring: "ring-emerald-300/40",
      emoji: "🥗",
    };
  }
  if (rating === "limit") {
    return {
      bg: "from-amber-800 to-stone-900",
      text: "text-amber-50",
      ring: "ring-amber-300/40",
      emoji: "⚠️",
    };
  }
  return {
    bg: "from-sky-800 to-slate-900",
    text: "text-sky-50",
    ring: "ring-sky-300/40",
    emoji: "⚖️",
  };
}
