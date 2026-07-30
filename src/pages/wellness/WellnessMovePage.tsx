import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import WorkoutTimer from "@/components/wellness/WorkoutTimer";
import {
  getWellnessFigure,
  loadWellnessState,
  MOVE_ROUTINES,
  moveStepText,
  patchToday,
  WELLNESS_UPDATED_EVENT,
  type WellnessFigure,
} from "@/lib/wellness";

export default function WellnessMovePage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [figure, setFigure] = useState<WellnessFigure>(() => getWellnessFigure());

  useEffect(() => {
    const refresh = () => setFigure(getWellnessFigure());
    refresh();
    window.addEventListener(WELLNESS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(WELLNESS_UPDATED_EVENT, refresh);
  }, []);

  // Ensure deep-links still work if profile was never set
  useEffect(() => {
    void loadWellnessState();
  }, []);

  const active = useMemo(
    () => MOVE_ROUTINES.find((r) => r.id === activeId) || null,
    [activeId],
  );

  useEffect(() => {
    const start = params.get("start");
    if (start && MOVE_ROUTINES.some((r) => r.id === start)) setActiveId(start);
  }, [params]);

  return (
    <div className="relative min-h-screen bg-[#f3f7f5] pb-28 text-stone-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[radial-gradient(ellipse_at_top,_rgba(16,140,110,0.2),_transparent_65%)]"
      />
      <header className="sticky top-0 z-20 border-b border-teal-900/5 bg-[#f3f7f5]/90 px-4 pb-3 pt-3 backdrop-blur">
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-700">Approachable movement</p>
            <h1 className="text-lg font-black">Move</h1>
          </div>
        </div>
      </header>

      <div className="relative space-y-4 px-4 pt-5">
        <p className="text-sm text-stone-600">
          Short, no-equipment routines with form-guide cards and YAJ voice coaching for each step.
        </p>
        {MOVE_ROUTINES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setActiveId(r.id)}
            className="w-full rounded-[1.4rem] border border-stone-200/80 bg-white/90 p-4 text-left shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-black">{r.title}</p>
                <p className="mt-1 text-xs capitalize text-stone-500">
                  {r.level} · {r.kind} · {r.minutes} min
                </p>
                <p className="mt-1 text-[11px] font-semibold text-teal-700">
                  Form guides · YAJ voice · Pause / Next
                </p>
              </div>
              <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-bold text-teal-800">
                Start
              </span>
            </div>
            <ul className="mt-3 space-y-1">
              {r.steps.slice(0, 3).map((s, i) => (
                <li key={`${i}-${moveStepText(s)}`} className="text-xs text-stone-500">
                  · {moveStepText(s)}
                </li>
              ))}
            </ul>
          </button>
        ))}
        <p className="text-[11px] text-stone-500">
          Illustration cards match your profile (woman/man) with a neutral skin tone. YAJ tells you
          what to do and how long to hold.
        </p>
      </div>

      {active && (
        <WorkoutTimer
          title={active.title}
          minutes={active.minutes}
          steps={active.steps}
          kind={active.kind}
          figure={figure}
          onClose={() => setActiveId(null)}
          onProgress={(mins) => {
            patchToday((d) => {
              d.moveMinutes += mins;
            });
            toast.success(`${mins} min movement logged`);
          }}
          onComplete={() => {
            toast.success("Workout complete — nice work");
          }}
        />
      )}
    </div>
  );
}
