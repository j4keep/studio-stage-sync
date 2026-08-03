import { supabase } from "@/integrations/supabase/client";
import { uploadToR2, getR2DownloadUrl } from "@/lib/r2-storage";
import {
  buildLiveBattleBackground,
  getBattleScheduledStartAt,
  isMissingLiveBattleColumnError,
  parseLiveBattleMeta,
} from "@/lib/battle-live";

type BattleLike = {
  id: string;
  challenger_id?: string | null;
  battle_background?: string | null;
  scheduled_start_at?: string | null;
  expires_at?: string | null;
};

/** Upload a recorded live debate and keep it on the battle post until deleted. */
export async function persistLiveBattleReplay(opts: {
  battle: BattleLike;
  userId: string;
  blob: Blob;
}): Promise<string | null> {
  const { battle, userId, blob } = opts;
  if (!blob.size) return null;

  const file = new File([blob], `live-battle-${battle.id}.webm`, {
    type: blob.type || "video/webm",
  });
  const result = await uploadToR2(file, {
    folder: `battles/replays/${userId}`,
    fileName: `${Date.now()}.${file.type.includes("mp4") ? "mp4" : "webm"}`,
    mimeType: file.type || "video/webm",
    preferProxy: true,
  });
  if (!result.success || !result.data) {
    throw new Error(result.error || "Replay upload failed");
  }

  const url = getR2DownloadUrl(result.data.key);
  const meta = parseLiveBattleMeta(battle.battle_background);
  const background = buildLiveBattleBackground(
    {
      scheduled_start_at: getBattleScheduledStartAt(battle) || meta.scheduled_start_at,
      debate_ends_at: meta.debate_ends_at || meta.expires_at || null,
      duration_min: meta.duration_min,
      vote_window_minutes: meta.vote_window_minutes,
      replay_media_url: url,
    },
    battle.battle_background,
  );

  // Keep status active so the 24h voting window stays open after the debate ends.
  // Prefer dedicated column; always also stash in battle_background for schema-cache gaps.
  let { error } = await (supabase as any)
    .from("battles")
    .update({
      replay_media_url: url,
      battle_background: background,
    })
    .eq("id", battle.id)
    .eq("challenger_id", userId);

  if (error && isMissingLiveBattleColumnError(error)) {
    ({ error } = await (supabase as any)
      .from("battles")
      .update({
        battle_background: background,
      })
      .eq("id", battle.id)
      .eq("challenger_id", userId));
  }

  if (error) throw error;
  return url;
}
