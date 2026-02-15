import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Heart, BookmarkPlus, MessageCircle, UserCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface RadioMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  track: { id: string; title: string; artist_name: string; cover_url: string; user_id?: string } | null;
  isLiked: boolean;
  onToggleLike: () => void;
  onViewComments: () => void;
}

const RadioMoreSheet = ({ open, onOpenChange, track, isLiked, onToggleLike, onViewComments }: RadioMoreSheetProps) => {
  const navigate = useNavigate();

  if (!track) return null;

  const handleGoToProfile = () => {
    onOpenChange(false);
    if (track.user_id) {
      navigate(`/profile/${track.user_id}`);
    } else {
      toast({ title: "Profile unavailable" });
    }
  };

  const handleAddToPlaylist = () => {
    toast({ title: "Added to Library", description: `"${track.title}" saved to your playlist` });
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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

        {/* Actions */}
        <div className="flex flex-col">
          <button onClick={handleToggleLike} className="flex items-center gap-3 py-3.5 px-2 hover:bg-secondary/50 rounded-lg transition-colors">
            <Heart className={`w-5 h-5 ${isLiked ? "text-primary fill-primary" : "text-foreground"}`} />
            <span className="text-sm text-foreground">{isLiked ? "Unlike" : "Like"}</span>
          </button>

          <button onClick={handleAddToPlaylist} className="flex items-center gap-3 py-3.5 px-2 hover:bg-secondary/50 rounded-lg transition-colors">
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
      </SheetContent>
    </Sheet>
  );
};

export default RadioMoreSheet;
