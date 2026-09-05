import { useState } from "react";
import { ChevronDown, Shield } from "lucide-react";
import {
  MARKETPLACE_SAFETY_INTRO,
  MARKETPLACE_SAFETY_TIPS,
} from "@/lib/marketplace-safety-tips";

type Variant = "card" | "compact" | "panel";

type Props = {
  /** card = marketplace home / settings; compact = listing CTA; panel = settings/safety center expanded */
  variant?: Variant;
  className?: string;
  /** Start expanded (panel default true; card/compact default false) */
  defaultOpen?: boolean;
};

/**
 * Buyer/seller exchange safety tips — reuse on Marketplace and Privacy & Security.
 */
export default function MarketplaceSafetyTips({
  variant = "card",
  className = "",
  defaultOpen,
}: Props) {
  const openByDefault = defaultOpen ?? variant === "panel";
  const [open, setOpen] = useState(openByDefault);

  if (variant === "compact") {
    return (
      <div className={`rounded-xl border border-border bg-muted/40 px-3 py-2.5 ${className}`}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 text-left"
          aria-expanded={open}
        >
          <Shield className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="flex-1 text-xs font-semibold text-foreground">
            Safety tip: meet in public · don’t share personal info
          </span>
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <ul className="mt-2 space-y-2 border-t border-border/60 pt-2">
            {MARKETPLACE_SAFETY_TIPS.map((tip) => (
              <li key={tip.id} className="text-[11px] leading-snug text-muted-foreground">
                <span className="font-semibold text-foreground">{tip.title}.</span> {tip.body}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <section
      className={`overflow-hidden rounded-2xl border border-border bg-card ${className}`}
      aria-labelledby="marketplace-safety-heading"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Shield className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="marketplace-safety-heading" className="text-sm font-bold text-foreground">
            Stay safe on Marketplace
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {MARKETPLACE_SAFETY_INTRO}
          </p>
        </div>
        <ChevronDown
          className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul className="space-y-3 border-t border-border px-4 py-3.5">
          {MARKETPLACE_SAFETY_TIPS.map((tip) => (
            <li key={tip.id} className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              <div>
                <p className="text-xs font-semibold text-foreground">{tip.title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{tip.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
