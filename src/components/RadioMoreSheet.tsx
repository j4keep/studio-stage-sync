import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Heart, BookmarkPlus, MessageCircle, UserCircle, ChevronLeft, ListMusic } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { usePlaylists } from "@/contexts/PlaylistContext";

interface RadioMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  track: { id: string; title: string; artist_name: string; cover_url: string; user_id?: string; audio_url?: string } | null;
  isLiked: boolean;
  onToggleLike: () => void;
  onViewComments: () => void;
}

const RadioMoreSheet = ({ open, onOpenChange, track, isLiked, onToggleLike, onViewComments }: RadioMoreSheetProps) => {
  const navigate = useNavigate();
  const { playlists, addItemToPlaylist } = usePlaylists();
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);

  if (!track) return null;

  const handleGoToProfile = () => {
    onOpenChange(false);
    if (track.user_id) {
      navigate(`/profile/${track.user_id}`);
    } else {
      toast({ title: "Profile unavailable" });
    }
  };

  const handleSelectPlaylist = (playlistId: string, playlistName: string) => {
    addItemToPlaylist(playlistId, {
      id: track.id,
      title: track.title,
      artist: track.artist_name,
      type: "song",
      image: track.cover_url,
      duration: "",
      audioUrl: track.audio_url || undefined,
    });
    toast({ title: "Added to playlist", description: `"${track.title}" added to ${playlistName}` });
    setShowPlaylistPicker(false);
    onOpenChange(false);
  };

  const handleViewComments = () => {
    onViewComments();
    onOpenChange(false);
  };

  const handleToggleLike = () => {
    onToggleLike();
    onOpenChange(false);
  };

  const handleClose = () => {
    setShowPlaylistPicker(false);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="bg-card border-border rounded-t-2xl pb-8">
        {/* Track info */}
        <div className="flex items-center gap-3 mb-5 mt-2">
          <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
            <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{track.title}</p>
            <p className="text-xs text-muted-foreground">{track.artist_name}</p>
          </div>
        </div>

        {showPlaylistPicker ? (
          /* Playlist picker view */
          <div className="flex flex-col">
            <button onClick={() => setShowPlaylistPicker(false)} className="flex items-center gap-2 py-2 px-2 mb-2 text-sm text-muted-foreground">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">Select a playlist</p>
            {playlists.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No playlists yet. Create one in your Library first.</p>
            ) : (
              playlists.map(pl => (
                <button
                  key={pl.id}
                  onClick={() => handleSelectPlaylist(pl.id, pl.name)}
                  className="flex items-center gap-3 py-3 px-2 hover:bg-secondary/50 rounded-lg transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-primary/10 flex-shrink-0 grid grid-cols-2 grid-rows-2 gap-px">
                    {pl.items.slice(0, 4).map((item, i) => (
                      <img key={i} src={item.image} alt="" className="w-full h-full object-cover" />
                    ))}
                    {Array.from({ length: Math.max(0, 4 - pl.items.length) }).map((_, i) => (
                      <div key={`e-${i}`} className="w-full h-full bg-primary/10 flex items-center justify-center">
                        <ListMusic className="w-2 h-2 text-primary/30" />
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-foreground">{pl.name}</p>
                    <p className="text-[10px] text-muted-foreground">{pl.items.length} items</p>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          /* Main actions view */
          <div className="flex flex-col">
            <button onClick={handleToggleLike} className="flex items-center gap-3 py-3.5 px-2 hover:bg-secondary/50 rounded-lg transition-colors">
              <Heart className={`w-5 h-5 ${isLiked ? "text-primary fill-primary" : "text-foreground"}`} />
              <span className="text-sm text-foreground">{isLiked ? "Unlike" : "Like"}</span>
            </button>

            <button onClick={() => setShowPlaylistPicker(true)} className="flex items-center gap-3 py-3.5 px-2 hover:bg-secondary/50 rounded-lg transition-colors">
              <BookmarkPlus className="w-5 h-5 text-foreground" />
              <span className="text-sm text-foreground">Add to playlist</span>
            </button>

            <div className="h-px bg-border my-1" />

            <button onClick={handleGoToProfile} className="flex items-center gap-3 py-3.5 px-2 hover:bg-secondary/50 rounded-lg transition-colors">
              <UserCircle className="w-5 h-5 text-foreground" />
              <span className="text-sm text-foreground">Go to artist profile</span>
            </button>

            <button onClick={handleViewComments} className="flex items-center gap-3 py-3.5 px-2 hover:bg-secondary/50 rounded-lg transition-colors">
              <MessageCircle className="w-5 h-5 text-foreground" />
              <span className="text-sm text-foreground">View comments</span>
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default RadioMoreSheet;
