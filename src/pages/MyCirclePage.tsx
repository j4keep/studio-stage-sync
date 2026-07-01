import { useNavigate } from "react-router-dom";
import { ArrowLeft, HelpCircle, Copy, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MyCirclePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["my-circle-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await (supabase as any)
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: Boolean(user?.id),
  });

  const displayName = profile?.display_name || "Creator";

  return (
    <div className="min-h-[100dvh] bg-background text-foreground pb-24">
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="flex-1 text-base font-bold truncate">{displayName}&apos;s My Circle</h1>
          <button type="button" className="p-2 text-muted-foreground">
            <Copy className="w-5 h-5" />
          </button>
          <button type="button" className="p-2 text-muted-foreground">
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <span>You can now set up emotes for your My Circle.</span>
          <span className="ml-auto">›</span>
        </div>
      </div>

      <div className="grid grid-cols-3 border-b border-border">
        {[
          { label: "Fans", value: "0" },
          { label: "Heart Me", value: "0" },
          { label: "Go Popular", value: "0" },
        ].map((stat) => (
          <div key={stat.label} className="py-4 text-center border-r border-border last:border-r-0">
            <p className="text-lg font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-0.5 justify-center">
              {stat.label}
              {stat.label === "Fans" && <Info className="w-3 h-3" />}
            </p>
          </div>
        ))}
      </div>

      <div className="flex border-b border-border">
        {["Top fans", "My Circle zone"].map((tab, index) => (
          <button
            key={tab}
            type="button"
            className={`flex-1 py-3 text-sm font-semibold border-b-2 ${
              index === 0 ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
        <div className="text-6xl mb-4">❤️</div>
        <h2 className="text-base font-bold mb-2">Viewers can send a Heart Me to join your My Circle</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Invite your viewers to join your My Circle and embark on a journey together.
        </p>
      </div>
    </div>
  );
};

export default MyCirclePage;
