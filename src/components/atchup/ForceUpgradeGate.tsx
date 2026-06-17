import { useNavigate } from "react-router-dom";
import { Trophy, Star, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCircleLimits } from "@/hooks/useCircleLimits";

interface ForceUpgradeGateProps {
  children: React.ReactNode;
}

const ForceUpgradeGate = ({ children }: ForceUpgradeGateProps) => {
  const navigate = useNavigate();
  const { mustUpgrade, isVerifiedPlus, loading, completedCirclesCount } = useCircleLimits();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // If user is Verified+ or doesn't need to upgrade, show children
  if (isVerifiedPlus || !mustUpgrade) {
    return <>{children}</>;
  }

  // Block the entire page with upgrade prompt
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="bg-gradient-to-br from-yellow-500 to-amber-500 rounded-full p-5">
            <Trophy className="h-10 w-10 text-white" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            Upgrade Required
          </h1>
          <p className="text-muted-foreground">
            You've completed {completedCirclesCount} savings circles — amazing work! 
            To continue using Atchup, please upgrade to Verified+.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 text-left space-y-3">
          <p className="font-semibold flex items-center gap-2 text-foreground">
            <Star className="h-5 w-5 text-yellow-500" />
            Verified+ — $10/mo
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              "Up to 5 active circles",
              "Up to 100 members per circle",
              "Group & direct messaging",
              "Donate My Payout feature",
              "Create & donate to fundraisers",
              "Verified badge",
              "Priority support",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <Button
          onClick={() => navigate("/m/verified-plus-upgrade")}
          className="w-full h-12 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white font-semibold text-base"
        >
          Upgrade to Verified+
        </Button>
      </div>
    </div>
  );
};

export default ForceUpgradeGate;
