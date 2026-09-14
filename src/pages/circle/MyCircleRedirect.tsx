import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RefreshCw, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getOrCreatePersonalCircle } from "@/lib/circles";

/** Resolve the signed-in user's personal Circle and hand off immediately. */
export default function MyCircleRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (loading || !user?.id) return;

    let active = true;
    void (async () => {
      try {
        const circle = await getOrCreatePersonalCircle(user.id, user.user_metadata?.display_name);
        if (active) navigate(`/circle/c/${circle.id}`, { replace: true });
      } catch {
        if (active) setError(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [loading, navigate, user?.id, user?.user_metadata?.display_name]);

  if (error) {
    return (
      <div className="flex min-h-[70dvh] items-center justify-center bg-background px-5 text-center text-foreground">
        <div className="w-full max-w-sm rounded-[24px] border border-border/70 bg-card p-6 shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Users className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-[20px] font-bold tracking-tight">My Circle is taking a moment</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            We couldn't open your Circle right now. Try again and we'll reconnect you.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70dvh] items-center justify-center bg-background px-5 text-foreground">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Users className="h-6 w-6" />
        </div>
        <p className="mt-4 text-[15px] font-bold">Opening My Circle</p>
        <p className="mt-1 text-[12px] font-medium text-muted-foreground">Getting your community ready…</p>
        <Loader2 className="mt-4 h-5 w-5 animate-spin text-primary" />
      </div>
    </div>
  );
}
