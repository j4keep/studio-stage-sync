import { ReactNode } from "react";
import { Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSafetyBalance } from "@/hooks/useSafetyBalance";
import AgeAssuranceGate from "@/components/safety/AgeAssuranceGate";
import YouthWelcomeGate from "@/components/safety/YouthWelcomeGate";
import SocialBalanceGuard from "@/components/safety/SocialBalanceGuard";
import ThemePickerSheet from "@/components/ThemePickerSheet";

const Under13Blocked = ({ onSignOut }: { onSignOut: () => void }) => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
      <Shield className="w-8 h-8 text-primary" />
    </div>
    <h1 className="text-2xl font-display font-bold text-foreground text-center mb-2">
      Not available for under 13
    </h1>
    <p className="text-sm text-muted-foreground text-center mb-6 max-w-sm">
      YAJ social accounts are currently available for users 13 and older. This helps us meet child-privacy obligations and keep Youth Mode focused on teens.
    </p>
    <button
      type="button"
      onClick={onSignOut}
      className="px-5 py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-bold"
    >
      Sign out
    </button>
  </div>
);

type Props = {
  children: ReactNode;
  showThemePicker?: boolean;
  onThemeComplete?: () => void;
};

/**
 * After terms: DOB → Youth welcome → theme → Social Balance enforcement.
 */
const SafetyRouteShell = ({ children, showThemePicker, onThemeComplete }: Props) => {
  const { signOut } = useAuth();
  const { policy, loading, ensurePolicyFromDob, markYouthWelcomeSeen } = useSafetyBalance();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (policy?.age_band === "under_13") {
    return (
      <Under13Blocked
        onSignOut={async () => {
          await signOut();
        }}
      />
    );
  }

  if (!policy?.date_of_birth || policy.age_band === "unknown") {
    return (
      <AgeAssuranceGate
        onComplete={async (dob) => {
          await ensurePolicyFromDob(dob);
        }}
      />
    );
  }

  if (policy.youth_mode && !policy.youth_welcome_seen_at) {
    return <YouthWelcomeGate onContinue={() => { void markYouthWelcomeSeen(); }} />;
  }

  if (showThemePicker) {
    return (
      <div className="min-h-screen bg-black text-white max-w-lg mx-auto relative flex items-center justify-center px-6 dark">
        <ThemePickerSheet isOnboarding onComplete={() => onThemeComplete?.()} />
      </div>
    );
  }

  return <SocialBalanceGuard>{children}</SocialBalanceGuard>;
};

export default SafetyRouteShell;
