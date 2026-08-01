/**
 * YAJ Food Scan — Nourish Score product + plate analysis.
 * 1) Barcode → Open Food Facts (no edge function required)
 * 2) Fallback → Ask YAJ vision (already deployed)
 */

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-yaj`;
const OFF_UA = "YAJ-Wellness-FoodScan/1.0 (https://yaj.app; wellness@yaj.app)";

export type FoodRating = "excellent" | "good" | "moderate" | "poor" | "bad";
export type FactTone = "good" | "ok" | "poor";

export type NutrientFact = {
  id: string;
  title: string;
  subtitle: string;
  value: string;
  tone: FactTone;
  icon: "flame" | "salt" | "sugar" | "fat" | "fiber" | "protein" | "veg" | "additive" | "nova";
};

export type FoodCategoryId =
  | "nutrition_quality"
  | "calories"
  | "protein"
  | "fiber"
  | "sodium"
  | "added_sugar"
  | "healthy_fats"
  | "yaj_guidance";

export type FoodCategory = {
  id: FoodCategoryId;
  label: string;
  emoji: string;
  value: string;
  /** 0–100 when scored; null for guidance-only rows */
  score: number | null;
  tone: FactTone;
  note: string;
};

/** Shared educational disclaimer — estimate/guidance language, never “opinion”. */
export const ABOUT_FOOD_SCAN_ESTIMATE =
  "YAJ uses image recognition and nutrition databases to estimate calories, nutrients, and ingredient quality. Results are estimates only and may not perfectly match your meal. YAJ provides educational wellness guidance and is not a substitute for medical or dietary advice.";

export type FoodScanResult = {
  is_food: boolean;
  source: "open_food_facts" | "ai_vision";
  barcode?: string | null;
  title: string;
  brand?: string;
  image_url?: string | null;
  score: number;
  rating: FoodRating;
  rating_label: string;
  serving_size?: string;
  calories_serving?: number | null;
  summary: string;
  should_eat_label: string;
  guidance: string;
  categories: FoodCategory[];
  negatives: NutrientFact[];
  positives: NutrientFact[];
  recommendations: string[];
  ingredients?: string;
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
    const img = await loadHtmlImage(rawUrl);
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

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not load photo"));
    el.src = src;
  });
}

/** Browser barcode detector when available (Chrome/Android/Safari recent). */
export async function detectBarcodeFromDataUrl(dataUrl: string): Promise<string | null> {
  try {
    const BD = (window as unknown as { BarcodeDetector?: new (opts?: { formats?: string[] }) => {
      detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
    } }).BarcodeDetector;
    if (!BD) return null;
    const img = await loadHtmlImage(dataUrl);
    const detector = new BD({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39"],
    });
    const codes = await detector.detect(img);
    const raw = codes[0]?.rawValue?.replace(/\D/g, "") || "";
    return raw.length >= 8 ? raw : null;
  } catch {
    return null;
  }
}

export async function fetchOpenFoodFacts(barcode: string): Promise<FoodScanResult | null> {
  const code = barcode.replace(/\D/g, "");
  if (code.length < 8) return null;

  const fields = [
    "product_name",
    "brands",
    "image_front_small_url",
    "image_url",
    "nutriments",
    "nutrition_grades",
    "nutriscore_grade",
    "nova_group",
    "serving_size",
    "ingredients_text",
    "additives_n",
    "nutrient_levels",
  ].join(",");

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${fields}`;
  const resp = await fetch(url, { headers: { "User-Agent": OFF_UA, Accept: "application/json" } });
  if (!resp.ok) return null;
  const data = (await resp.json()) as {
    status?: number;
    product?: Record<string, unknown>;
  };
  if (data.status !== 1 || !data.product) return null;
  return buildFromOpenFoodFacts(code, data.product);
}

function n(v: unknown): number | null {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function buildFromOpenFoodFacts(barcode: string, p: Record<string, unknown>): FoodScanResult {
  const nutriments = (p.nutriments || {}) as Record<string, unknown>;
  const levels = (p.nutrient_levels || {}) as Record<string, string>;
  const grade = String(p.nutriscore_grade || p.nutrition_grades || "").toLowerCase();
  const nova = n(p.nova_group);
  const additives = n(p.additives_n) ?? 0;

  const kcalServing =
    n(nutriments["energy-kcal_serving"]) ??
    n(nutriments.energy_kcal_serving) ??
    null;
  const kcal100 = n(nutriments["energy-kcal_100g"]) ?? n(nutriments["energy-kcal"]) ?? null;
  const fatServing = n(nutriments.fat_serving);
  const satServing = n(nutriments["saturated-fat_serving"]);
  const sodiumMg =
    n(nutriments.sodium_serving) != null
      ? Math.round((n(nutriments.sodium_serving) as number) * 1000)
      : n(nutriments.salt_serving) != null
        ? Math.round((n(nutriments.salt_serving) as number) * 400)
        : null;
  const sugarsServing = n(nutriments.sugars_serving);
  const fiberServing = n(nutriments.fiber_serving);
  const proteinServing = n(nutriments.proteins_serving);
  const serving = String(p.serving_size || "per serving");

  const negatives: NutrientFact[] = [];
  const positives: NutrientFact[] = [];

  const pushLevel = (
    key: string,
    title: string,
    value: string,
    icon: NutrientFact["icon"],
    goodSub: string,
    okSub: string,
    poorSub: string,
  ) => {
    const lvl = levels[key];
    if (!lvl && !value) return;
    const tone: FactTone = lvl === "low" ? "good" : lvl === "moderate" ? "ok" : lvl === "high" ? "poor" : "ok";
    const subtitle = tone === "good" ? goodSub : tone === "poor" ? poorSub : okSub;
    const fact: NutrientFact = { id: key, title, subtitle, value, tone, icon };
    if (tone === "good") positives.push(fact);
    else negatives.push(fact);
  };

  if (kcalServing != null) {
    const tone: FactTone = kcalServing > 250 ? "poor" : kcalServing > 150 ? "ok" : "good";
    const fact: NutrientFact = {
      id: "calories",
      title: "Calories",
      subtitle: tone === "poor" ? "A bit too caloric" : tone === "ok" ? "Moderate calories" : "Reasonable calories",
      value: `${Math.round(kcalServing)} Cal`,
      tone,
      icon: "flame",
    };
    (tone === "good" ? positives : negatives).push(fact);
  }

  if (sodiumMg != null) {
    const tone: FactTone = sodiumMg > 300 ? "poor" : sodiumMg > 140 ? "ok" : "good";
    const fact: NutrientFact = {
      id: "sodium",
      title: "Sodium",
      subtitle: tone === "poor" ? "A bit too much sodium" : tone === "ok" ? "Moderate sodium" : "Low sodium",
      value: `${sodiumMg}mg`,
      tone,
      icon: "salt",
    };
    (tone === "good" ? positives : negatives).push(fact);
  } else {
    pushLevel("salt", "Salt", levels.salt || "—", "salt", "Low salt", "Moderate salt", "A bit too much salt");
  }

  if (sugarsServing != null) {
    const tone: FactTone = sugarsServing > 10 ? "poor" : sugarsServing > 5 ? "ok" : "good";
    const fact: NutrientFact = {
      id: "sugar",
      title: "Sugar",
      subtitle: tone === "good" ? "Low sugar" : tone === "ok" ? "Some sugar" : "Quite sugary",
      value: `${sugarsServing}g`,
      tone,
      icon: "sugar",
    };
    (tone === "good" ? positives : negatives).push(fact);
  } else {
    pushLevel("sugars", "Sugar", "—", "sugar", "Low sugar", "Some sugar", "Quite sugary");
  }

  if (satServing != null) {
    const tone: FactTone = satServing > 5 ? "poor" : satServing > 2 ? "ok" : "good";
    const fact: NutrientFact = {
      id: "satfat",
      title: "Saturated fat",
      subtitle: tone === "good" ? "Low impact" : tone === "ok" ? "Moderate" : "A bit high",
      value: `${satServing}g`,
      tone,
      icon: "fat",
    };
    (tone === "good" ? positives : negatives).push(fact);
  } else {
    pushLevel(
      "saturated-fat",
      "Saturated fat",
      fatServing != null ? `${fatServing}g fat` : "—",
      "fat",
      "Low impact",
      "Moderate",
      "A bit high",
    );
  }

  if (fiberServing != null) {
    const tone: FactTone = fiberServing >= 3 ? "good" : fiberServing >= 1 ? "ok" : "poor";
    const fact: NutrientFact = {
      id: "fiber",
      title: "Fiber",
      subtitle: tone === "good" ? "Excellent amount of fiber" : tone === "ok" ? "Some fiber" : "Low fiber",
      value: `${fiberServing}g`,
      tone,
      icon: "fiber",
    };
    (tone === "poor" ? negatives : positives).push(fact);
  }

  if (proteinServing != null) {
    const tone: FactTone = proteinServing >= 10 ? "good" : proteinServing >= 3 ? "ok" : "poor";
    const fact: NutrientFact = {
      id: "protein",
      title: "Protein",
      subtitle: tone === "good" ? "Good protein" : tone === "ok" ? "Some protein" : "Low protein",
      value: `${proteinServing}g`,
      tone,
      icon: "protein",
    };
    (tone === "poor" ? negatives : positives).push(fact);
  }

  if (additives > 0) {
    const tone: FactTone = additives >= 4 ? "poor" : additives >= 2 ? "ok" : "good";
    const fact: NutrientFact = {
      id: "additives",
      title: "Additives",
      subtitle: tone === "good" ? "Few additives" : tone === "ok" ? "Some additives" : "Many additives",
      value: String(additives),
      tone,
      icon: "additive",
    };
    (tone === "good" ? positives : negatives).push(fact);
  } else {
    positives.push({
      id: "additives",
      title: "Additives",
      subtitle: "No risky additives listed",
      value: "0",
      tone: "good",
      icon: "additive",
    });
  }

  if (nova != null) {
    const tone: FactTone = nova <= 2 ? "good" : nova === 3 ? "ok" : "poor";
    const fact: NutrientFact = {
      id: "nova",
      title: "Processing",
      subtitle:
        nova >= 4
          ? "Ultra-processed"
          : nova === 3
            ? "Processed"
            : "Minimally processed",
      value: `NOVA ${nova}`,
      tone,
      icon: "nova",
    };
    (tone === "good" ? positives : negatives).push(fact);
  }

  const score = scoreFromSignals({
    grade,
    nova,
    additives,
    kcalServing,
    sodiumMg,
    sugarsServing,
    fiberServing,
    satServing,
  });
  const { rating, rating_label } = ratingFromScore(score);

  const title =
    String(p.product_name || "").trim() ||
    "Packaged product";
  const brand = String(p.brands || "").split(",")[0]?.trim() || undefined;

  const guidance =
    rating === "excellent" || rating === "good"
      ? "A solid everyday pick — notice portion size and how you feel after."
      : rating === "moderate"
        ? "Fine sometimes — balance the rest of your day with fresher foods."
        : "Best as an occasional treat. Pair with protein, fiber, or water if you enjoy it.";

  const categories = buildCategories({
    overallScore: score,
    kcalServing: kcalServing ?? kcal100,
    proteinServing,
    fiberServing,
    sodiumMg,
    sugarsServing,
    satServing,
    fatServing,
    guidance,
  });

  return {
    is_food: true,
    source: "open_food_facts",
    barcode,
    title,
    brand,
    image_url: (p.image_front_small_url || p.image_url || null) as string | null,
    score,
    rating,
    rating_label,
    serving_size: serving,
    calories_serving: kcalServing ?? kcal100,
    summary:
      rating === "excellent" || rating === "good"
        ? "Strong across several categories — still check your portion."
        : rating === "moderate"
          ? "Mixed signals across categories — balance it with whole foods today."
          : "A few categories ask for more care — enjoy mindfully when you choose it.",
    should_eat_label:
      rating === "excellent" || rating === "good"
        ? "Everyday-friendly"
        : rating === "moderate"
          ? "Sometimes works"
          : "Occasional treat",
    guidance,
    categories,
    negatives,
    positives,
    recommendations:
      rating === "poor" || rating === "bad"
        ? [
            "Try a smaller portion or share the bag",
            "Pair with water and a protein/veggie snack later",
            "Look for baked or lower-sodium alternatives",
          ]
        : [
            "Enjoy mindfully and notice fullness",
            "Balance the rest of the day with whole foods",
          ],
    ingredients: String(p.ingredients_text || "") || undefined,
    disclaimer: ABOUT_FOOD_SCAN_ESTIMATE,
  };
}

function scoreFromSignals(s: {
  grade: string;
  nova: number | null;
  additives: number;
  kcalServing: number | null;
  sodiumMg: number | null;
  sugarsServing: number | null;
  fiberServing: number | null;
  satServing: number | null;
}): number {
  let score =
    s.grade === "a"
      ? 88
      : s.grade === "b"
        ? 74
        : s.grade === "c"
          ? 58
          : s.grade === "d"
            ? 42
            : s.grade === "e"
              ? 28
              : 55;

  if (s.nova != null) score -= (s.nova - 1) * 6;
  score -= Math.min(18, s.additives * 4);
  if (s.kcalServing != null && s.kcalServing > 200) score -= Math.min(12, (s.kcalServing - 200) / 20);
  if (s.sodiumMg != null && s.sodiumMg > 200) score -= Math.min(12, (s.sodiumMg - 200) / 40);
  if (s.sugarsServing != null && s.sugarsServing > 8) score -= Math.min(10, (s.sugarsServing - 8) * 1.5);
  if (s.satServing != null && s.satServing > 3) score -= Math.min(10, (s.satServing - 3) * 2);
  if (s.fiberServing != null) score += Math.min(10, s.fiberServing * 2);

  return Math.max(1, Math.min(99, Math.round(score)));
}

function ratingFromScore(score: number): { rating: FoodRating; rating_label: string } {
  if (score >= 75) return { rating: "excellent", rating_label: "Strong pick" };
  if (score >= 60) return { rating: "good", rating_label: "Solid choice" };
  if (score >= 45) return { rating: "moderate", rating_label: "Balanced sometimes" };
  if (score >= 30) return { rating: "poor", rating_label: "Go easy" };
  return { rating: "bad", rating_label: "Occasional treat" };
}

function toneFromScore(score: number): FactTone {
  if (score >= 70) return "good";
  if (score >= 45) return "ok";
  return "poor";
}

function clampScore(n: number): number {
  return Math.max(1, Math.min(99, Math.round(n)));
}

function buildCategories(input: {
  overallScore: number;
  kcalServing: number | null;
  proteinServing: number | null;
  fiberServing: number | null;
  sodiumMg: number | null;
  sugarsServing: number | null;
  satServing: number | null;
  fatServing: number | null;
  guidance: string;
}): FoodCategory[] {
  const calScore =
    input.kcalServing == null
      ? null
      : clampScore(
          input.kcalServing <= 150
            ? 88
            : input.kcalServing <= 250
              ? 70
              : input.kcalServing <= 400
                ? 52
                : Math.max(20, 70 - (input.kcalServing - 400) / 12),
        );

  const proteinScore =
    input.proteinServing == null
      ? null
      : clampScore(
          input.proteinServing >= 15
            ? 92
            : input.proteinServing >= 10
              ? 80
              : input.proteinServing >= 5
                ? 60
                : input.proteinServing >= 2
                  ? 42
                  : 28,
        );

  const fiberScore =
    input.fiberServing == null
      ? null
      : clampScore(
          input.fiberServing >= 5
            ? 92
            : input.fiberServing >= 3
              ? 78
              : input.fiberServing >= 1
                ? 55
                : 30,
        );

  const sodiumScore =
    input.sodiumMg == null
      ? null
      : clampScore(
          input.sodiumMg <= 140
            ? 90
            : input.sodiumMg <= 300
              ? 65
              : input.sodiumMg <= 500
                ? 42
                : Math.max(18, 50 - (input.sodiumMg - 500) / 20),
        );

  const sugarScore =
    input.sugarsServing == null
      ? null
      : clampScore(
          input.sugarsServing <= 5
            ? 90
            : input.sugarsServing <= 10
              ? 65
              : input.sugarsServing <= 18
                ? 42
                : Math.max(18, 45 - (input.sugarsServing - 18) * 1.5),
        );

  let fatScore: number | null = null;
  if (input.satServing != null) {
    const sat = input.satServing;
    const total = input.fatServing ?? sat;
    const satRatio = total > 0 ? sat / total : 1;
    fatScore = clampScore(
      sat <= 2 && satRatio < 0.4
        ? 88
        : sat <= 5
          ? 62
          : sat <= 8
            ? 42
            : Math.max(18, 40 - (sat - 8) * 3),
    );
  }

  const cats: FoodCategory[] = [
    {
      id: "nutrition_quality",
      label: "Nutrition Quality",
      emoji: "🥗",
      value: `${input.overallScore}/100`,
      score: input.overallScore,
      tone: toneFromScore(input.overallScore),
      note:
        input.overallScore >= 70
          ? "Looks supportive across the board"
          : input.overallScore >= 45
            ? "Mixed — some strengths, some tradeoffs"
            : "A few nutrients need more care",
    },
    {
      id: "calories",
      label: "Estimated Calories",
      emoji: "🔥",
      value: input.kcalServing != null ? `~${Math.round(input.kcalServing)} Cal` : "—",
      score: calScore,
      tone: calScore != null ? toneFromScore(calScore) : "ok",
      note:
        input.kcalServing == null
          ? "Estimate unavailable"
          : input.kcalServing <= 250
            ? "Reasonable energy for a snack or side"
            : "Higher energy — portion awareness helps",
    },
    {
      id: "protein",
      label: "Protein",
      emoji: "💪",
      value: input.proteinServing != null ? `${round1(input.proteinServing)}g` : "—",
      score: proteinScore,
      tone: proteinScore != null ? toneFromScore(proteinScore) : "ok",
      note:
        input.proteinServing == null
          ? "Estimate unavailable"
          : input.proteinServing >= 10
            ? "Helpful for fullness and recovery"
            : "Light on protein — pair with eggs, yogurt, or beans if you can",
    },
    {
      id: "fiber",
      label: "Fiber",
      emoji: "🌾",
      value: input.fiberServing != null ? `${round1(input.fiberServing)}g` : "—",
      score: fiberScore,
      tone: fiberScore != null ? toneFromScore(fiberScore) : "ok",
      note:
        input.fiberServing == null
          ? "Estimate unavailable"
          : input.fiberServing >= 3
            ? "Solid fiber for digestion and steady energy"
            : "Low fiber — add produce, beans, or whole grains nearby",
    },
    {
      id: "sodium",
      label: "Sodium",
      emoji: "🧂",
      value: input.sodiumMg != null ? `${Math.round(input.sodiumMg)}mg` : "—",
      score: sodiumScore,
      tone: sodiumScore != null ? toneFromScore(sodiumScore) : "ok",
      note:
        input.sodiumMg == null
          ? "Estimate unavailable"
          : input.sodiumMg <= 300
            ? "Sodium looks manageable"
            : "On the higher side — balance with fresher, lower-salt foods",
    },
    {
      id: "added_sugar",
      label: "Added Sugar",
      emoji: "🍬",
      value: input.sugarsServing != null ? `${round1(input.sugarsServing)}g` : "—",
      score: sugarScore,
      tone: sugarScore != null ? toneFromScore(sugarScore) : "ok",
      note:
        input.sugarsServing == null
          ? "Estimate unavailable"
          : input.sugarsServing <= 5
            ? "Sugar looks modest"
            : "Sugary for everyday — enjoy mindfully",
    },
    {
      id: "healthy_fats",
      label: "Healthy Fats",
      emoji: "🥜",
      value:
        input.satServing != null
          ? `${round1(input.satServing)}g sat`
          : input.fatServing != null
            ? `${round1(input.fatServing)}g fat`
            : "—",
      score: fatScore,
      tone: fatScore != null ? toneFromScore(fatScore) : "ok",
      note:
        fatScore == null
          ? "Estimate unavailable"
          : fatScore >= 70
            ? "Fat profile looks gentle"
            : "More saturated fat — keep portions mindful",
    },
    {
      id: "yaj_guidance",
      label: "YAJ Guidance",
      emoji: "🧠",
      value: "Coach tip",
      score: null,
      tone: "ok",
      note: input.guidance,
    },
  ];

  return cats;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Prefer model categories; otherwise derive a coaching set from available numbers. */
function ensureCategories(
  raw: Partial<FoodScanResult> & {
    categories?: FoodCategory[];
    protein_g?: number | null;
    fiber_g?: number | null;
    sodium_mg?: number | null;
    sugars_g?: number | null;
    sat_fat_g?: number | null;
    fat_g?: number | null;
  },
  fallbackScore: number,
  guidance: string,
): FoodCategory[] {
  if (Array.isArray(raw.categories) && raw.categories.length > 0) {
    return raw.categories.map((c) => ({
      id: c.id,
      label: c.label || String(c.id),
      emoji: c.emoji || "•",
      value: c.value || "—",
      score: c.score == null ? null : clampScore(Number(c.score)),
      tone: c.tone || (c.score != null ? toneFromScore(Number(c.score)) : "ok"),
      note: c.note || "",
    }));
  }

  return buildCategories({
    overallScore: fallbackScore,
    kcalServing: raw.calories_serving ?? null,
    proteinServing: raw.protein_g ?? null,
    fiberServing: raw.fiber_g ?? null,
    sodiumMg: raw.sodium_mg ?? null,
    sugarsServing: raw.sugars_g ?? null,
    satServing: raw.sat_fat_g ?? null,
    fatServing: raw.fat_g ?? null,
    guidance,
  });
}

const AI_JSON_PROMPT = `You are YAJ Food Scan — a calm Nourish Score wellness coach (NOT a doctor).
Look at the photo. It may be a packaged product (barcode / nutrition label) or a plate of food.
Score the WHOLE meal across categories — do not only label foods as good or bad.
Use estimate / guidance / educational language. Never say "opinion".
Return STRICT JSON only:

{
  "is_food": true,
  "barcode": "digits if clearly readable else null",
  "title": "product or meal name",
  "brand": "brand if visible else empty",
  "score": 0-100,
  "rating": "excellent|good|moderate|poor|bad",
  "rating_label": "Strong pick|Solid choice|Balanced sometimes|Go easy|Occasional treat",
  "serving_size": "e.g. 1 package / 1 plate",
  "calories_serving": number,
  "protein_g": number or null,
  "fiber_g": number or null,
  "sodium_mg": number or null,
  "sugars_g": number or null,
  "sat_fat_g": number or null,
  "fat_g": number or null,
  "summary": "1-2 sentences about the meal overall",
  "should_eat_label": "Everyday-friendly|Sometimes works|Occasional treat",
  "guidance": "2 sentences practical wellness coaching",
  "categories": [
    {"id":"nutrition_quality","label":"Nutrition Quality","emoji":"🥗","value":"72/100","score":72,"tone":"good|ok|poor","note":"short note"},
    {"id":"calories","label":"Estimated Calories","emoji":"🔥","value":"~320 Cal","score":0-100,"tone":"good|ok|poor","note":"..."},
    {"id":"protein","label":"Protein","emoji":"💪","value":"12g","score":0-100,"tone":"...","note":"..."},
    {"id":"fiber","label":"Fiber","emoji":"🌾","value":"4g","score":0-100,"tone":"...","note":"..."},
    {"id":"sodium","label":"Sodium","emoji":"🧂","value":"480mg","score":0-100,"tone":"...","note":"..."},
    {"id":"added_sugar","label":"Added Sugar","emoji":"🍬","value":"8g","score":0-100,"tone":"...","note":"..."},
    {"id":"healthy_fats","label":"Healthy Fats","emoji":"🥜","value":"3g sat","score":0-100,"tone":"...","note":"..."},
    {"id":"yaj_guidance","label":"YAJ Guidance","emoji":"🧠","value":"Coach tip","score":null,"tone":"ok","note":"practical guidance"}
  ],
  "negatives": [],
  "positives": [],
  "recommendations": ["better swap or habit tip"],
  "ingredients": "if readable else empty",
  "disclaimer": "Estimates and educational wellness guidance only — not medical advice."
}

If nutrition facts are visible, use those numbers. If a full plate, estimate calories and nutrients and coach the whole meal.`;

async function collectYajStream(resp: Response): Promise<string> {
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to reach YAJ");
  }
  if (!resp.body) throw new Error("No response from YAJ");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let result = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) result += content;
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  return result.trim();
}

async function analyzeWithAskYaj(imageDataUrl: string, notes?: string): Promise<FoodScanResult> {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${AI_JSON_PROMPT}\n\nUser notes: ${notes || "(none)"}`,
            },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });

  const raw = await collectYajStream(resp);
  const jsonText = extractJson(raw);
  const parsed = JSON.parse(jsonText) as Partial<FoodScanResult> & {
    barcode?: string | null;
  };

  // If AI read a barcode, prefer Open Food Facts truth.
  const code = parsed.barcode?.replace(/\D/g, "");
  if (code && code.length >= 8) {
    const off = await fetchOpenFoodFacts(code);
    if (off) return off;
  }

  return normalizeAiResult(parsed);
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  throw new Error("Could not parse food scan result");
}

function normalizeAiResult(
  raw: Partial<FoodScanResult> & {
    categories?: FoodCategory[];
    protein_g?: number | null;
    fiber_g?: number | null;
    sodium_mg?: number | null;
    sugars_g?: number | null;
    sat_fat_g?: number | null;
    fat_g?: number | null;
  },
): FoodScanResult {
  const score = Math.max(1, Math.min(99, Math.round(Number(raw.score) || 50)));
  const mapped = ratingFromScore(score);
  const guidance =
    raw.guidance ||
    "Educational wellness guidance based on an estimate of this meal — check in with how you feel.";
  const categories = ensureCategories(raw, score, guidance);

  return {
    is_food: raw.is_food !== false,
    source: "ai_vision",
    barcode: raw.barcode || null,
    title: raw.title || "Food scan",
    brand: raw.brand || undefined,
    image_url: raw.image_url || null,
    score,
    rating: raw.rating || mapped.rating,
    rating_label: raw.rating_label || mapped.rating_label,
    serving_size: raw.serving_size,
    calories_serving: raw.calories_serving ?? null,
    summary: raw.summary || "",
    should_eat_label: raw.should_eat_label || "See guidance below",
    guidance,
    categories,
    negatives: Array.isArray(raw.negatives) ? raw.negatives : [],
    positives: Array.isArray(raw.positives) ? raw.positives : [],
    recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
    ingredients: raw.ingredients,
    disclaimer: ABOUT_FOOD_SCAN_ESTIMATE,
  };
}

/**
 * Full scan pipeline:
 * barcode detector → Open Food Facts → Ask YAJ vision fallback.
 */
export async function analyzeFoodPhoto(
  images: string[],
  notes?: string,
  opts?: { barcodeHint?: string },
): Promise<FoodScanResult> {
  const image = images[0];
  if (!image) throw new Error("Add a food photo to scan.");

  const hint = opts?.barcodeHint?.replace(/\D/g, "");
  if (hint && hint.length >= 8) {
    const off = await fetchOpenFoodFacts(hint);
    if (off) return off;
  }

  const detected = await detectBarcodeFromDataUrl(image);
  if (detected) {
    const off = await fetchOpenFoodFacts(detected);
    if (off) return off;
  }

  return analyzeWithAskYaj(image, notes);
}

export function scoreDotClass(rating: FoodRating): string {
  if (rating === "excellent" || rating === "good") return "bg-emerald-500";
  if (rating === "moderate") return "bg-amber-400";
  if (rating === "poor") return "bg-orange-500";
  return "bg-rose-500";
}

export function factDotClass(tone: FactTone): string {
  if (tone === "good") return "bg-emerald-500";
  if (tone === "ok") return "bg-amber-400";
  return "bg-orange-500";
}
