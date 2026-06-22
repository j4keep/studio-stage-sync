import { Coffee } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTakeABreak } from "@/hooks/use-take-a-break";

const TakeABreakGate = ({ children, area }: { children: React.ReactNode; area: string }) => {
  const { onBreak, setOnBreak } = useTakeABreak();
  const navigate = useNavigate();
  if (!onBreak) return <>{children}</>;
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Coffee className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-lg font-display font-bold text-foreground">You're on a break</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-xs">
        {area} is paused while Take a Break is on. You can still use Radio, Podcasts, W.Studio and your Profile.
      </p>
      <div className="flex gap-2 mt-5">
        <button
          onClick={() => setOnBreak(false)}
          className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >
          Turn off break
        </button>
        <button
          onClick={() => navigate("/settings")}
          className="h-10 px-4 rounded-xl border border-border text-sm font-medium"
        >
          Settings
        </button>
      </div>
    </div>
  );
};

export default TakeABreakGate;
