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
    fileName: `${Date.now()}.webm`,
    mimeType: file.type,
  });
  if (!result.success || !result.data) return null;

  const url = getR2DownloadUrl(result.data.key);
  const meta = parseLiveBattleMeta(battle.battle_background);
  const background = buildLiveBattleBackground(
    {
      scheduled_start_at: getBattleScheduledStartAt(battle) || meta.scheduled_start_at,
      expires_at: meta.expires_at || battle.expires_at,
      duration_min: meta.duration_min,
      replay_media_url: url,
    },
    battle.battle_background,
  );

  // Prefer dedicated column; always also stash in battle_background for schema-cache gaps.
  let { error } = await (supabase as any)
    .from("battles")
    .update({
      replay_media_url: url,
      battle_background: background,
      status: "completed",
    })
    .eq("id", battle.id)
    .eq("challenger_id", userId);

  if (error && isMissingLiveBattleColumnError(error)) {
    ({ error } = await (supabase as any)
      .from("battles")
      .update({
        battle_background: background,
        status: "completed",
      })
      .eq("id", battle.id)
      .eq("challenger_id", userId));
  }

  if (error) throw error;
  return url;
}
