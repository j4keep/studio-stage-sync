import { useMemo, useState } from "react";
import { Swords, Plus, ArrowLeft, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProGate } from "@/hooks/use-pro-gate";
import ProGateModal from "@/components/ProGateModal";
import CreateBattleSheet from "@/components/CreateBattleSheet";
import BattleCard from "@/components/BattleCard";
import BattleArenaRecord from "@/components/battle/BattleArenaRecord";
import { partitionBattleFeed } from "@/lib/battle-ui";
import { buildBattleArenaRecord, type BattleWinRow } from "@/lib/battle-records";

const BattlesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { requirePro, showProModal, gatedFeature, closeProModal, activatePro } = useProGate();
  const [showCreate, setShowCreate] = useState(false);
  const [showRecord, setShowRecord] = useState(false);

  const { data: battles = [], isLoading } = useQuery({
    queryKey: ["battles"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("battles")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const battleIds = useMemo(() => battles.map((b: any) => b.id).filter(Boolean), [battles]);

  const { data: voteRows = [] } = useQuery({
    queryKey: ["battles-vote-totals", battleIds.join(",")],
    queryFn: async () => {
      if (!battleIds.length) return [];
      const { data } = await supabase
        .from("battle_votes")
        .select("battle_id, user_id, voted_for")
        .in("battle_id", battleIds);
      return data || [];
    },
    enabled: battleIds.length > 0,
  });

  const voteTotals = useMemo(() => {
    const map: Record<string, number> = {};
    const battleById = new Map((battles as any[]).map((b) => [b.id, b]));
    for (const v of voteRows as any[]) {
      const b = battleById.get(v.battle_id);
      if (!b) continue;
      // Count audience + cross-votes; never count a participant voting for themselves.
      if (v.user_id === b.challenger_id && v.voted_for === b.challenger_id) continue;
      if (b.opponent_id && v.user_id === b.opponent_id && v.voted_for === b.opponent_id) continue;
      map[v.battle_id] = (map[v.battle_id] || 0) + 1;
    }
    return map;
  }, [battles, voteRows]);

  const sections = useMemo(
    () => partitionBattleFeed(battles as any[], voteTotals),
    [battles, voteTotals],
  );

  const { data: myWinRows = [] } = useQuery({
    queryKey: ["battle-arena-record-preview", user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as BattleWinRow[];
      const { data } = await (supabase as any)
        .from("battle_wins")
        .select("*")
        .or(`winner_id.eq.${user.id},loser_id.eq.${user.id}`)
        .order("declared_at", { ascending: false })
        .limit(80);
      return (data || []) as BattleWinRow[];
    },
    enabled: !!user?.id,
  });

  const streakPreview = useMemo(() => {
    if (!user?.id) return 0;
    return buildBattleArenaRecord(user.id, myWinRows).currentStreak;
  }, [user?.id, myWinRows]);

  const handleCreate = () => {
    requirePro("Battles", () => setShowCreate(true));
  };

  const openRecord = () => {
    if (!user?.id) {
      toast.error("Sign in to view your Winning Street record");
      return;
    }
    setShowRecord(true);
  };

  return (
    <div className="px-4 pb-8 pt-4">
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft className="h-4 w-4 text-foreground" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" />
            <h1 className="font-display text-lg font-bold text-foreground">Creators Battle</h1>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Live matchups. Real crowd. One winner.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={openRecord}
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#0b0b10] text-orange-300 shadow-[0_0_18px_rgba(251,146,60,0.45)] ring-2 ring-orange-400/70"
            aria-label="Open Winning Street record"
            title="Winning Street"
          >
            <Flame className="h-4 w-4 fill-orange-400/50" />
            {streakPreview > 0 ? (
              <span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-cyan-300 to-pink-400 px-1 text-[9px] font-black text-black ring-1 ring-black/40">
                {streakPreview > 99 ? "99+" : streakPreview}
              </span>
            ) : null}
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold gradient-primary text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Create
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : battles.length === 0 ? (
        <div className="py-16 text-center">
          <Swords className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="mb-4 text-sm text-muted-foreground">
            No battles yet. Throw the first challenge.
          </p>
          <button
            onClick={handleCreate}
            className="rounded-lg px-4 py-2 text-sm font-bold gradient-primary text-primary-foreground"
          >
            Start a Battle
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.id}>
              <h2 className="mb-3 font-display text-base font-bold tracking-tight text-foreground">
                {section.title}
              </h2>
              <div className="space-y-4">
                {section.items.map((battle: any) => (
                  <BattleCard key={`${section.id}-${battle.id}`} battle={battle} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <CreateBattleSheet open={showCreate} onOpenChange={setShowCreate} />
      <BattleArenaRecord open={showRecord} onClose={() => setShowRecord(false)} />
      <ProGateModal
        open={showProModal}
        onClose={closeProModal}
        onSubscribe={activatePro}
        featureName={gatedFeature}
      />
    </div>
  );
};

export default BattlesPage;
