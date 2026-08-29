import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Shield } from "lucide-react";
import { useSafetyBalance } from "@/hooks/useSafetyBalance";

/** Adults only — Youth Mode keeps Meet on YAJ closed. */
export default function MeetAdultGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { policy, loading } = useSafetyBalance();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (policy && policy.dating_allowed === false) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Shield className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-display font-bold text-foreground">Meet on YAJ is 18+</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Dating features stay off for Youth accounts. Explore other parts of YAJ anytime.
        </p>
        <button
          type="button"
          onClick={() => navigate("/explore")}
          className="rounded-full gradient-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
        >
          Back to Explore
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

export function MeetBrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-primary ${className}`}>
      <Heart className="h-4 w-4 fill-current" />
      <span className="text-[11px] font-bold uppercase tracking-wide">Meet on YAJ</span>
    </span>
  );
}
