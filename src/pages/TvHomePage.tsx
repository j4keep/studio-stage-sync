import { Tv, Radio, Film, Video, Heart } from "lucide-react";

const TvHomePage = () => {
  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Tv className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">WHEUAT TV</h1>
          <p className="text-xs text-muted-foreground">Live podcasts, films, music videos & creator support</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="aspect-square rounded-2xl bg-card border border-border p-4 flex flex-col justify-between">
          <Radio className="w-6 h-6 text-primary" />
          <div>
            <div className="font-semibold text-foreground">Live Podcasts</div>
            <div className="text-[11px] text-muted-foreground">Record & download</div>
          </div>
        </div>
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

      <div className="mt-8 p-4 rounded-2xl bg-muted/30 border border-border">
        <p className="text-sm text-foreground font-medium mb-1">Coming soon</p>
        <p className="text-xs text-muted-foreground">
          WHEUAT TV is being built. You'll be able to host live podcast rooms, record sessions, upload short films and music videos, and accept tips — all from your channel.
        </p>
      </div>
    </div>
  );
};

export default TvHomePage;
