import { useState, useEffect } from "react";
import { Star, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface MemberReputationPreviewProps {
  userId: string;
  displayName: string;
}

const MemberReputationPreview = ({ userId, displayName }: MemberReputationPreviewProps) => {
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

  const getReliabilityInfo = (score: number) => {
    if (score >= 90) return { label: "Very dependable", color: "text-green-500", icon: CheckCircle };
    if (score >= 70) return { label: "Dependable", color: "text-green-400", icon: CheckCircle };
    if (score >= 50) return { label: "Building trust", color: "text-yellow-500", icon: AlertTriangle };
    return { label: "New member", color: "text-gray-400", icon: AlertTriangle };
  };

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-800 rounded-lg p-4 h-24" />
    );
  }

  const reliabilityScore = reputation?.reliability_score || 50;
  const savingsScore = reputation?.savings_score || 0;
  const savingsCount = reputation?.savings_ratings_count || 0;
  const info = getReliabilityInfo(reliabilityScore);
  const IconComponent = info.icon;

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-white font-medium">{displayName}</h4>
          <div className={`flex items-center gap-1 text-sm ${info.color}`}>
            <IconComponent className="w-4 h-4" />
            <span>{info.label}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-purple-400">{reliabilityScore}</div>
          <div className="text-xs text-gray-400">/ 100</div>
        </div>
      </div>

      <div className="space-y-2">
        {/* Reliability Bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Reliability Score</span>
            <span>{reliabilityScore}%</span>
          </div>
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
              style={{ width: `${reliabilityScore}%` }}
            />
          </div>
        </div>

        {/* Savings Rating */}
        {savingsCount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Savings Circle Rating:</span>
            <div className="flex items-center gap-1 text-yellow-500">
              <Star className="w-4 h-4 fill-yellow-500" />
              <span>{savingsScore.toFixed(1)}</span>
              <span className="text-gray-500">({savingsCount})</span>
            </div>
          </div>
        )}

        {savingsCount === 0 && (
          <p className="text-xs text-gray-500 text-center py-1">
            No savings circle history yet
          </p>
        )}
      </div>
    </div>
  );
};

export default MemberReputationPreview;
