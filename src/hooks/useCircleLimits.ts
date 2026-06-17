import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hasActiveVerifiedPlusSubscription } from "@/lib/verifiedPlus";

export interface CircleLimits {
  isVerifiedPlus: boolean;
  isPaymentPaused: boolean; // true if subscription exists but payment failed
  maxCirclesAllowed: number;
  maxMembersPerCircle: number;
  activeCirclesCount: number;
  completedCirclesCount: number;
  joinedCirclesCount: number;
  totalActiveParticipation: number;
  canCreateCircle: boolean;
  canJoinCircle: boolean;
  mustUpgrade: boolean;
  loading: boolean;
}

// Tier limits
const FREE_MAX_CIRCLES = 1;
const FREE_MAX_MEMBERS = 10;
const VERIFIED_MAX_CIRCLES = 5;
const VERIFIED_MAX_MEMBERS = 100;
const UPGRADE_AFTER_COMPLETED = 3;

export const useCircleLimits = () => {
  const [limits, setLimits] = useState<CircleLimits>({
    isVerifiedPlus: false,
    isPaymentPaused: false,
    maxCirclesAllowed: FREE_MAX_CIRCLES,
    maxMembersPerCircle: FREE_MAX_MEMBERS,
    activeCirclesCount: 0,
    completedCirclesCount: 0,
    joinedCirclesCount: 0,
    totalActiveParticipation: 0,
    canCreateCircle: true,
    canJoinCircle: true,
    mustUpgrade: false,
    loading: true,
  });

  useEffect(() => {
    checkLimits();
  }, []);

  const checkLimits = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLimits(prev => ({ ...prev, loading: false }));
        return;
      }

      // Check subscription status via edge function for payment status awareness
      let isVerifiedPlus = false;
      let isPaymentPaused = false;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: subData } = await supabase.functions.invoke("check-verified-plus", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (subData) {
            isVerifiedPlus = !!subData.subscribed;
            isPaymentPaused = subData.payment_status === "past_due";
          }
        }
      } catch {
        // Fallback to DB check
        isVerifiedPlus = await hasActiveVerifiedPlusSubscription(user.id);
      }

      // Count user's active circles (not completed)
      const { count: activeCount } = await supabase
        .from("savings_circles")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .neq("status", "completed");

      // Count user's completed circles
      const { count: completedCount } = await supabase
        .from("savings_circles")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .eq("status", "completed");

      // Count circles user has joined that are NOT completed (active participation)
      const { data: joinedCircles } = await supabase
        .from("savings_circle_members")
        .select("circle_id, savings_circles!inner(status)")
        .eq("user_id", user.id)
        .neq("savings_circles.status", "completed");

      const activeCirclesCount = activeCount || 0;
      const completedCirclesCount = completedCount || 0;
      const joinedActiveCount = joinedCircles?.length || 0;

      // Total active participation = circles you own (not completed) + circles you've joined (not completed)
      // Note: If you own a circle, you're also a member, so we count joined circles where you're NOT the owner
      const { data: joinedNotOwned } = await supabase
        .from("savings_circle_members")
        .select("circle_id, savings_circles!inner(status, owner_id)")
        .eq("user_id", user.id)
        .neq("savings_circles.status", "completed")
        .neq("savings_circles.owner_id", user.id);

      const joinedNotOwnedCount = joinedNotOwned?.length || 0;
      const totalActiveParticipation = activeCirclesCount + joinedNotOwnedCount;

      // Determine if user must upgrade (completed 2+ and not verified)
      const mustUpgrade = !isVerifiedPlus && completedCirclesCount >= UPGRADE_AFTER_COMPLETED;

      // Calculate limits based on tier
      const maxCirclesAllowed = isVerifiedPlus ? VERIFIED_MAX_CIRCLES : FREE_MAX_CIRCLES;
      const maxMembersPerCircle = isVerifiedPlus ? VERIFIED_MAX_MEMBERS : FREE_MAX_MEMBERS;

      // If payment is paused, treat as free tier
      const canCreateCircle = !mustUpgrade && !isPaymentPaused && activeCirclesCount < maxCirclesAllowed;
      const canJoinCircle = !mustUpgrade && !isPaymentPaused && totalActiveParticipation < maxCirclesAllowed;

      setLimits({
        isVerifiedPlus: isVerifiedPlus && !isPaymentPaused,
        isPaymentPaused,
        maxCirclesAllowed,
        maxMembersPerCircle,
        activeCirclesCount,
        completedCirclesCount,
        joinedCirclesCount: joinedActiveCount,
        totalActiveParticipation,
        canCreateCircle,
        canJoinCircle,
        mustUpgrade,
        loading: false,
      });
    } catch (error) {
      console.error("Error checking circle limits:", error);
      setLimits(prev => ({ ...prev, loading: false }));
    }
  };

  return { ...limits, refresh: checkLimits };
};

export { FREE_MAX_MEMBERS, VERIFIED_MAX_MEMBERS };
