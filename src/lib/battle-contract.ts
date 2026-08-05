/** Battle lifecycle as a contract — prevents unilateral erase after accept. */

import { supabase } from "@/integrations/supabase/client";
import { getBattleUiStatus, isBattleVotingOpen } from "@/lib/battle-ui";

export type BattleContractAction =
  | "delete"
  | "cancel_request"
  | "cancel_confirm"
  | "cancel_waiting"
  | "archive"
  | "unarchive"
  | "report"
  | "locked";

export type BattleLike = {
  id: string;
  status?: string | null;
  challenger_id: string;
  opponent_id?: string | null;
  opponent_media_url?: string | null;
  opponent_cover_url?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  scheduled_start_at?: string | null;
  battle_background?: string | null;
  media_type?: string | null;
  max_duration_minutes?: number | null;
  cancel_requested_by?: string | null;
  cancel_requested_at?: string | null;
  challenger_archived_at?: string | null;
  opponent_archived_at?: string | null;
  winner_id?: string | null;
};

export function isBattleAccepted(battle: BattleLike): boolean {
  const status = (battle.status || "").toLowerCase();
  if (status === "cancelled") return false;
  if (status === "open" && !battle.opponent_id) return false;
  if (status === "pending") {
    // Pending with no opponent entry = not accepted yet.
    return !!(battle.opponent_media_url || battle.opponent_cover_url);
  }
  return status === "active" || status === "completed" || status === "ended" || status === "expired";
}

export function isBattlePendingDeleteable(battle: BattleLike): boolean {
  const status = (battle.status || "").toLowerCase();
  if (status === "cancelled") return false;
  if (!(status === "open" || status === "pending")) return false;
  // Creator can delete before the opponent has accepted/uploaded.
  return !(battle.opponent_media_url || battle.opponent_cover_url);
}

export function isBattleCancelled(battle: BattleLike): boolean {
  return (battle.status || "").toLowerCase() === "cancelled";
}

export function isBattleArchivedForUser(battle: BattleLike, userId: string | undefined | null): boolean {
  if (!userId) return false;
  if (userId === battle.challenger_id) return !!battle.challenger_archived_at;
  if (userId === battle.opponent_id) return !!battle.opponent_archived_at;
  return false;
}

export function getBattleContractAction(
  battle: BattleLike,
  userId: string | undefined | null,
  voteCount: number,
): BattleContractAction {
  if (!userId) return "report";
  const isParticipant =
    userId === battle.challenger_id || userId === battle.opponent_id;
  const status = (battle.status || "").toLowerCase();

  if (status === "cancelled") {
    return isParticipant ? "archive" : "report";
  }

  // Before accept — creator may hard-delete.
  if (isBattlePendingDeleteable(battle)) {
    return userId === battle.challenger_id ? "delete" : "report";
  }

  const ended =
    getBattleUiStatus(battle) === "ended" ||
    status === "ended" ||
    status === "expired" ||
    (status === "completed" && !isBattleVotingOpen(battle));

  // After first vote (or while live with votes) — locked. After end — archive only.
  if (voteCount > 0 || ended) {
    if (!isParticipant) return "report";
    if (ended) {
      return isBattleArchivedForUser(battle, userId) ? "unarchive" : "archive";
    }
    return "locked";
  }

  // Accepted, no votes yet — mutual cancel.
  if (isParticipant) {
    if (!battle.cancel_requested_by) return "cancel_request";
    if (battle.cancel_requested_by === userId) return "cancel_waiting";
    return "cancel_confirm";
  }

  return "report";
}

export async function deletePendingBattle(battleId: string): Promise<void> {
  const { error } = await (supabase as any).from("battles").delete().eq("id", battleId);
  if (error) throw error;
}

export async function requestOrConfirmBattleCancel(battleId: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc("request_or_confirm_battle_cancel", {
    p_battle_id: battleId,
  });
  if (error) throw error;
  return String(data || "");
}

export async function archiveBattleForUser(battle: BattleLike, userId: string): Promise<void> {
  const patch =
    userId === battle.challenger_id
      ? { challenger_archived_at: new Date().toISOString() }
      : userId === battle.opponent_id
        ? { opponent_archived_at: new Date().toISOString() }
        : null;
  if (!patch) throw new Error("Not a participant");
  const { error } = await (supabase as any).from("battles").update(patch).eq("id", battle.id);
  if (error) throw error;
}

export async function unarchiveBattleForUser(battle: BattleLike, userId: string): Promise<void> {
  const patch =
    userId === battle.challenger_id
      ? { challenger_archived_at: null }
      : userId === battle.opponent_id
        ? { opponent_archived_at: null }
        : null;
  if (!patch) throw new Error("Not a participant");
  const { error } = await (supabase as any).from("battles").update(patch).eq("id", battle.id);
  if (error) throw error;
}
