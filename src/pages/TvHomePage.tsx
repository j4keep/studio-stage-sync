import { Tv, Radio, Film, Video, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TvHomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Tv className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">WHEUAT TV</h1>
          <p className="text-xs text-muted-foreground">Live podcasts, films, videos</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => navigate("/tv/podcast")}
          className="aspect-square rounded-2xl bg-card border border-border p-4 flex flex-col justify-between text-left hover:border-primary/50 hover:bg-card/80 transition-colors"
        >
          <Radio className="w-6 h-6 text-primary" />
          <div>
            <div className="font-semibold text-foreground">Live Podcasts</div>
            <div className="text-[11px] text-muted-foreground">Record & download</div>
          </div>
        </button>
        <div className="aspect-square rounded-2xl bg-card border border-border p-4 flex flex-col justify-between">
          <Film className="w-6 h-6 text-primary" />
          <div>
            <div className="font-semibold text-foreground">Short Films</div>
            <div className="text-[11px] text-muted-foreground">Upload & share</div>
          </div>
        </div>
        <div className="aspect-square rounded-2xl bg-card border border-border p-4 flex flex-col justify-between">
          <Video className="w-6 h-6 text-primary" />
          <div>
            <div className="font-semibold text-foreground">Music Videos</div>
            <div className="text-[11px] text-muted-foreground">Premiere on TV</div>
          </div>
        </div>
        <div className="aspect-square rounded-2xl bg-card border border-border p-4 flex flex-col justify-between">
          <Heart className="w-6 h-6 text-primary" />
          <div>
            <div className="font-semibold text-foreground">Support Creators</div>
            <div className="text-[11px] text-muted-foreground">Tips & donations</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TvHomePage;
