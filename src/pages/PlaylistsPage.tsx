import PlaylistsSection from "@/components/PlaylistsSection";
import { ArrowLeft, ListMusic } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PlaylistsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="px-4 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <ListMusic className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-display font-bold text-foreground">My Playlists</h1>
        </div>
      </div>
      <PlaylistsSection />
    </div>
  );
};

export default PlaylistsPage;
