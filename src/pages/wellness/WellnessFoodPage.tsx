import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  ImagePlus,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  analyzeFoodPhoto,
  foodPhotoToDataUrl,
  ratingTone,
  type FoodScanResult,
} from "@/lib/wellness-food-scan";

export default function WellnessFoodPage() {
  const nav = useNavigate();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FoodScanResult | null>(null);

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
    } catch {
      toast.error("Couldn’t read that photo");
    } finally {
      setBusy(false);
    }
  };

  const runScan = async () => {
    if (!preview) {
      toast.message("Take or choose a food photo first");
      return;
    }
    setBusy(true);
    try {
      const res = await analyzeFoodPhoto([preview], notes.trim() || undefined);
      setResult(res);
      if (!res.is_food) toast.message("That doesn’t look like food — try another photo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Food scan failed");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setResult(null);
    setNotes("");
  };

  const tone = result ? ratingTone(result.rating) : null;

  return (
    <div className="relative min-h-screen bg-[#f6f3ee] pb-28 text-stone-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_20%_0%,rgba(180,120,60,0.2),transparent_55%),radial-gradient(ellipse_at_90%_10%,rgba(16,140,110,0.12),transparent_40%)]"
      />
      <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-[#f6f3ee]/92 px-4 pb-3 pt-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => nav("/wellness")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow-sm"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-800/80">
              AI nutrition helper
            </p>
            <h1 className="font-display text-lg font-bold tracking-tight">Food Scan</h1>
          </div>
        </div>
      </header>

      <div className="relative space-y-5 px-4 pt-5">
        <section className="rounded-[1.5rem] border border-stone-200/80 bg-white/90 p-4 shadow-sm">
          <p className="text-sm leading-relaxed text-stone-600">
            Snap a snack or a full plate. YAJ estimates whether it’s a{" "}
            <span className="font-bold text-stone-800">good</span>,{" "}
            <span className="font-bold text-stone-800">moderate</span>, or{" "}
            <span className="font-bold text-stone-800">limit</span> choice — plus a ballpark calorie
            range.
          </p>
          <p className="mt-2 text-[11px] font-medium text-stone-400">
            Estimates only — not medical or dietitian advice.
          </p>
        </section>

        {/* Capture */}
        <section className="overflow-hidden rounded-[1.6rem] border border-stone-200/80 bg-white shadow-[0_16px_40px_-28px_rgba(80,50,20,0.45)]">
          <div className="relative aspect-[4/3] bg-gradient-to-br from-stone-100 to-amber-50">
            {preview ? (
              <img src={preview} alt="Food preview" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <span className="text-4xl">🍽️</span>
                <p className="font-display text-lg font-bold text-stone-800">Add a food photo</p>
                <p className="text-xs text-stone-500">
                  Chips, a smoothie, or a plate of rice, beans, chicken & veggies
                </p>
              </div>
            )}
            {busy ? (
              <div className="absolute inset-0 flex items-center justify-center bg-stone-950/35 backdrop-blur-[1px]">
                <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-stone-800 shadow-lg">
                  <Loader2 className="h-4 w-4 animate-spin text-teal-700" />
                  Scanning…
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 p-4">
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
                className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 text-sm font-black text-stone-800"
              >
                <ImagePlus className="h-4 w-4" />
                Photos
              </button>
            </div>

            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                Optional notes
              </span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. lunch portion, homemade, extra sauce"
                className="mt-1 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm outline-none focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20"
              />
            </label>

            <button
              type="button"
              disabled={busy || !preview}
              onClick={() => void runScan()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-stone-900 text-sm font-black text-white disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4 text-amber-300" />
              {result ? "Scan again" : "Analyze food"}
            </button>

            {preview ? (
              <button
                type="button"
                disabled={busy}
                onClick={reset}
                className="flex w-full items-center justify-center gap-1.5 text-xs font-bold text-stone-500"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Clear photo
              </button>
            ) : null}
          </div>
        </section>

        {/* Result */}
        {result ? (
          <section className="space-y-3">
            <div
              className={`overflow-hidden rounded-[1.6rem] bg-gradient-to-br ${tone?.bg} p-5 ${tone?.text} shadow-lg ring-1 ${tone?.ring}`}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">
                {tone?.emoji} {result.rating_label}
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">{result.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/85">{result.summary}</p>
              <div className="mt-4 rounded-2xl bg-black/20 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">
                  Should you eat it?
                </p>
                <p className="mt-1 text-lg font-black">{result.should_eat_label}</p>
                <p className="mt-1 text-sm leading-relaxed text-white/80">{result.guidance}</p>
              </div>
            </div>

            {result.is_food ? (
              <div className="rounded-[1.5rem] border border-stone-200/80 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                  Ballpark calories
                </p>
                <p className="mt-1 font-display text-3xl font-bold tracking-tight text-stone-900">
                  ~{Math.round(result.calories.estimate)}{" "}
                  <span className="text-base font-semibold text-stone-500">kcal</span>
                </p>
                <p className="mt-1 text-xs font-semibold text-stone-500">
                  Range ~{Math.round(result.calories.low)}–{Math.round(result.calories.high)} ·{" "}
                  {result.calories.confidence} confidence
                </p>

                {result.items.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                      On the plate
                    </p>
                    {result.items.map((item, i) => (
                      <div
                        key={`${item.name}-${i}`}
                        className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-stone-800">{item.name}</p>
                          {item.portion ? (
                            <p className="text-[11px] text-stone-500">{item.portion}</p>
                          ) : null}
                        </div>
                        {item.calories != null ? (
                          <p className="shrink-0 text-sm font-black text-teal-800">
                            ~{Math.round(item.calories)}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {result.highlights.length > 0 ? (
              <Tips title="What’s working" items={result.highlights} tone="good" />
            ) : null}
            {result.watch_outs.length > 0 ? (
              <Tips title="Watch outs" items={result.watch_outs} tone="watch" />
            ) : null}
            {result.better_swaps.length > 0 ? (
              <Tips title="Better swaps" items={result.better_swaps} tone="swap" />
            ) : null}

            <p className="px-1 text-center text-[11px] leading-relaxed text-stone-400">
              {result.disclaimer}
            </p>
          </section>
        ) : null}
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

function Tips({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "good" | "watch" | "swap";
}) {
  const styles =
    tone === "good"
      ? "border-emerald-100 bg-emerald-50/80 text-emerald-950"
      : tone === "watch"
        ? "border-amber-100 bg-amber-50/80 text-amber-950"
        : "border-sky-100 bg-sky-50/80 text-sky-950";
  return (
    <div className={`rounded-[1.35rem] border p-4 ${styles}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="text-sm font-semibold leading-snug">
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
