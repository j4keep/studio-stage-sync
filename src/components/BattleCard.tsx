import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Trash2,
  Clock,
  BadgeCheck,
  Zap,
  MoreHorizontal,
  Archive,
  Flag,
  XCircle,
  Lock,
  ArchiveRestore,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import BattleStatusBadge from "@/components/battle/BattleStatusBadge";
import BattleNeonVoteBar from "@/components/battle/BattleNeonVoteBar";
import BattleWinnerCheckBadge from "@/components/battle/BattleWinnerCheckBadge";
import LiveBattleReplayPlayer from "@/components/battle/LiveBattleReplayPlayer";
import ReportContentSheet from "@/components/ReportContentSheet";
import {
  battleCategoryFromMedia,
  formatClockMmSs,
  formatCountdown,
  getBattleExpiresAt,
  getBattleUiStatus,
  getBattleWinnerSide,
  isBattleVotingOpen,
  tallyBattleVotes,
} from "@/lib/battle-ui";
import { getBattleReplayMediaUrl } from "@/lib/battle-live";
import {
  archiveBattleForUser,
  deletePendingBattle,
  getBattleContractAction,
  requestOrConfirmBattleCancel,
  unarchiveBattleForUser,
  type BattleLike,
} from "@/lib/battle-contract";

interface Battle {
  id: string;
  challenger_id: string;
  opponent_id: string | null;
  title: string;
  status: string;
  media_type: string;
  challenger_media_url: string | null;
  challenger_cover_url: string | null;
  challenger_title: string | null;
  opponent_media_url: string | null;
  opponent_cover_url: string | null;
  opponent_title: string | null;
  winner_id: string | null;
  created_at: string;
  expires_at?: string;
  max_duration_minutes?: number;
  views?: number;
  likes_count?: number;
  replay_media_url?: string | null;
  battle_background?: string | null;
  cancel_requested_by?: string | null;
  cancel_requested_at?: string | null;
  challenger_archived_at?: string | null;
  opponent_archived_at?: string | null;
}

/** Compact battle card for feed / battles list — open for like/comment/vote. */
const BattleCard = ({ battle, onOpen }: { battle: Battle; onOpen?: () => void }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const lastTapRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTouchRef = useRef(false);

  const openBattle = useCallback(() => {
    if (onOpen) onOpen();
    else navigate(`/battle/${battle.id}`);
  }, [onOpen, navigate, battle.id]);

  const expiresAt = battle.expires_at
    ? new Date(battle.expires_at)
    : new Date(new Date(battle.created_at).getTime() + 24 * 60 * 60 * 1000);
  const isExpired = new Date() > expiresAt;
  const isActive =
    battle.status === "active" && !!(battle.opponent_media_url || battle.opponent_cover_url);
  const isOpen = battle.status === "open" && !battle.opponent_id;
  const isPending = battle.status === "pending" && battle.opponent_id;
  const canAccept =
    (isOpen && user?.id !== battle.challenger_id) ||
    (isPending && user?.id === battle.opponent_id);

  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (isExpired || !isActive) return;
    const update = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Ended");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      );
    };
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, [expiresAt, isActive, isExpired]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["battle-card-profiles", battle.challenger_id, battle.opponent_id],
    queryFn: async () => {
      const ids = [battle.challenger_id, battle.opponent_id].filter(Boolean);
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", ids);
      return data || [];
    },
  });
  const profileMap = new Map((Array.isArray(profiles) ? profiles : []).map((p: any) => [p.user_id, p]));
  const challengerName =
    (profileMap.get(battle.challenger_id) as any)?.display_name || "Challenger";
  const opponentName = battle.opponent_id
    ? (profileMap.get(battle.opponent_id) as any)?.display_name || "???"
    : "???";

  const { data: votes = [] } = useQuery({
    queryKey: ["battle-votes", battle.id],
    queryFn: async () => {
      const { data } = await supabase.from("battle_votes").select("*").eq("battle_id", battle.id);
      return data || [];
    },
    refetchInterval: isActive && !isExpired ? 8000 : false,
  });
  const tally = tallyBattleVotes(votes as any[], battle.challenger_id, battle.opponent_id);
  const votingOpen = isBattleVotingOpen(battle);
  const winnerSide = getBattleWinnerSide(battle, tally, votingOpen);
  const contractAction = getBattleContractAction(
    battle as BattleLike,
    user?.id,
    tally.total || (votes as any[]).length,
  );

  const invalidateBattleQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["battles"] });
    queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
    queryClient.invalidateQueries({ queryKey: ["profile-posts"] });
    queryClient.invalidateQueries({ queryKey: ["battle", battle.id] });
    queryClient.invalidateQueries({ queryKey: ["battle-votes", battle.id] });
  };

  const contractMutation = useMutation({
    mutationFn: async (action: typeof contractAction) => {
      if (!user) throw new Error("Sign in required");
      if (action === "delete") {
        await deletePendingBattle(battle.id);
        return "deleted";
      }
      if (action === "cancel_request" || action === "cancel_confirm") {
        return requestOrConfirmBattleCancel(battle.id);
      }
      if (action === "archive") {
        await archiveBattleForUser(battle as BattleLike, user.id);
        return "archived";
      }
      if (action === "unarchive") {
        await unarchiveBattleForUser(battle as BattleLike, user.id);
        return "unarchived";
      }
      throw new Error("Action not available");
    },
    onSuccess: (result) => {
      invalidateBattleQueries();
      setMenuOpen(false);
      if (result === "deleted") toast.success("Battle deleted");
      else if (result === "requested" || result === "already_requested") {
        toast.message("Cancel requested — waiting for the other competitor to agree");
      } else if (result === "cancelled" || result === "already_cancelled") {
        toast.success("Battle cancelled by mutual agreement");
      } else if (result === "archived") {
        toast.success("Hidden from your profile — still in Arena history");
      } else if (result === "unarchived") {
        toast.success("Battle shown on your profile again");
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "Couldn't update battle");
    },
  });

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 450) {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      if (onOpen) openBattle();
      else setIsFullscreen((prev) => !prev);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      tapTimerRef.current = setTimeout(() => {
        openBattle();
      }, 450);
    }
  }, [openBattle, onOpen]);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      isTouchRef.current = true;
      handleTap();
    },
    [handleTap],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isTouchRef.current) {
        isTouchRef.current = false;
        return;
      }
      handleTap();
    },
    [handleTap],
  );

  const uiStatus = getBattleUiStatus(battle);
  const msLeft = getBattleExpiresAt(battle).getTime() - Date.now();
  const finalMinute = isActive && !isExpired && msLeft > 0 && msLeft <= 60_000;
  const cat = battleCategoryFromMedia(battle.media_type);
  const isLive = (battle.media_type || "").toLowerCase() === "live";
  const liveReplayUrl = isLive ? getBattleReplayMediaUrl(battle) : null;
  const timerLabel = finalMinute
    ? formatClockMmSs(msLeft)
    : timeLeft || (msLeft > 0 ? formatCountdown(msLeft) : "Ended");

  return (
    <motion.div
      layout
      className={`overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0b0b10] text-white shadow-[0_24px_60px_-28px_rgba(88,28,255,0.45)] transition-all duration-300 ${
        finalMinute ? "ring-1 ring-rose-500/50" : ""
      } ${isFullscreen ? "fixed inset-2 z-50 flex flex-col" : ""}`}
      style={isFullscreen ? { maxHeight: "calc(100vh - 16px)" } : {}}
    >
      {isFullscreen && (
        <div
          className="fixed inset-0 -z-10 bg-black/80"
          onClick={(e) => {
            e.stopPropagation();
            setIsFullscreen(false);
          }}
        />
      )}

      <div className="flex items-center gap-2 px-3.5 pb-1 pt-3">
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] text-violet-300 ring-1 ring-violet-400/30">
          {cat.emoji} {cat.label} Battle
        </span>
        <BattleStatusBadge status={finalMinute ? "ending" : uiStatus} />
        <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-white/55">
          <Clock className="h-3 w-3" />
          {uiStatus === "waiting" || uiStatus === "open" ? "Waiting" : `${timerLabel} left`}
        </span>
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="rounded-full p-1 text-white/40 hover:text-white"
            aria-label="Battle options"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menuOpen ? (
            <div
              className="absolute right-0 top-7 z-30 min-w-[11.5rem] overflow-hidden rounded-xl border border-white/15 bg-[#12121a] py-1 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {contractAction === "delete" ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-rose-300 hover:bg-white/5"
                  onClick={() => {
                    if (window.confirm("Delete this battle before it’s accepted?")) {
                      contractMutation.mutate("delete");
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete battle
                </button>
              ) : null}
              {contractAction === "cancel_request" ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-amber-200 hover:bg-white/5"
                  onClick={() => contractMutation.mutate("cancel_request")}
                >
                  <XCircle className="h-3.5 w-3.5" /> Cancel battle
                </button>
              ) : null}
              {contractAction === "cancel_confirm" ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-amber-200 hover:bg-white/5"
                  onClick={() => contractMutation.mutate("cancel_confirm")}
                >
                  <XCircle className="h-3.5 w-3.5" /> Agree to cancel
                </button>
              ) : null}
              {contractAction === "cancel_waiting" ? (
                <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-white/55">
                  <Clock className="h-3.5 w-3.5" /> Waiting on opponent
                </div>
              ) : null}
              {contractAction === "locked" ? (
                <div className="flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-white/55">
                  <Lock className="h-3.5 w-3.5" /> Locked after first vote
                </div>
              ) : null}
              {contractAction === "archive" ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-white/85 hover:bg-white/5"
                  onClick={() => contractMutation.mutate("archive")}
                >
                  <Archive className="h-3.5 w-3.5" /> Hide from my profile
                </button>
              ) : null}
              {contractAction === "unarchive" ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-white/85 hover:bg-white/5"
                  onClick={() => contractMutation.mutate("unarchive")}
                >
                  <ArchiveRestore className="h-3.5 w-3.5" /> Show on my profile
                </button>
              ) : null}
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-white/85 hover:bg-white/5"
                onClick={() => {
                  setMenuOpen(false);
                  setReportOpen(true);
                }}
              >
                <Flag className="h-3.5 w-3.5" /> Report / remove request
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {user && reportOpen ? (
        <ReportContentSheet
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          reporterId={user.id}
          targetType="battle"
          targetId={battle.id}
          title="Report or request battle removal"
        />
      ) : null}

      <div className="relative px-3 pb-2 pt-2">
        <div className="mb-2 grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-black tracking-[0.04em] text-cyan-300">
              {challengerName.toUpperCase()}
            </p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-semibold text-white/70">
              <span className="truncate">{battle.challenger_title || battle.title || "Entry"}</span>
              {battle.challenger_media_url || battle.challenger_cover_url ? (
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
              ) : null}
            </p>
          </div>
          <div className="min-w-0 text-right">
            <p className="truncate text-[11px] font-black tracking-[0.04em] text-pink-400">
              {opponentName.toUpperCase()}
            </p>
            <p className="mt-0.5 flex items-center justify-end gap-1 truncate text-[11px] font-semibold text-white/70">
              {battle.opponent_media_url || battle.opponent_cover_url ? (
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-pink-400" />
              ) : null}
              <span className="truncate">
                {battle.opponent_title || (battle.opponent_id ? "Waiting…" : "Open slot")}
              </span>
            </p>
          </div>
        </div>

        {liveReplayUrl ? (
          <div
            className="relative w-full"
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <LiveBattleReplayPlayer
              src={liveReplayUrl}
              leftName={challengerName}
              rightName={opponentName}
              leftCoverUrl={battle.challenger_cover_url}
              rightCoverUrl={battle.opponent_cover_url}
              compact
              winnerSide={winnerSide}
            />
          </div>
        ) : (
        <button
          type="button"
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
          className="relative block w-full"
        >
          {/* Portrait boxes match post thumbs (4/5) — not short landscape strips */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            <div
              className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-neutral-900 shadow-[0_0_24px_rgba(34,211,238,0.4)] ring-[3px] ring-cyan-300/90"
            >
              {battle.challenger_cover_url ? (
                <img src={battle.challenger_cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-cyan-600/40 to-cyan-950">
                  <span className="text-4xl opacity-50">🎵</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <p
                className="absolute inset-x-2 bottom-3 truncate text-center font-black uppercase italic tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                style={{ fontSize: "clamp(14px, 4.2vw, 22px)" }}
              >
                {(battle.challenger_title || "READY").split(" ")[0]}
              </p>
              {winnerSide === "left" ? <BattleWinnerCheckBadge size="sm" /> : null}
            </div>

            <div className="relative z-20 flex items-center justify-center self-center">
              <motion.div
                animate={{
                  boxShadow: [
                    "0 0 10px rgba(34,211,238,0.4)",
                    "0 0 22px rgba(236,72,153,0.5)",
                    "0 0 10px rgba(34,211,238,0.4)",
                  ],
                }}
                transition={{ repeat: Infinity, duration: 1.8 }}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-black font-black tracking-[0.16em] text-white ring-2 ring-white/85"
              >
                VS
              </motion.div>
            </div>

            <div
              className={`relative aspect-[4/5] overflow-hidden rounded-2xl bg-neutral-900 ring-[3px] ${
                battle.opponent_cover_url
                  ? "shadow-[0_0_24px_rgba(236,72,153,0.4)] ring-pink-400/90"
                  : "shadow-none ring-pink-400/35"
              }`}
            >
              {battle.opponent_cover_url ? (
                <img src={battle.opponent_cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-pink-950/80 to-black px-3 text-center">
                  <span className="text-3xl opacity-50">❓</span>
                  <p className="mt-2 text-[11px] font-bold text-white/60">
                    {isPending ? "Waiting for opponent" : "Open challenge"}
                  </p>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              {battle.opponent_title ? (
                <p
                  className="absolute inset-x-2 bottom-3 truncate text-center font-black uppercase italic tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                  style={{ fontSize: "clamp(14px, 4.2vw, 22px)" }}
                >
                  {battle.opponent_title.split(" ")[0]}
                </p>
              ) : null}
              {winnerSide === "right" ? <BattleWinnerCheckBadge size="sm" /> : null}
            </div>
          </div>
        </button>
        )}
      </div>

      <div className="space-y-2.5 px-3.5 pb-3.5 pt-1">
        <BattleNeonVoteBar
          leftPct={tally.leftPct}
          leftInitial={challengerName}
          rightInitial={opponentName}
          size="sm"
          interactive={false}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (canAccept && !battle.opponent_media_url) navigate(`/battle/${battle.id}`);
            else openBattle();
          }}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-violet-500 px-3 py-2.5 text-[12px] font-black text-white shadow-[0_0_18px_rgba(139,92,246,0.45)]"
        >
          <Zap className="h-3.5 w-3.5" />
          {canAccept && !battle.opponent_media_url
            ? "Enter Arena"
            : onOpen
              ? "Open battle"
              : "Open battle"}
        </button>
      </div>
    </motion.div>
  );
};

export default BattleCard;
