import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreatePersonalCircle } from "@/lib/circles";

/** Thin resolver behind every "My Circle" icon on a post/profile: finds (or, for your
 *  own id, creates) that person's personal Circle, then hands off to the real page —
 *  this is what makes tapping someone else's "My Circle" icon take you to *their*
 *  space instead of always landing on your own. */
export default function PersonalCircleGate() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      try {
        let displayName: string | undefined;
        const { data } = await (supabase as any).from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
        displayName = data?.display_name || undefined;
        const circle = await getOrCreatePersonalCircle(userId, displayName);
        navigate(`/circle/c/${circle.id}`, { replace: true });
      } catch {
        setError(true);
      }
    })();
  }, [userId, user?.id]);

  if (error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="font-bold">Couldn't open this Circle.</p>
        <button type="button" onClick={() => navigate("/circle")} className="rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
          Back to My Circle
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
