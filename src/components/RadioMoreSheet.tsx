import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Heart, ListEnd, ListStart, ListPlus, Radio, User, MessageCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface RadioMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  track: { id: string; title: string; artist_name: string; cover_url: string } | null;
  isLiked: boolean;
  onToggleLike: () => void;
  onViewComments: () => void;
}

const RadioMoreSheet = ({ open, onOpenChange, track, isLiked, onToggleLike, onViewComments }: RadioMoreSheetProps) => {
  if (!track) return null;

  const actions = [
    { icon: Heart, label: isLiked ? "Unlike" : "Like", action: () => { onToggleLike(); onOpenChange(false); }, filled: isLiked },
    { icon: ListStart, label: "Play next", action: () => { toast({ title: "Playing next", description: `"${track.title}" will play next` }); onOpenChange(false); } },
    { icon: ListEnd, label: "Play last", action: () => { toast({ title: "Added to queue", description: `"${track.title}" added to end of queue` }); onOpenChange(false); } },
    { icon: ListPlus, label: "Add to playlist", action: () => { toast({ title: "Added to Library", description: `"${track.title}" saved to your playlist` }); onOpenChange(false); } },
    { icon: Radio, label: "Start station", action: () => { toast({ title: "Starting station", description: `Playing similar tracks to "${track.title}"` }); onOpenChange(false); } },
  ];

  const secondaryActions = [
    { icon: User, label: "Go to profile", action: () => { toast({ title: "Coming soon" }); onOpenChange(false); } },
    { icon: MessageCircle, label: "View comments", action: () => { onViewComments(); onOpenChange(false); } },
  ];

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
          {actions.map((a) => (
            <button key={a.label} onClick={a.action} className="flex items-center gap-3 py-3 px-1 hover:bg-secondary/50 rounded-lg transition-colors">
              <a.icon className={`w-5 h-5 ${a.filled ? "text-primary fill-primary" : "text-foreground"}`} />
              <span className="text-sm text-foreground">{a.label}</span>
            </button>
          ))}
        </div>

        <div className="h-px bg-border my-2" />

        <div className="flex flex-col">
          {secondaryActions.map((a) => (
            <button key={a.label} onClick={a.action} className="flex items-center gap-3 py-3 px-1 hover:bg-secondary/50 rounded-lg transition-colors">
              <a.icon className="w-5 h-5 text-foreground" />
              <span className="text-sm text-foreground">{a.label}</span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default RadioMoreSheet;
