import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import BreathingSession from "@/components/wellness/BreathingSession";
import { BREATHING_SESSIONS, demoForBreathing, patchToday } from "@/lib/wellness";

const EXTRAS = [
  {
    id: "gratitude",
    title: "60-second gratitude",
    blurb: "Name three small things that went okay today.",
  },
  {
    id: "focus",
    title: "Soft focus",
    blurb: "One song of calm breathing while you sit still.",
  },
];

export default function WellnessRelaxPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [breathId, setBreathId] = useState<string | null>(null);

  const breath = useMemo(
    () => BREATHING_SESSIONS.find((b) => b.id === breathId) || null,
    [breathId],
  );

  useEffect(() => {
    const start = params.get("start");
    if (start && BREATHING_SESSIONS.some((b) => b.id === start)) setBreathId(start);
  }, [params]);

  return (
    <div className="relative min-h-screen bg-[#eef6f4] pb-28 text-stone-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[radial-gradient(ellipse_at_top,_rgba(34,150,160,0.22),_transparent_65%)]"
      />
      <header className="sticky top-0 z-20 border-b border-teal-900/5 bg-[#eef6f4]/90 px-4 pb-3 pt-3 backdrop-blur">
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-700">Calm tools</p>
            <h1 className="text-lg font-black">Relax</h1>
          </div>
        </div>
      </header>

      <div className="relative space-y-5 px-4 pt-5">
        <button
          type="button"
          onClick={() => setBreathId("reset-2")}
          className="w-full overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-teal-700 via-emerald-700 to-cyan-800 p-5 text-left text-white shadow-md"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-100/90">Quick action</p>
          <p className="mt-1 text-xl font-black">I need a 2-minute reset</p>
          <p className="mt-1 text-sm text-white/80">Guided breath — no setup, no guilt.</p>
        </button>

        <section>
          <h2 className="text-base font-black">Breathing</h2>
          <div className="mt-3 space-y-2">
            {BREATHING_SESSIONS.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBreathId(b.id)}
                className="flex w-full items-center justify-between rounded-2xl border border-stone-200/80 bg-white/90 px-4 py-3.5 text-left shadow-sm"
              >
                <div>
                  <p className="text-sm font-bold">{b.title}</p>
                  <p className="text-[11px] text-stone-500">{b.blurb}</p>
                  {b.demoId ? (
                    <p className="mt-1 text-[11px] font-semibold text-teal-700">Includes ▶ Demo</p>
                  ) : null}
                </div>
                <span className="text-xs font-bold text-teal-700">{b.minutes} min</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-black">Short reflections</h2>
          <div className="mt-3 space-y-2">
            {EXTRAS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => {
                  patchToday((d) => {
                    d.mindfulMinutes += 1;
                  });
                  toast.message(x.blurb);
                }}
                className="w-full rounded-2xl border border-stone-200/80 bg-white/90 p-4 text-left shadow-sm"
              >
                <p className="text-sm font-bold">{x.title}</p>
                <p className="mt-1 text-xs text-stone-500">{x.blurb}</p>
              </button>
            ))}
          </div>
        </section>
      </div>

      {breath && (
        <BreathingSession
          open
          onClose={() => setBreathId(null)}
          title={breath.title}
          inhale={breath.inhale}
          hold={breath.hold}
          exhale={breath.exhale}
          holdOut={breath.holdOut}
          minutes={breath.minutes}
          demo={demoForBreathing(breath)}
          onProgress={(mins) => {
            patchToday((d) => {
              d.mindfulMinutes += mins;
            });
            toast.success(`${mins} mindful min logged`);
          }}
          onComplete={() => {
            toast.success("Session complete");
          }}
        />
      )}
    </div>
  );
}
