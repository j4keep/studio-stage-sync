import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Ban,
  Bell,
  Coffee,
  Flag,
  Lock,
  LogOut,
  MapPin,
  Moon,
  Shield,
  Timer,
  Trash2,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSafetyBalance } from "@/hooks/useSafetyBalance";
import {
  effectiveSocialMinutesUsed,
  formatMinutes,
  isDetoxActive,
  isWithinQuietHours,
} from "@/lib/safety-balance";
import MarketplaceSafetyTips from "@/components/marketplace/MarketplaceSafetyTips";

const SafetyCenterPage = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { policy } = useSafetyBalance();

  const used = policy ? effectiveSocialMinutesUsed(policy) : 0;
  const limit = policy?.daily_social_limit_minutes;
  const detox = policy ? isDetoxActive(policy) : false;
  const quiet = policy ? isWithinQuietHours(policy) : false;

  const rows: { icon: ReactNode; label: string; desc?: string; onClick: () => void }[] = [
    {
      icon: <Timer className="w-4 h-4" />,
      label: "Screen time & Digital Balance",
      desc: limit != null ? `${formatMinutes(used)} / ${formatMinutes(limit)} today` : "Optional limits & detox",
      onClick: () => navigate("/safety/balance"),
    },
    {
      icon: <Moon className="w-4 h-4" />,
      label: "Quiet hours",
      desc: quiet ? "Quiet hours are active now" : policy?.quiet_hours_enabled ? "Scheduled" : "Off",
      onClick: () => navigate("/safety/balance"),
    },
    {
      icon: <Coffee className="w-4 h-4" />,
      label: "Social Detox",
      desc: detox ? "Detox active" : "Pause feed & discovery",
      onClick: () => navigate("/safety/balance"),
    },
    {
      icon: <Users className="w-4 h-4" />,
      label: policy?.youth_mode ? "Parent / guardian" : "Parent dashboard",
      desc: policy?.youth_mode
        ? policy.parent_account_id
          ? "Parent connected"
          : "Connect a parent"
        : "Link a teen account you manage",
      onClick: () => navigate("/safety/parent"),
    },
    {
      icon: <Lock className="w-4 h-4" />,
      label: "Who can message me",
      desc: policy?.dm_permission?.replace(/_/g, " ") || "everyone",
      onClick: () => navigate("/safety/balance"),
    },
    {
      icon: <MapPin className="w-4 h-4" />,
      label: "Location",
      desc: policy?.location_permission === "off" ? "Off" : policy?.location_permission || "Off",
      onClick: () => navigate("/settings"),
    },
    {
      icon: <Ban className="w-4 h-4" />,
      label: "Blocking",
      onClick: () => navigate("/settings/blocking"),
    },
    {
      icon: <Flag className="w-4 h-4" />,
      label: "Report & support",
      onClick: () => navigate("/help"),
    },
    {
      icon: <Bell className="w-4 h-4" />,
      label: "Notifications",
      onClick: () => navigate("/settings"),
    },
    {
      icon: <Trash2 className="w-4 h-4" />,
      label: "Account deletion",
      onClick: () => navigate("/settings"),
    },
  ];

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">YAJ Safety Center</h1>
          <p className="text-[11px] text-muted-foreground">
            {policy?.youth_mode ? "YAJ Youth protections are on" : "Safety & Digital Balance"}
          </p>
        </div>
      </div>

      {policy?.youth_mode && (
        <div className="mb-5 p-4 rounded-2xl bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-primary" />
            <p className="text-sm font-bold text-foreground">YAJ Youth</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Connect without getting consumed. Private profile, quieter nights, daily social limits, and safer messaging are built in.
          </p>
        </div>
      )}

      <div className="mb-5">
        <MarketplaceSafetyTips variant="panel" defaultOpen />
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <button
            key={row.label}
            type="button"
            onClick={row.onClick}
            className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              {row.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{row.label}</p>
              {row.desc && <p className="text-[10px] text-muted-foreground truncate">{row.desc}</p>}
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={async () => {
          await signOut();
          navigate("/auth");
        }}
        className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm text-muted-foreground"
      >
        <LogOut className="w-4 h-4" />
        Log out
      </button>
    </div>
  );
};

export default SafetyCenterPage;
