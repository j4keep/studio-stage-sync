import { supabase } from "@/integrations/supabase/client";
import type { AgeBand } from "@/lib/safety-balance";

/**
 * MVP DM restriction: adults cannot freely open new chats with Youth accounts
 * (and teens cannot open new chats with unknown adults) unless the thread is
 * a utility context (marketplace / local help).
 */
export async function assertYouthDmAllowed(opts: {
  fromUserId: string;
  toUserId: string;
  context?: string | null;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (opts.context === "marketplace" || opts.context === "local_help") {
    return { ok: true };
  }

  let fromBand: AgeBand = "unknown";
  let toBand: AgeBand = "unknown";

  try {
    const { data: fromData } = await supabase.rpc("get_peer_age_band" as any, {
      p_user_id: opts.fromUserId,
    });
    const { data: toData } = await supabase.rpc("get_peer_age_band" as any, {
      p_user_id: opts.toUserId,
    });
    if (typeof fromData === "string") fromBand = fromData as AgeBand;
    if (typeof toData === "string") toBand = toData as AgeBand;
  } catch {
    // Fallback: local policies
    try {
      const fromRaw = localStorage.getItem(`yaj_safety_policy_${opts.fromUserId}`);
      const toRaw = localStorage.getItem(`yaj_safety_policy_${opts.toUserId}`);
      if (fromRaw) fromBand = (JSON.parse(fromRaw).age_band as AgeBand) || "unknown";
      if (toRaw) toBand = (JSON.parse(toRaw).age_band as AgeBand) || "unknown";
    } catch {
      /* ignore */
    }
  }

  const fromYouth = fromBand === "teen" || fromBand === "under_13";
  const toYouth = toBand === "teen" || toBand === "under_13";
  const fromAdult = fromBand === "adult";
  const toAdult = toBand === "adult";

  if (fromAdult && toYouth) {
    return {
      ok: false,
      reason: "Adults can’t start private chats with Youth accounts. Use Marketplace or Local Help when it’s a real booking or purchase.",
    };
  }
  if (fromYouth && toAdult) {
    return {
      ok: false,
      reason: "Youth accounts can’t start private chats with unknown adults. Ask a parent if you need help.",
    };
  }
  return { ok: true };
}
