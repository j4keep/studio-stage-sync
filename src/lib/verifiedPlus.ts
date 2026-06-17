import { supabase } from "@/integrations/supabase/client";

export const hasActiveVerifiedPlusSubscription = async (userId: string): Promise<boolean> => {
  try {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("start_date, end_date")
      .eq("user_id", userId)
      .eq("plan_type", "verified_plus")
      .eq("status", "active")
      .lte("start_date", nowIso);

    if (error || !data) {
      if (error) console.error("Error checking Verified+ subscription:", error);
      return false;
    }

    return data.some((subscription) => {
      if (!subscription.end_date) return true;
      return new Date(subscription.end_date).getTime() > now;
    });
  } catch (error) {
    console.error("Error checking Verified+ subscription:", error);
    return false;
  }
};

export const getCurrentUserVerifiedPlusStatus = async (): Promise<boolean> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;
  return hasActiveVerifiedPlusSubscription(user.id);
};
