import { useEffect, useState } from "react";
import { Lock, Plus, Radio, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import {
  Circle,
  CircleMember,
  canAccessCircleExclusive,
  confirmExclusiveAge,
  getCircleExclusiveAccess,
  hasConfirmedExclusiveAge,
  setMemberRole,
  updateCircle,
} from "@/lib/circles";
import { CircleLiveSession, getActiveLiveSession } from "@/lib/circle-live";
import { supabase } from "@/integrations/supabase/client";
import CircleContentFeed from "@/components/circle/CircleContentFeed";
import CircleExclusivePostSheet from "@/components/circle/CircleExclusivePostSheet";
import LiveCameraView from "@/components/feed/create/LiveCameraView";

type Props = {
  circle: Circle;
  membership: CircleMember | null;
  userId?: string;
  isOwner: boolean;
  canCreate: boolean;
  onCircleChanged: () => void;
};

/**
 * Exclusive area — same Home / Post / Go Live pattern as the main Circle,
 * but gated by section-level Members vs Paid supporters + 18+ confirmation.
 */
export default function CircleExclusiveArea({
  circle,
  membership,
  userId,
  isOwner,
  canCreate,
  onCircleChanged,
}: Props) {
  const navigate = useNavigate();
  const [ageOk, setAgeOk] = useState(() => (userId ? hasConfirmedExclusiveAge(userId, circle.id) : false));
  const [showPost, setShowPost] = useState(false);
  const [showLivePrep, setShowLivePrep] = useState(false);
  const [liveSession, setLiveSession] = useState<CircleLiveSession | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [savingAccess, setSavingAccess] = useState(false);

  const access = getCircleExclusiveAccess(circle);
  const canView = canAccessCircleExclusive(circle, membership, isOwner);

  useEffect(() => {
    if (userId) setAgeOk(hasConfirmedExclusiveAge(userId, circle.id));
  }, [userId, circle.id]);

  useEffect(() => {
    void getActiveLiveSession(circle.id, { exclusive: true }).then(setLiveSession).catch(() => setLiveSession(null));
    const channel = supabase
      .channel(`circle-exclusive-live-${circle.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_live_sessions", filter: `circle_id=eq.${circle.id}` },
        () =>
          void getActiveLiveSession(circle.id, { exclusive: true })
            .then(setLiveSession)
            .catch(() => setLiveSession(null)),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [circle.id]);

  const setAccess = async (next: "members" | "paid") => {
    if (!isOwner || savingAccess) return;
    setSavingAccess(true);
    try {
      await updateCircle(circle.id, { exclusiveAccess: next });
      onCircleChanged();
      toast({
        title: next === "paid" ? "Exclusive · paid supporters only" : "Exclusive · members only",
      });
    } catch (e: any) {
      toast({ title: "Couldn't update access", description: e.message, variant: "destructive" });
    } finally {
      setSavingAccess(false);
    }
  };

  const previewSubscribe = async () => {
    if (!membership || !userId) return;
    try {
      await setMemberRole(membership.id, "paid_member");
      onCircleChanged();
      toast({ title: "Supporter access unlocked (preview)", description: "Billing coming soon — preview mode for testing." });
    } catch (e: any) {
      toast({ title: "Couldn't unlock", description: e.message, variant: "destructive" });
    }
  };

  if (!userId) {
    return (
      <div className="px-6 py-12 text-center text-[13px] text-muted-foreground">
        Sign in to enter Exclusive.
      </div>
    );
  }

  if (!ageOk) {
    return (
      <div className="mx-4 my-6 space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
          <div>
            <h3 className="text-[15px] font-black">18+ Exclusive area</h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
              This section may include adult or age-restricted content. You must be{" "}
              <strong className="text-foreground">18 or older</strong> to continue. By entering, you confirm you
              meet this age requirement.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            confirmExclusiveAge(userId, circle.id);
            setAgeOk(true);
          }}
          className="flex h-11 w-full items-center justify-center rounded-full bg-foreground text-sm font-bold text-background"
        >
          I am 18 or older — Enter Exclusive
        </button>
        <p className="text-center text-[10px] text-muted-foreground">
          YAJ may require additional age verification later for App Store and payment compliance.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-3 border-b border-border px-4 py-4">
        <div>
          <h2 className="text-sm font-black">Exclusive</h2>
          <p className="text-[11px] text-muted-foreground">
            Private drops & lives for qualifying people · not on the main feed
          </p>
        </div>

        {isOwner && (
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Who can see Exclusive
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={savingAccess}
                onClick={() => void setAccess("members")}
                className={`flex-1 rounded-full px-3 py-2 text-[11px] font-bold ${
                  access === "members" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                Members only
              </button>
              <button
                type="button"
                disabled={savingAccess}
                onClick={() => void setAccess("paid")}
                className={`flex-1 rounded-full px-3 py-2 text-[11px] font-bold ${
                  access === "paid" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                Paid supporters
              </button>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Applies to every Exclusive post and live — you don&apos;t set this on each upload.
            </p>
          </div>
        )}

        {!canView ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-8 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <p className="text-[13px] font-bold">
              {access === "paid" ? "Paid supporters only" : "Members only"}
            </p>
            <p className="max-w-xs text-[12px] text-muted-foreground">
              {access === "paid"
                ? "Subscribe to this creator’s Supporter Membership to view Exclusive posts and lives."
                : "Join this Circle to view Exclusive content."}
            </p>
            {access === "paid" && membership?.status === "approved" && (
              <button
                type="button"
                onClick={() => void previewSubscribe()}
                className="rounded-full bg-primary px-4 py-2 text-[12px] font-bold text-primary-foreground"
              >
                Unlock supporter access (preview)
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {canCreate && (
              <button
                type="button"
                onClick={() => setShowPost(true)}
                className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[12.5px] font-black text-primary-foreground active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                Post
              </button>
            )}
            {isOwner && !liveSession && (
              <button
                type="button"
                onClick={() => setShowLivePrep(true)}
                className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-[12.5px] font-black text-white active:scale-95"
              >
                <Radio className="h-3.5 w-3.5" />
                Go Live
              </button>
            )}
            {liveSession && (
              <button
                type="button"
                onClick={() => navigate(`/circle/c/${circle.id}/live?exclusive=1`)}
                className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-[12.5px] font-black text-white active:scale-95"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                {liveSession.host_user_id === userId ? "You're Live · Exclusive" : "Watch Exclusive Live"}
              </button>
            )}
            <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
              {access === "paid" ? "Supporters" : "Members"} · 18+
            </span>
          </div>
        )}
      </div>

      {canView && (
        <section>
          <div className="px-4 pt-3">
            <h3 className="text-sm font-bold">Exclusive Home</h3>
            <p className="text-[11px] text-muted-foreground">Posts & lives from this Exclusive space</p>
          </div>
          <CircleContentFeed
            circleId={circle.id}
            userId={userId}
            canInteract
            exclusiveOnly
            refreshKey={refresh}
            emptyLabel="No Exclusive posts yet. Tap Post to upload a photo or video."
          />
        </section>
      )}

      {userId && (
        <CircleExclusivePostSheet
          open={showPost}
          onClose={() => setShowPost(false)}
          circle={circle}
          userId={userId}
          onCreated={() => setRefresh((n) => n + 1)}
        />
      )}

      {showLivePrep && (
        <div className="fixed inset-0 z-[90] bg-black">
          <LiveCameraView
            createMode="live"
            onModeChange={() => {}}
            onClose={() => setShowLivePrep(false)}
            circleId={circle.id}
            hideModeTabs
            exclusiveLive
          />
        </div>
      )}
    </div>
  );
}
