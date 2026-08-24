import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { getActivePublicLiveSession } from "@/lib/circle-live";

/** Entry point for "go watch this person's live" from the feed — resolves their current
 *  public live session (if any) and hands off to the real room. Mirrors
 *  PersonalCircleGate's job for personal Circles, one level up for public lives. */
export default function PublicLiveGate() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [notLive, setNotLive] = useState(false);

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      try {
        const session = await getActivePublicLiveSession(userId);
        if (session) navigate(`/live/${session.id}`, { replace: true });
        else setNotLive(true);
      } catch {
        setNotLive(true);
      }
    })();
  }, [userId]);

  if (notLive) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="font-bold">This live has ended.</p>
        <button type="button" onClick={() => navigate("/feed")} className="rounded-full bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
          Back to Home
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
