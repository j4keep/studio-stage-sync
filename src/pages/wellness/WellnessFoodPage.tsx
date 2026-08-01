import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Apple,
  ArrowLeft,
  Camera,
  ImagePlus,
  Loader2,
  RefreshCw,
  ScanBarcode,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  ABOUT_FOOD_SCAN_ESTIMATE,
  analyzeFoodPhoto,
  foodPhotoToDataUrl,
  type FoodCategory,
  type FoodScanResult,
} from "@/lib/wellness-food-scan";

export default function WellnessFoodPage() {
  const nav = useNavigate();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [barcode, setBarcode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FoodScanResult | null>(null);

  const runScan = async (dataUrl: string, codeHint?: string) => {
    setBusy(true);
    setResult(null);
    try {
      const res = await analyzeFoodPhoto([dataUrl], notes.trim() || undefined, {
        barcodeHint: codeHint || barcode,
      });
      setResult(res);
      if (res.barcode) setBarcode(res.barcode);
      if (!res.is_food) toast.message("That doesn’t look like food — try another photo");
      else if (res.source === "open_food_facts") toast.success("Product found");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Food scan failed");
    } finally {
      setBusy(false);
    }
  };

  const onPick = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a photo");
      return;
    }
    try {
      setBusy(true);
      setResult(null);
      const dataUrl = await foodPhotoToDataUrl(file);
      setPreview(dataUrl);
      setBusy(false);
      await runScan(dataUrl);
    } catch {
      setBusy(false);
      toast.error("Couldn’t read that photo");
    }
  };

  const reset = () => {
    setPreview(null);
    setResult(null);
    setNotes("");
    setBarcode("");
  };

  return (
    <div className="relative min-h-screen bg-white pb-28 text-stone-900">
      <header className="sticky top-0 z-20 border-b border-stone-100 bg-white/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav("/wellness")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-600/80">
              Nourish · YAJ coach
            </p>
            <h1 className="text-lg font-black tracking-tight">Food Scan</h1>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-4 pt-4">
        {!result ? (
          <section className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/50 px-4 py-3.5">
            <p className="text-sm font-semibold leading-relaxed text-stone-700">
              Scan a meal, snack, or barcode.
            </p>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
              About this estimate
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-stone-500">
              {ABOUT_FOOD_SCAN_ESTIMATE}
            </p>
          </section>
        ) : null}

        {/* Capture / preview */}
        <section className="overflow-hidden rounded-[1.4rem] border border-stone-200 bg-stone-50">
          <div className="relative aspect-[4/3]">
            {preview ? (
              <img src={preview} alt="Food preview" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <ScanBarcode className="h-10 w-10 text-stone-300" />
                <p className="text-base font-black text-stone-800">Scan a product</p>
                <p className="text-xs text-stone-500">
                  Point at the barcode or nutrition facts — or snap a full plate
                </p>
              </div>
            )}
            {/* Viewfinder corners */}
            <div className="pointer-events-none absolute inset-8">
              <span className="absolute left-0 top-0 h-6 w-6 border-l-2 border-t-2 border-white/90" />
              <span className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-white/90" />
              <span className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-white/90" />
              <span className="absolute bottom-0 right-0 h-6 w-6 border-b-2 border-r-2 border-white/90" />
            </div>
            {busy ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
                <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold shadow-lg">
                  <Loader2 className="h-4 w-4 animate-spin text-teal-700" />
                  Scanning…
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 bg-white p-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => cameraRef.current?.click()}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-teal-700 text-sm font-black text-white"
              >
                <Camera className="h-4 w-4" />
                Camera
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => libraryRef.current?.click()}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 text-sm font-black"
              >
                <ImagePlus className="h-4 w-4" />
                Photos
              </button>
            </div>

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                Barcode (optional)
              </span>
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value.replace(/[^\d]/g, ""))}
                inputMode="numeric"
                placeholder="e.g. 028400012546"
                className="mt-1 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm outline-none focus:border-teal-500/50"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                Optional notes
              </span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. whole bag, half serving, homemade plate"
                className="mt-1 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm outline-none focus:border-teal-500/50"
              />
            </label>

            <button
              type="button"
              disabled={busy || (!preview && barcode.length < 8)}
              onClick={() => {
                if (preview) void runScan(preview, barcode);
                else if (barcode.length >= 8) {
                  // barcode-only lookup without photo
                  void (async () => {
                    setBusy(true);
                    try {
                      const { fetchOpenFoodFacts } = await import("@/lib/wellness-food-scan");
                      const off = await fetchOpenFoodFacts(barcode);
                      if (!off) throw new Error("Product not found — try a photo of the label");
                      setResult(off);
                      toast.success("Product found");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Lookup failed");
                    } finally {
                      setBusy(false);
                    }
                  })();
                }
              }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-stone-900 text-sm font-black text-white disabled:opacity-45"
            >
              <Sparkles className="h-4 w-4 text-amber-300" />
              {result ? "Scan again" : "Analyze"}
            </button>

            {preview || result ? (
              <button
                type="button"
                disabled={busy}
                onClick={reset}
                className="flex w-full items-center justify-center gap-1.5 text-xs font-bold text-stone-500"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Clear
              </button>
            ) : null}
          </div>
        </section>

        {result ? <NourishScoreCard result={result} preview={preview} /> : null}
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onPick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function nourishStroke(score: number) {
  if (score >= 75) return "#10b981";
  if (score >= 50) return "#14b8a6";
  if (score >= 30) return "#f59e0b";
  return "#f97316";
}

function NourishScoreCard({
  result,
  preview,
}: {
  result: FoodScanResult;
  preview: string | null;
}) {
  const thumb = result.image_url || preview;
  const r = 46;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, result.score));
  const offset = c - (pct / 100) * c;
  const stroke = nourishStroke(result.score);
  const perServing = result.serving_size
    ? `Estimates · ${result.serving_size}`
    : "Estimates per serving";

  return (
    <section className="overflow-hidden rounded-[1.85rem] border border-emerald-100 bg-gradient-to-b from-white via-white to-emerald-50/40 shadow-sm">
      <div className="px-5 pt-5">
        <div className="flex gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-emerald-50 ring-1 ring-emerald-100">
            {thumb ? (
              <img src={thumb} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-emerald-700">
                <Apple className="h-7 w-7" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-600/80">
              {result.source === "open_food_facts" ? "Product match" : "Plate estimate"}
              {result.barcode ? ` · ${result.barcode}` : ""}
            </p>
            <h2 className="mt-0.5 truncate text-lg font-black tracking-tight text-stone-900">
              {result.title}
            </h2>
            {result.brand ? <p className="truncate text-sm text-stone-500">{result.brand}</p> : null}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-5">
          <div className="relative h-[112px] w-[112px] shrink-0">
            <svg viewBox="0 0 112 112" className="h-full w-full -rotate-90">
              <circle cx="56" cy="56" r={r} fill="none" stroke="#e7e5e4" strokeWidth="9" />
              <circle
                cx="56"
                cy="56"
                r={r}
                fill="none"
                stroke={stroke}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black tabular-nums leading-none text-stone-900">
                {result.score}
              </span>
              <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-400">
                / 100
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-600">
              Nourish Score
            </p>
            <p className="mt-1 text-xl font-black tracking-tight text-stone-900">
              {result.rating_label}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{result.summary}</p>
          </div>
        </div>

        <div className="mt-5 rounded-[1.35rem] border border-emerald-100 bg-white/90 px-4 py-3.5 shadow-sm">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600">
                YAJ guidance · {result.should_eat_label}
              </p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-stone-700">
                {result.guidance}
              </p>
            </div>
          </div>
        </div>
      </div>

      {result.categories.length > 0 ? (
        <div className="mt-4 border-t border-emerald-100/80 px-5 py-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">
              Meal coaching
            </p>
            <p className="text-[11px] text-stone-400">{perServing}</p>
          </div>
          <ul className="space-y-2.5">
            {result.categories.map((cat) => (
              <CategoryRow key={cat.id} category={cat} />
            ))}
          </ul>
        </div>
      ) : null}

      {result.recommendations.length > 0 ? (
        <div className="border-t border-emerald-100/80 px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-600/80">
            YAJ ideas
          </p>
          <ul className="mt-2.5 space-y-2">
            {result.recommendations.map((rec) => (
              <li
                key={rec}
                className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-3.5 py-2.5 text-sm font-semibold text-stone-700"
              >
                {rec}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.ingredients ? (
        <div className="border-t border-emerald-100/80 px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400">
            Ingredients
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">{result.ingredients}</p>
        </div>
      ) : null}

      <div className="border-t border-emerald-100/80 px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-stone-400">
          About this estimate
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-stone-500">{result.disclaimer}</p>
      </div>
    </section>
  );
}

function categoryBarColor(tone: FoodCategory["tone"]) {
  if (tone === "good") return "bg-emerald-500";
  if (tone === "ok") return "bg-teal-400";
  return "bg-amber-500";
}

function CategoryRow({ category }: { category: FoodCategory }) {
  const isGuidance = category.id === "yaj_guidance";
  return (
    <li className="rounded-2xl border border-white/80 bg-white/90 px-3.5 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-stone-900">
          <span className="mr-1.5" aria-hidden>
            {category.emoji}
          </span>
          {category.label}
        </p>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-stone-500">
          {category.value}
        </p>
      </div>
      {!isGuidance && category.score != null ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
          <div
            className={`h-full rounded-full transition-all ${categoryBarColor(category.tone)}`}
            style={{ width: `${Math.max(6, Math.min(100, category.score))}%` }}
          />
        </div>
      ) : null}
      <p className="mt-1.5 text-xs leading-relaxed text-stone-500">{category.note}</p>
    </li>
  );
}
