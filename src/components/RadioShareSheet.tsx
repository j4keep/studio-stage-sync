import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Send, Copy, MessageSquare, Share2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface RadioShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  track: { title: string; artist_name: string; cover_url: string } | null;
}

const SHARE_OPTIONS = [
  { icon: Send, label: "Message", action: "message" },
  { icon: Copy, label: "Copy link", action: "copy" },
  { icon: MessageSquare, label: "SMS", action: "sms" },
  { icon: Share2, label: "More", action: "more" },
];

const RadioShareSheet = ({ open, onOpenChange, track }: RadioShareSheetProps) => {
  if (!track) return null;

  const handleShare = async (action: string) => {
    const shareText = `🎵 ${track.title} by ${track.artist_name} on WHEUAT Radio`;
    const shareUrl = window.location.href;

    switch (action) {
      case "copy":
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        toast({ title: "Link copied!", description: "Share it with your friends" });
        onOpenChange(false);
        break;
      case "message":
      case "sms":
        window.open(`sms:?body=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`);
        break;
      case "more":
        if (navigator.share) {
          try {
            await navigator.share({ title: track.title, text: shareText, url: shareUrl });
          } catch {}
        } else {
          await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
          toast({ title: "Link copied!" });
        }
        onOpenChange(false);
        break;
      default:
        toast({ title: "Coming soon", description: `${action} sharing will be available soon` });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-border rounded-t-2xl pb-8">
        {/* Track info */}
        <div className="flex items-center gap-3 mb-6 mt-2">
          <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
            <img src={track.cover_url} alt="" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{track.title}</p>
            <p className="text-xs text-muted-foreground">{track.artist_name}</p>
          </div>
        </div>

        {/* Share options */}
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-3">Share</p>
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4">
          {SHARE_OPTIONS.map((opt) => (
            <button
              key={opt.action}
              onClick={() => handleShare(opt.action)}
              className="flex flex-col items-center gap-1.5 min-w-[60px]"
            >
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                <opt.icon className="w-5 h-5 text-foreground" />
              </div>
              <span className="text-[10px] text-muted-foreground">{opt.label}</span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default RadioShareSheet;
