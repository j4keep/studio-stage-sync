import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Apple,
  ArrowLeft,
  Camera,
  ChevronDown,
  Flame,
  ImagePlus,
  Leaf,
  Loader2,
  RefreshCw,
  ScanBarcode,
  Shrub,
  Sparkles,
  Wheat,
} from "lucide-react";
import { toast } from "sonner";
import {
  analyzeFoodPhoto,
  factDotClass,
  foodPhotoToDataUrl,
  scoreDotClass,
  type FoodScanResult,
  type NutrientFact,
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
              Product & plate scan
            </p>
            <h1 className="text-lg font-black tracking-tight">Food Scan</h1>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-4 pt-4">
        {!result ? (
          <section className="rounded-2xl border border-stone-100 bg-stone-50 px-4 py-3">
            <p className="text-sm leading-relaxed text-stone-600">
              Scan a <span className="font-bold text-stone-900">barcode</span>, nutrition label, or
              full plate. YAJ scores the product and breaks down nutrients — like Yuka.
            </p>
            <p className="mt-1 text-[11px] text-stone-400">
              Estimates / public product data only — not medical advice.
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

        {result ? <YukaResultCard result={result} preview={preview} /> : null}
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

function YukaResultCard({
  result,
  preview,
}: {
  result: FoodScanResult;
  preview: string | null;
}) {
  const thumb = result.image_url || preview;

  return (
    <section className="space-y-6 pb-4">
      {/* Header like Yuka */}
      <div className="flex gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-200">
          {thumb ? (
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-2xl">🍽️</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-black leading-snug text-stone-900">{result.title}</h2>
          {result.brand ? <p className="mt-0.5 text-sm text-stone-500">{result.brand}</p> : null}
          <div className="mt-2 flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${scoreDotClass(result.rating)}`} />
            <span className="text-xl font-black tabular-nums">{result.score}/100</span>
            <span className="text-sm text-stone-500">{result.rating_label}</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-stone-50 px-4 py-3">
        <p className="text-sm font-bold text-stone-900">{result.should_eat_label}</p>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">{result.summary}</p>
        {result.calories_serving != null ? (
          <p className="mt-2 text-xs font-semibold text-stone-500">
            ~{Math.round(result.calories_serving)} Cal
            {result.serving_size ? ` · ${result.serving_size}` : ""}
          </p>
        ) : null}
      </div>

      {result.negatives.length > 0 ? (
        <FactSection
          title="Negatives"
          context={result.serving_size ? `per serving (${result.serving_size})` : "per serving"}
          facts={result.negatives}
        />
      ) : null}

      {result.positives.length > 0 ? (
        <FactSection
          title="Positives"
          context={result.serving_size ? `per serving (${result.serving_size})` : "per serving"}
          facts={result.positives}
        />
      ) : null}

      {result.recommendations.length > 0 ? (
        <div>
          <h3 className="text-base font-black">Recommendations</h3>
          <ul className="mt-2 space-y-2">
            {result.recommendations.map((r) => (
              <li
                key={r}
                className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2.5 text-sm font-semibold text-stone-700"
              >
                {r}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.ingredients ? (
        <div>
          <h3 className="text-base font-black">Ingredients</h3>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">{result.ingredients}</p>
        </div>
      ) : null}

      <p className="text-center text-[11px] leading-relaxed text-stone-400">{result.disclaimer}</p>
      <p className="text-center text-[10px] text-stone-300">
        Source: {result.source === "open_food_facts" ? "Open Food Facts" : "YAJ vision estimate"}
        {result.barcode ? ` · ${result.barcode}` : ""}
      </p>
    </section>
  );
}

function FactSection({
  title,
  context,
  facts,
}: {
  title: string;
  context: string;
  facts: NutrientFact[];
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-base font-black">{title}</h3>
        <p className="text-[11px] text-stone-400">{context}</p>
      </div>
      <div className="divide-y divide-stone-100 rounded-2xl border border-stone-100">
        {facts.map((f) => (
          <div key={f.id + f.title} className="flex items-center gap-3 px-3 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-50 text-stone-600">
              <FactIcon icon={f.icon} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-stone-900">{f.title}</p>
              <p className="text-xs text-stone-500">{f.subtitle}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm font-semibold text-stone-800">{f.value}</span>
              <span className={`h-2.5 w-2.5 rounded-full ${factDotClass(f.tone)}`} />
              <ChevronDown className="h-4 w-4 text-stone-300" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FactIcon({ icon }: { icon: NutrientFact["icon"] }) {
  const cls = "h-4 w-4";
  switch (icon) {
    case "flame":
      return <Flame className={cls} />;
    case "salt":
      return <Sparkles className={cls} />;
    case "sugar":
      return <Apple className={cls} />;
    case "fat":
      return <DropletIcon />;
    case "fiber":
      return <Wheat className={cls} />;
    case "protein":
      return <Shrub className={cls} />;
    case "veg":
      return <Leaf className={cls} />;
    case "additive":
      return <ScanBarcode className={cls} />;
    case "nova":
      return <Sparkles className={cls} />;
    default:
      return <Sparkles className={cls} />;
  }
}

function DropletIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3s6 6.5 6 10a6 6 0 1 1-12 0c0-3.5 6-10 6-10z" />
    </svg>
  );
}
