import { Link } from "react-router-dom";
import { Coffee, Moon, Timer } from "lucide-react";
import type { SocialLockReason } from "@/lib/safety-balance";
import { formatQuietResumeLabel } from "@/lib/safety-balance";

type Props = {
  reason: SocialLockReason;
  quietEnd?: string | null;
  limitMinutes?: number | null;
};

const copy: Record<Exclude<SocialLockReason, null>, { title: string; body: string; icon: typeof Moon }> = {
  quiet_hours: {
    title: "YAJ is quiet right now",
    body: "Your social feed will be ready again soon. Messages, Marketplace, and account tools stay available.",
    icon: Moon,
  },
  daily_limit: {
    title: "You've reached today's social time",
    body: "Feed and social discovery are paused for now. Utility features like messages, bookings, and Marketplace stay open.",
    icon: Timer,
  },
  detox: {
    title: "Social Detox Active",
    body: "Feed, recommendations, and public social discovery are hidden. Messages, Marketplace, Local Help, and settings stay available.",
    icon: Coffee,
  },
};

const SocialBalanceLockScreen = ({ reason, quietEnd, limitMinutes }: Props) => {
  if (!reason) return null;
  const c = copy[reason];
  const Icon = c.icon;
  const extra =
    reason === "quiet_hours"
      ? `Ready again around ${formatQuietResumeLabel(quietEnd)}.`
      : reason === "daily_limit" && limitMinutes
        ? `Today's limit: ${limitMinutes} minutes.`
        : null;

  return (
    <div className="px-6 pt-16 pb-24 max-w-md mx-auto text-center">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 mx-auto mb-4 flex items-center justify-center text-primary">
        <Icon className="w-7 h-7" />
      </div>
      <h2 className="text-lg font-display font-bold text-foreground mb-2">{c.title}</h2>
      <p className="text-sm text-muted-foreground mb-2">{c.body}</p>
      {extra && <p className="text-xs text-muted-foreground mb-4">{extra}</p>}
      <div className="flex flex-col gap-2 items-center">
        <Link
          to="/safety"
          className="inline-block px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
        >
          Open Safety Center
        </Link>
        <Link to="/explore" className="text-xs text-muted-foreground underline">
          Go to Explore utilities
        </Link>
      </div>
    </div>
  );
};

export default SocialBalanceLockScreen;
