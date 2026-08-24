import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getOrCreatePersonalCircle } from "@/lib/circles";

/** "My Circle" is now just your own personal Circle page — no more hub of Quick
 *  Actions / Discover / dating / creating additional Circles. This route resolves
 *  (or provisions, on a brand-new account) your Circle and hands off immediately. */
export default function MyCircleRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (loading || !user?.id) return;
    void (async () => {
      try {
        const circle = await getOrCreatePersonalCircle(user.id, user.user_metadata?.display_name);
        navigate(`/circle/c/${circle.id}`, { replace: true });
      } catch {
        setError(true);
      }
    })();
  }, [loading, user?.id]);

  if (error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="font-bold">Couldn't open My Circle.</p>
        <button type="button" onClick={() => window.location.reload()} className="rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
