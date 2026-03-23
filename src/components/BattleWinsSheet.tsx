import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
}

interface BattleWin {
  id: string;
  battle_title: string;
  winner_votes: number;
  loser_votes: number;
  media_type: string;
  winner_cover_url: string | null;
  declared_at: string;
}

const BattleWinsSheet = ({ open, onClose, userId }: Props) => {
  const [wins, setWins] = useState<BattleWin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    (supabase as any)
      .from("battle_wins")
      .select("*")
      .eq("winner_id", userId)
      .order("declared_at", { ascending: false })
      .then(({ data }: any) => {
        setWins(data || []);
        setLoading(false);
      });
  }, [open, userId]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Battle Wins
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : wins.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No battle wins yet</p>
          ) : (
            wins.map((win) => (
              <div key={win.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-primary/10 flex items-center justify-center shrink-0">
                  {win.winner_cover_url ? (
                    <img src={win.winner_cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Trophy className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{win.battle_title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Won {win.winner_votes}–{win.loser_votes} · {win.media_type} · {new Date(win.declared_at).toLocaleDateString()}
                  </p>
                </div>
                <Trophy className="w-4 h-4 text-yellow-500 shrink-0" />
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default BattleWinsSheet;
