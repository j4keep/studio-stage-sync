import PlaylistsSection from "@/components/PlaylistsSection";
import YajRadioWordmark from "@/components/YajRadioWordmark";
import { ArrowLeft, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";

/** Playlist library — reached from Radio (not Profile). */
const PlaylistsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground lg:min-h-[calc(100dvh-3.5rem-1.5rem)] lg:rounded-xl lg:border lg:border-border lg:bg-card lg:pb-6 lg:shadow-sm">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur lg:static lg:bg-transparent lg:px-5 lg:pt-4">
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/radio")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Back to Radio"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <YajRadioWordmark size="sm" />
            <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">My Library · Playlists</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/my-songs?upload=1")}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#A855F7] via-[#EC4899] to-[#14B8A6] px-3 py-2 text-[11px] font-bold text-white"
          >
            <Upload className="h-3.5 w-3.5" /> Add Song
          </button>
        </div>
      </header>

      <div className="px-4 lg:px-5">
        <PlaylistsSection />
      </div>
    </div>
  );
};

export default PlaylistsPage;
