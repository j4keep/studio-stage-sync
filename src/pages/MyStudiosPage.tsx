import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, MapPin, Trash2, ChevronLeft, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import CreateStudioSheet from "@/components/CreateStudioSheet";

interface Studio {
  id: string;
  name: string;
  location: string;
  hourly_rate: number;
  daily_rate: number | null;
  equipment: string[];
  engineer_available: boolean;
  rating: number;
  reviews_count: number;
  created_at: string;
}

const MyStudiosPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchStudios = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("studios")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) setStudios(data as Studio[]);
    setLoading(false);
  };

  useEffect(() => { fetchStudios(); }, [user]);

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("studios").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Studio removed" });
      fetchStudios();
    }
  };

  return (
    <div className="px-4 pt-4 pb-4">
      <button onClick={() => navigate("/profile")} className="flex items-center gap-2 text-muted-foreground mb-4">
        <ChevronLeft className="w-4 h-4" />
        <span className="text-sm">Back to Profile</span>
      </button>

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-display font-bold text-foreground">My Studios</h1>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold glow-primary flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> List Studio
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : studios.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">You haven't listed any studios yet</p>
          <button onClick={() => setShowCreate(true)}
            className="px-6 py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold glow-primary">
            List Your First Studio
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {studios.map((studio) => (
            <motion.div key={studio.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-card border border-border">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">{studio.name}</h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">{studio.location}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(studio.id)}
                  className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2">
                {studio.equipment.map((e) => (
                  <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{e}</span>
                ))}
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-primary">${studio.hourly_rate}/hr</span>
                  {studio.daily_rate && (
                    <span className="text-xs text-muted-foreground">${studio.daily_rate}/day</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-primary fill-primary" />
                  <span className="text-xs text-foreground">{studio.rating}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <CreateStudioSheet open={showCreate} onClose={() => setShowCreate(false)} onCreated={fetchStudios} />
    </div>
  );
};

export default MyStudiosPage;
