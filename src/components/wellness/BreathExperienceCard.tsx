import { BREATH_CARD_META, type BreathCardMeta } from "@/lib/wellness-relax";
import type { BreathingPattern } from "@/lib/wellness";

type Props = {
  session: BreathingPattern;
  onStart: () => void;
};

function CardVisual({ meta }: { meta: BreathCardMeta }) {
  if (meta.visual === "square") {
    return (
      <div className="breath-card-square relative mx-auto mt-1 h-14 w-14">
        <span className="absolute inset-0 rounded-lg border border-teal-200/40" />
        <span className="absolute inset-2 rounded-md bg-teal-300/20" />
      </div>
    );
  }
  if (meta.visual === "waves") {
    return (
      <div className="relative mx-auto mt-2 h-12 w-20 overflow-hidden">
        <span className="breath-card-wave absolute inset-x-0 bottom-1 h-3 rounded-full bg-sky-300/35" />
        <span className="breath-card-wave-2 absolute inset-x-1 bottom-3 h-2.5 rounded-full bg-cyan-200/25" />
      </div>
    );
  }
  if (meta.visual === "leaves") {
    return (
      <div className="relative mx-auto mt-1 flex h-12 items-center justify-center gap-1">
        <span className="breath-card-leaf inline-block h-3 w-5 rounded-[0_70%_0_70%] bg-emerald-300/40" />
        <span className="breath-card-leaf-2 inline-block h-3 w-5 rounded-[0_70%_0_70%] bg-lime-200/35" />
      </div>
    );
  }
  return (
    <div className="relative mx-auto mt-1 h-12 w-16">
      <span className="absolute right-1 top-0 text-lg opacity-90">🌙</span>
      <span className="breath-card-star absolute left-1 top-3 h-1 w-1 rounded-full bg-white/80" />
      <span className="breath-card-star absolute left-6 top-1 h-1.5 w-1.5 rounded-full bg-violet-100/70" />
      <span className="breath-card-star absolute left-3 top-7 h-1 w-1 rounded-full bg-white/60" />
    </div>
  );
}

/** Mini-experience breathing card — unique gradient + motion per session. */
export default function BreathExperienceCard({ session, onStart }: Props) {
  const meta = BREATH_CARD_META[session.id] || BREATH_CARD_META.box;

  return (
    <button
      type="button"
      onClick={onStart}
      className="group relative overflow-hidden rounded-[1.5rem] p-4 text-left shadow-[0_18px_40px_-24px_rgba(0,0,0,0.65)] ring-1 ring-white/10 transition active:scale-[0.99]"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient}`} />
      <div
        className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full blur-2xl"
        style={{ background: meta.accent }}
      />
      <div className="breath-card-float pointer-events-none absolute -left-4 bottom-0 h-20 w-20 rounded-full bg-white/5 blur-xl" />

      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <p className="text-2xl leading-none">{meta.emoji}</p>
          <span className="rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/70">
            ○ {meta.level}
          </span>
        </div>
        <p className="mt-3 text-[11px] font-black uppercase tracking-[0.16em] text-white/90">
          {meta.kicker}
        </p>
        <div className="mt-2 h-px w-full bg-gradient-to-r from-white/35 via-white/15 to-transparent" />
        <p className="mt-2.5 text-xs font-bold text-white/85">{meta.rhythmLabel}</p>
        <div className="mt-2 space-y-0.5">
          {meta.phaseHints.map((line) => (
            <p key={line} className="text-[11px] leading-snug text-white/55">
              {line}
            </p>
          ))}
        </div>
        <CardVisual meta={meta} />
        <p className="mt-1 text-[12px] font-semibold text-white/70">{meta.tagline}</p>
        <div className="mt-3 flex items-end justify-between gap-2">
          <p className="text-sm font-black text-white">{session.minutes} Minutes</p>
          <span className="text-xs font-black tracking-wide text-teal-100/95 transition group-hover:translate-x-0.5">
            START →
          </span>
        </div>
      </div>
    </button>
  );
}

/** Injected once — shared motion for breath experience cards. */
export function BreathExperienceCardStyles() {
  return (
    <style>{`
      .breath-card-float { animation: bcf 7s ease-in-out infinite; }
      .breath-card-square { animation: bcsq 4.5s ease-in-out infinite; }
      .breath-card-wave { animation: bcw 5s ease-in-out infinite; }
      .breath-card-wave-2 { animation: bcw 6.5s ease-in-out infinite reverse; }
      .breath-card-leaf { animation: bcl 6s ease-in-out infinite; }
      .breath-card-leaf-2 { animation: bcl 7s ease-in-out infinite reverse; }
      .breath-card-star { animation: bct 3s ease-in-out infinite; }
      @keyframes bcf {
        0%, 100% { transform: translateY(0); opacity: 0.5; }
        50% { transform: translateY(-8px); opacity: 0.85; }
      }
      @keyframes bcsq {
        0%, 100% { transform: scale(0.92); }
        50% { transform: scale(1.06); }
      }
      @keyframes bcw {
        0%, 100% { transform: translateY(0) scaleX(1); }
        50% { transform: translateY(-4px) scaleX(1.08); }
      }
      @keyframes bcl {
        0%, 100% { transform: translateY(0) rotate(-6deg); }
        50% { transform: translateY(-5px) rotate(10deg); }
      }
      @keyframes bct {
        0%, 100% { opacity: 0.35; }
        50% { opacity: 1; }
      }
    `}</style>
  );
}
