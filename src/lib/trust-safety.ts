/** Trust & Safety — Community Timeout / cooldown (not “jail”). */

import { supabase } from "@/integrations/supabase/client";

export type ModerationStatus =
  | "active"
  | "warned"
  | "cooldown"
  | "timeout"
  | "suspended"
  | "banned";

export type ModerationActionType =
  | "warning"
  | "cooldown_24h"
  | "timeout_3d"
  | "timeout_7d"
  | "suspend"
  | "ban"
  | "restore"
  | "note";

export type ModerationReason =
  | "Spam"
  | "Harassment"
  | "Hate Speech"
  | "Copyright"
  | "Nudity"
  | "Scam/Fraud"
  | "Impersonation"
  | "Other";

export const MODERATION_REASONS: ModerationReason[] = [
  "Spam",
  "Harassment",
  "Hate Speech",
  "Copyright",
  "Nudity",
  "Scam/Fraud",
  "Impersonation",
  "Other",
];

export type ModerationSnapshot = {
  moderation_status: ModerationStatus;
  moderation_until: string | null;
  moderation_reason: string | null;
  moderation_offense_count: number;
  moderation_public_note: string | null;
};

export const EMPTY_MODERATION: ModerationSnapshot = {
  moderation_status: "active",
  moderation_until: null,
  moderation_reason: null,
  moderation_offense_count: 0,
  moderation_public_note: null,
};

export function suggestedActionForOffenses(offenseCount: number): ModerationActionType {
  if (offenseCount <= 0) return "warning";
  if (offenseCount === 1) return "cooldown_24h";
  if (offenseCount === 2) return "timeout_3d";
  if (offenseCount === 3) return "timeout_7d";
  return "ban";
}

export function actionLabel(action: ModerationActionType): string {
  switch (action) {
    case "warning":
      return "Send Warning";
    case "cooldown_24h":
      return "24-Hour Cooldown";
    case "timeout_3d":
      return "3-Day Timeout";
    case "timeout_7d":
      return "7-Day Timeout";
    case "suspend":
      return "Suspend Until Reviewed";
    case "ban":
      return "Permanently Close Account";
    case "restore":
      return "Restore Account";
    case "note":
      return "Add Moderator Note";
  }
}

export function statusLabel(status: ModerationStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "warned":
      return "Warning";
    case "cooldown":
      return "Cooldown";
    case "timeout":
      return "Timeout";
    case "suspended":
      return "Suspended";
    case "banned":
      return "Account Closed";
  }
}

/** Hard lockout — user stays on the Community Timeout screen. */
export function blocksAppAccess(status: ModerationStatus): boolean {
  return status === "suspended" || status === "banned";
}

/** Cannot create posts/battles/comments — browse still OK. */
export function blocksPublishing(status: ModerationStatus): boolean {
  return (
    status === "cooldown" ||
    status === "timeout" ||
    status === "suspended" ||
    status === "banned"
  );
}

export function formatRemaining(untilIso: string | null | undefined): string {
  if (!untilIso) return "Until reviewed";
  const ms = new Date(untilIso).getTime() - Date.now();
  if (ms <= 0) return "Ending soon…";
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days} day${days === 1 ? "" : "s"}, ${hours} hour${hours === 1 ? "" : "s"}`;
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"}, ${mins} minute${mins === 1 ? "" : "s"}`;
  return `${mins} minute${mins === 1 ? "" : "s"}`;
}

export async function refreshMyModerationStatus(): Promise<ModerationSnapshot> {
  const { data, error } = await (supabase as any).rpc("refresh_moderation_status");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return EMPTY_MODERATION;
  return {
    moderation_status: (row.moderation_status || "active") as ModerationStatus,
    moderation_until: row.moderation_until ?? null,
    moderation_reason: row.moderation_reason ?? null,
    moderation_offense_count: Number(row.moderation_offense_count || 0),
    moderation_public_note: row.moderation_public_note ?? null,
  };
}

export async function applyModerationAction(opts: {
  targetUserId: string;
  actionType: ModerationActionType;
  reason: string;
  details?: string | null;
  durationHours?: number | null;
}) {
  const { data, error } = await (supabase as any).rpc("apply_moderation_action", {
    p_target_user_id: opts.targetUserId,
    p_action_type: opts.actionType,
    p_reason: opts.reason,
    p_details: opts.details ?? null,
    p_duration_hours: opts.durationHours ?? null,
  });
  if (error) throw error;
  return data;
}

export async function fetchModerationHistory(userId: string) {
  const { data, error } = await (supabase as any)
    .from("moderation_actions")
    .select("*")
    .eq("target_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function submitModerationAppeal(message: string) {
  const { data: session } = await supabase.auth.getUser();
  const userId = session.user?.id;
  if (!userId) throw new Error("Sign in required");
  const { error } = await (supabase as any).from("moderation_appeals").insert({
    user_id: userId,
    message: message.trim().slice(0, 2000),
    status: "open",
  });
  if (error) throw error;

  // Mirror into Customer Relations inbox
  await (supabase as any).from("support_tickets").insert({
    user_id: userId,
    subject: "Community Timeout appeal",
    message: message.trim().slice(0, 2000),
    category: "moderation_appeal",
    status: "open",
  });
}
