import { Tv, Radio, Film, Mic2, Heart, ShoppingBag, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TvHomePage = () => {
  const navigate = useNavigate();

  const CARDS: { label: string; sub: string; Icon: typeof Tv; path?: string }[] = [
    { label: "Live Podcasts", sub: "Record & download", Icon: Radio, path: "/tv/podcast" },
    { label: "WHEUAT.TV", sub: "Watch & upload", Icon: Film, path: "/tv/wheuat" },
    { label: "Recording Studio", sub: "Remote sessions", Icon: Mic2, path: "/wstudio/session/join" },
    { label: "Support Creators", sub: "Tips & donations", Icon: Heart, path: "/dollar-club" },
    { label: "Store", sub: "Sell merch & beats", Icon: ShoppingBag, path: "/my-store" },
    { label: "Studios", sub: "Book or list a studio", Icon: Building2, path: "/studios" },
  ];

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Tv className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">W.Studio</h1>
          <p className="text-xs text-muted-foreground">Create, record, and publish</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {CARDS.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => c.path && navigate(c.path)}
            className="aspect-square rounded-2xl bg-card border border-border p-4 flex flex-col justify-between text-left hover:border-primary/50 hover:bg-card/80 transition-colors"
          >
            <c.Icon className="w-6 h-6 text-primary" />
            <div>
              <div className="font-semibold text-foreground">{c.label}</div>
              <div className="text-[11px] text-muted-foreground">{c.sub}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TvHomePage;
