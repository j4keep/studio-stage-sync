import { Tv, Radio, Mic2, ShoppingBag, Building2, FolderHeart } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TILES = [
  { label: "Live Podcasts", desc: "Record, edit & publish", icon: Radio, path: "/tv/podcast" },
  { label: "WHEUAT.TV", desc: "Manage your videos", icon: Tv, path: "/tv/wheuat" },
  { label: "Recording Studio", desc: "Remote sessions", icon: Mic2, path: "/wstudio/session/join" },
  { label: "Store", desc: "Sell your merch", icon: ShoppingBag, path: "/my-store" },
  { label: "Studios", desc: "List your room", icon: Building2, path: "/my-studios" },
  { label: "Support Creators", desc: "Creator projects", icon: FolderHeart, path: "/my-projects" },
];

const TvHomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Tv className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">W.STUDIO</h1>
          <p className="text-xs text-muted-foreground">Creator workspace</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {TILES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.label}
              type="button"
              onClick={() => navigate(t.path)}
              className="aspect-square rounded-2xl bg-card border border-border p-4 flex flex-col justify-between text-left hover:border-primary/50 hover:bg-card/80 transition-colors"
            >
              <Icon className="w-6 h-6 text-primary" />
              <div>
                <div className="font-semibold text-foreground text-sm">{t.label}</div>
                <div className="text-[11px] text-muted-foreground">{t.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TvHomePage;
