import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Flame, Trophy, X, Swords, Crown, Target, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildBattleArenaRecord,
  mediaTypeEmoji,
  mediaTypeLabel,
  type BattleWinRow,
} from "@/lib/battle-records";
import { finalizeExpiredBattles } from "@/lib/finalize-battle-wins";
import { formatCompact } from "@/lib/battle-ui";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Full-screen permanent competitive record — bragging rights from battle_wins.
 * Opens from the Creators Battle hub; cannot be wiped by deleting battle posts.
 */
export default function BattleArenaRecord({ open, onClose }: Props) {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const { data: profile } = useQuery({
    queryKey: ["battle-arena-profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
    enabled: open && !!userId,
  });

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["battle-arena-record", userId],
    queryFn: async () => {
      if (!userId) return [] as BattleWinRow[];
      // Flush any expired battles into permanent records before reading.
      await finalizeExpiredBattles(userId);
      const { data, error } = await (supabase as any)
        .from("battle_wins")
        .select("*")
        .or(`winner_id.eq.${userId},loser_id.eq.${userId}`)
        .order("declared_at", { ascending: false });
      if (error) throw error;
      return (data || []) as BattleWinRow[];
    },
    enabled: open && !!userId,
  });

  useEffect(() => {
    if (open && userId) void refetch();
  }, [open, userId, refetch]);

  const record = useMemo(
    () => (userId ? buildBattleArenaRecord(userId, rows) : null),
    [userId, rows],
  );

  const displayName =
    profile?.display_name || user?.email?.split("@")[0] || "Competitor";
  const initial = (displayName || "?")[0]?.toUpperCase();

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex flex-col bg-[#06060a] text-white">
      {/* Atmosphere */}
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 15% -10%, rgba(34,211,238,0.28), transparent 55%), radial-gradient(ellipse 70% 45% at 90% 0%, rgba(236,72,153,0.26), transparent 50%), radial-gradient(ellipse 60% 40% at 50% 100%, rgba(250,204,21,0.12), transparent 55%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.85rem)]">
        <div className="min-w-0 flex-1">
          <p
            className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300/90"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Permanent record
          </p>
          <h1
            className="truncate text-2xl font-black tracking-tight text-white"
            style={{ fontFamily: "'Bangers', cursive", letterSpacing: "0.04em" }}
          >
            WINNING STREET
          </h1>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20"
          aria-label="Close record"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-2">
        {!userId ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Swords className="h-12 w-12 text-white/30" />
            <p className="text-sm font-bold text-white/70">Sign in to unlock your arena record.</p>
          </div>
        ) : isLoading || !record ? (
          <div className="flex justify-center py-24">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
            {/* Identity + streak hero */}
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-[#12121a] via-[#0c0c14] to-[#16101a] p-5 shadow-[0_0_60px_-20px_rgba(34,211,238,0.45)]"
            >
              <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-pink-500/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-12 -left-6 h-36 w-36 rounded-full bg-cyan-400/20 blur-3xl" />

              <div className="relative flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white/10 ring-2 ring-cyan-300/50">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xl font-black text-cyan-200">{initial}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-black tracking-tight text-white">
                    {displayName}
                  </p>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">
                    Arena competitor
                  </p>
                </div>
                <div className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-300 ring-1 ring-amber-300/40">
                  Live record
                </div>
              </div>

              <div className="relative mt-6 flex items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 text-orange-300">
                    <Flame className="h-4 w-4 fill-orange-400/40" />
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">
                      Winning streak
                    </span>
                  </div>
                  <motion.p
                    key={record.currentStreak}
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mt-1 bg-gradient-to-r from-orange-300 via-amber-200 to-pink-300 bg-clip-text font-black leading-none text-transparent"
                    style={{
                      fontFamily: "'Bangers', cursive",
                      fontSize: "clamp(4.5rem, 22vw, 6.5rem)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {record.currentStreak}
                  </motion.p>
                  <p className="mt-1 text-xs font-bold text-white/50">
                    Best run · {record.bestStreak} in a row
                  </p>
                </div>

                <div className="mb-2 flex flex-col items-end gap-2">
                  <div className="rounded-2xl bg-black/40 px-3 py-2 text-right ring-1 ring-white/10">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                      Win rate
                    </p>
                    <p className="font-mono text-3xl font-black text-cyan-300">
                      {record.winPct}%
                    </p>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* W / L tiles */}
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="grid grid-cols-3 gap-2.5"
            >
              <StatTile
                label="Wins"
                value={String(record.wins)}
                accent="from-cyan-400/25 to-cyan-500/5"
                ring="ring-cyan-300/40"
                icon={<Trophy className="h-3.5 w-3.5 text-cyan-300" />}
              />
              <StatTile
                label="Losses"
                value={String(record.losses)}
                accent="from-pink-400/25 to-pink-500/5"
                ring="ring-pink-400/40"
                icon={<Target className="h-3.5 w-3.5 text-pink-300" />}
              />
              <StatTile
                label="Battles"
                value={String(record.fights)}
                accent="from-amber-400/20 to-amber-500/5"
                ring="ring-amber-300/35"
                icon={<Swords className="h-3.5 w-3.5 text-amber-300" />}
              />
            </motion.section>

            {/* Extra brag stats */}
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="grid grid-cols-2 gap-2.5"
            >
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                <div className="flex items-center gap-1.5 text-white/50">
                  <Zap className="h-3.5 w-3.5 text-amber-300" />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    Crowd votes
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-2xl font-black text-white">
                  {formatCompact(record.totalCrowdVotes)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
                <div className="flex items-center gap-1.5 text-white/50">
                  <Crown className="h-3.5 w-3.5 text-amber-300" />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    Biggest crush
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-2xl font-black text-white">
                  {record.biggestWinMargin > 0
                    ? `+${record.biggestWinMargin}`
                    : "—"}
                </p>
              </div>
            </motion.section>

            {/* By format */}
            {Object.keys(record.byMedia).length > 0 ? (
              <motion.section
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.14 }}
              >
                <h2
                  className="mb-2.5 text-sm font-black uppercase tracking-[0.18em] text-white/55"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  By format
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(record.byMedia).map(([type, stats]) => (
                    <div
                      key={type}
                      className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5"
                    >
                      <span className="text-lg">{mediaTypeEmoji(type)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-white">
                          {mediaTypeLabel(type)}
                        </p>
                        <p className="text-[10px] font-bold text-white/45">
                          {stats.wins}W · {stats.losses}L
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.section>
            ) : null}

            {/* Recent results */}
            <motion.section
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.18 }}
            >
              <h2
                className="mb-2.5 text-sm font-black uppercase tracking-[0.18em] text-white/55"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Battle log
              </h2>
              {record.results.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-10 text-center">
                  <Flame className="mx-auto mb-2 h-8 w-8 text-orange-300/50" />
                  <p className="text-sm font-bold text-white/70">No battles on the board yet</p>
                  <p className="mt-1 text-xs text-white/40">
                    Win a battle and your streak starts here — forever.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {record.results.slice(0, 20).map((r, i) => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.02 * i }}
                      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${
                        r.outcome === "win"
                          ? "border-cyan-400/25 bg-cyan-400/10"
                          : "border-pink-400/20 bg-pink-500/10"
                      }`}
                    >
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10">
                        {r.coverUrl ? (
                          <img src={r.coverUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-base">
                            {mediaTypeEmoji(r.mediaType)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-white">{r.title}</p>
                        <p className="text-[10px] font-bold text-white/45">
                          {r.myVotes}–{r.theirVotes} · {mediaTypeLabel(r.mediaType)} ·{" "}
                          {new Date(r.declaredAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black tracking-wider ${
                          r.outcome === "win"
                            ? "bg-cyan-300 text-black"
                            : "bg-pink-400 text-black"
                        }`}
                      >
                        {r.outcome === "win" ? "W" : "L"}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.section>

            <p className="pb-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
              Screenshot ready · Record never deletes
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function StatTile({
  label,
  value,
  accent,
  ring,
  icon,
}: {
  label: string;
  value: string;
  accent: string;
  ring: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl bg-gradient-to-b ${accent} p-3 ring-1 ${ring}`}
    >
      <div className="flex items-center gap-1 text-white/55">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
      </div>
      <p
        className="mt-1 font-black tabular-nums text-white"
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: "clamp(1.6rem, 7vw, 2rem)",
        }}
      >
        {value}
      </p>
    </div>
  );
}
