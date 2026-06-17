import { useState, useEffect } from "react";
import { Star, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface ReputationScoreProps {
  userId: string;
}

const ReputationScore = ({ userId }: ReputationScoreProps) => {
  const [reputation, setReputation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReputation();
  }, [userId]);

  const loadReputation = async () => {
    try {
      const { data } = await supabase
        .from("user_reputation_summary")
        .select("*")
        .eq("user_id", userId)
        .single();

      setReputation(data);
    } catch (error) {
      console.error("Error loading reputation:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  // Default to 5.0 score if no reputation data exists
  const displayReputation = reputation || {
    reliability_score: 100,
    savings_score: 5.0,
    savings_ratings_count: 0,
  };

  const getReliabilityLabel = (score: number) => {
    if (score >= 90) return "✅ Very dependable";
    if (score >= 70) return "✅ Dependable";
    if (score >= 50) return "⚠️ Building trust";
    return "⚠️ New member";
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
          <h3 className="text-sm font-bold text-white">Atchup Reliability</h3>
          <HoverCard>
            <HoverCardTrigger asChild>
              <button className="text-white/70 hover:text-white transition-colors">
                <Info className="h-3.5 w-3.5" />
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-80">
              <p className="text-sm">
                Your Atchup Reliability Score reflects how consistently you
                complete savings circles and pay on time. It is
                not a credit score and is only used inside the app to help
                members build trust.
              </p>
            </HoverCardContent>
          </HoverCard>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">
            {getReliabilityLabel(displayReputation.reliability_score)}
          </span>
          <span className="text-sm font-bold text-yellow-400">
            {displayReputation.savings_score.toFixed(1)} ★
          </span>
        </div>
      </div>
    </div>
  );
};

export default ReputationScore;
