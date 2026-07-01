import { useEffect, useState, type ReactNode } from "react";

export const useTakeABreak = () => {
  const [onBreak, setOnBreak] = useState(
    () => localStorage.getItem("wheuat_take_a_break") === "true",
  );

  useEffect(() => {
    const sync = () => setOnBreak(localStorage.getItem("wheuat_take_a_break") === "true");
    window.addEventListener("wheuat-take-a-break-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("wheuat-take-a-break-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return onBreak;
};

const BreakGuard = ({ children }: { children: ReactNode }) => {
  const onBreak = useTakeABreak();

  if (onBreak) {
    return (
      <div className="px-6 pt-16 pb-24 max-w-md mx-auto text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 mx-auto mb-4 flex items-center justify-center text-2xl">☕</div>
        <h2 className="text-lg font-display font-bold text-foreground mb-2">You're on a break</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Feed, Battles and social discovery are paused. Podcast, Radio, Studio and Profile are still available.
        </p>
        <a href="#/settings" className="inline-block px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
          Manage in Settings
        </a>
      </div>
    );
  }

  return <>{children}</>;
};

export default BreakGuard;
