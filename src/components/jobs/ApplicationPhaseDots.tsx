import { APPLICATION_PHASE_FLOW, applicationStatusLabel, normalizeAppStatus } from "@/lib/jobs";

type Props = {
  status: string;
  /** Employee view: only emphasize current phase. Employer view: show progress through flow. */
  mode?: "employee" | "employer";
  className?: string;
};

/** Compact shaded dots for application phase — no long bar chart. */
export default function ApplicationPhaseDots({ status, mode = "employee", className = "" }: Props) {
  const normalized = normalizeAppStatus(status);
  const isTerminal = normalized === "rejected" || normalized === "withdrawn";
  const idx = APPLICATION_PHASE_FLOW.indexOf(normalized as (typeof APPLICATION_PHASE_FLOW)[number]);

  if (isTerminal) {
    const tone = normalized === "rejected" ? "text-rose-500 bg-rose-500/10" : "text-muted-foreground bg-muted";
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${tone}`}>
          {applicationStatusLabel(normalized)}
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1.5" aria-hidden>
        {APPLICATION_PHASE_FLOW.map((phase, i) => {
          const active = mode === "employee" ? i === idx : i <= idx;
          const current = i === idx;
          return (
            <span
              key={phase}
              className={`rounded-full transition-colors ${
                current ? "w-3 h-3 bg-primary" : active ? "w-2.5 h-2.5 bg-primary/70" : "w-2.5 h-2.5 bg-muted-foreground/25"
              }`}
            />
          );
        })}
      </div>
      <span className="text-[11px] font-bold text-foreground">
        {applicationStatusLabel(normalized)}
      </span>
    </div>
  );
}
