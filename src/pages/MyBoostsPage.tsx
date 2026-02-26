import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Rocket, TrendingUp, Eye, MousePointerClick, Pause, Play, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface Boost {
  id: string;
  content_type: string;
  content_id: string;
  budget: number;
  duration_days: number;
  start_date: string;
  end_date: string;
  status: string;
  impressions: number;
  clicks: number;
  content_title?: string;
}

const MyBoostsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: boosts = [], isLoading } = useQuery({
    queryKey: ["my-boosts", user?.id],
    queryFn: async (): Promise<Boost[]> => {
      if (!user) return [];
      const { data } = await (supabase as any)
        .from("boosts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (!data) return [];

      // Resolve content titles
      const titleMap: Record<string, string> = {};
      for (const b of data) {
        const table = b.content_type === "store_product" ? "store_products" : `${b.content_type}s`;
        const nameCol = b.content_type === "studio" ? "name" : "title";
        const { data: item } = await (supabase as any).from(table).select(nameCol).eq("id", b.content_id).single();
        titleMap[b.content_id] = item?.[nameCol] || "Unknown";
      }
      return data.map((b: any) => ({ ...b, content_title: titleMap[b.content_id] }));
    },
    staleTime: 30_000,
    enabled: !!user,
  });

  const toggleStatus = async (boost: Boost) => {
    const newStatus = boost.status === "active" ? "paused" : "active";
    await (supabase as any).from("boosts").update({ status: newStatus }).eq("id", boost.id);
    qc.invalidateQueries({ queryKey: ["my-boosts"] });
    toast({ title: newStatus === "active" ? "Boost resumed ▶️" : "Boost paused ⏸️" });
  };

  const cancelBoost = async (id: string) => {
    await (supabase as any).from("boosts").update({ status: "cancelled" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["my-boosts"] });
    toast({ title: "Boost cancelled" });
  };

  const activeBoosts = boosts.filter((b) => b.status === "active" || b.status === "paused");
  const pastBoosts = boosts.filter((b) => b.status === "completed" || b.status === "cancelled");
  const totalSpent = boosts.reduce((sum, b) => sum + b.budget, 0);
  const totalImpressions = boosts.reduce((sum, b) => sum + b.impressions, 0);

  const statusColor: Record<string, string> = {
    active: "bg-green-500/20 text-green-400",
    paused: "bg-yellow-500/20 text-yellow-400",
    completed: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/20 text-destructive",
  };

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate("/profile")} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="text-lg font-display font-bold text-foreground">My Boosts</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: "Total Spent", value: `$${totalSpent.toFixed(0)}`, icon: Rocket },
          { label: "Impressions", value: totalImpressions.toLocaleString(), icon: Eye },
          { label: "Active", value: String(activeBoosts.filter(b => b.status === "active").length), icon: TrendingUp },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded-xl bg-card border border-border text-center">
            <s.icon className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-sm font-bold text-primary">{s.value}</p>
            <p className="text-[9px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Loading...</div>
      ) : boosts.length === 0 ? (
        <div className="py-12 text-center">
          <Rocket className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No boosts yet</p>
          <p className="text-[10px] text-muted-foreground mt-1">Boost your content from Songs, Videos, Store, or Studios</p>
        </div>
      ) : (
        <>
          {activeBoosts.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Active Campaigns</p>
              <div className="flex flex-col gap-2">
                {activeBoosts.map((b, i) => (
                  <motion.div key={b.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className="p-3 rounded-xl bg-card border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Rocket className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{b.content_title}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{b.content_type.replace("_", " ")} · {b.duration_days}d · ${b.budget}</p>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold capitalize ${statusColor[b.status]}`}>
                        {b.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {b.impressions}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <MousePointerClick className="w-3 h-3" /> {b.clicks}
                      </span>
                      <div className="flex-1" />
                      <button onClick={() => toggleStatus(b)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                        {b.status === "active" ? <Pause className="w-3 h-3 text-foreground" /> : <Play className="w-3 h-3 text-foreground" />}
                      </button>
                      <button onClick={() => cancelBoost(b.id)} className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center">
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {pastBoosts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Past Campaigns</p>
              <div className="flex flex-col gap-1.5">
                {pastBoosts.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border opacity-60">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{b.content_title}</p>
                      <p className="text-[10px] text-muted-foreground">${b.budget} · {b.impressions} impressions</p>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold capitalize ${statusColor[b.status]}`}>
                      {b.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MyBoostsPage;
