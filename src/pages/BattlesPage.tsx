import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Plus, Play, Pause, Heart, Send, Trophy, Music, Video, ArrowLeft, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProGate } from "@/hooks/use-pro-gate";
import ProGateModal from "@/components/ProGateModal";
import CreateBattleSheet from "@/components/CreateBattleSheet";
import BattleCard from "@/components/BattleCard";

const BattlesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPro, requirePro, showProModal, gatedFeature, closeProModal, activatePro } = useProGate();
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

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

  const handleCreate = () => {
    requirePro("Battles", () => setShowCreate(true));
  };

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <Swords className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-display font-bold text-foreground">Artist Battles</h1>
        <div className="flex-1" />
        <button onClick={handleCreate} className="px-3 py-1.5 rounded-lg gradient-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Create Battle
        </button>
      </div>

      <p className="text-xs text-muted-foreground mb-6">
        Challenge another artist, upload your track or video, and let the people vote! 🔥
      </p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : battles.length === 0 ? (
        <div className="text-center py-16">
          <Swords className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">No battles yet. Be the first to throw down!</p>
          <button onClick={handleCreate} className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-bold">
            Start a Battle
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {battles.map((battle: any) => (
            <BattleCard key={battle.id} battle={battle} />
          ))}
        </div>
      )}

      <CreateBattleSheet open={showCreate} onOpenChange={setShowCreate} />
      <ProGateModal open={showProModal} onClose={closeProModal} onSubscribe={activatePro} featureName={gatedFeature} />
    </div>
  );
};

export default BattlesPage;
