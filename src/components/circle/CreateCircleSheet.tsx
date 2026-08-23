import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { CIRCLE_TYPE_META, CircleType } from "@/lib/circles";

type Props = {
  open: boolean;
  onClose: () => void;
};

const ORDER: CircleType[] = ["friends", "local", "gaming", "fitness", "networking", "creator", "private", "custom"];

/** "What are you creating?" — the first screen of the Create flow. Dating Profile sits
 *  alongside the 8 group Circle types here since that's where the user goes looking for
 *  it, but it isn't a Circle underneath (see src/lib/circles.ts) — it routes to its own
 *  setup flow once that's built. */
export default function CreateCircleSheet({ open, onClose }: Props) {
  const navigate = useNavigate();

  const pick = (type: CircleType) => {
    onClose();
    navigate(`/circle/create/${type}`);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-background">
        <SheetHeader>
          <SheetTitle>What are you creating?</SheetTitle>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-2 gap-3 pb-8">
          <button
            type="button"
            onClick={() => {
              onClose();
              toast({ title: "Dating profiles are coming soon", description: "This is being built right now — check back shortly." });
            }}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3 py-6 text-center transition active:scale-[0.98]"
          >
            <Heart className="h-6 w-6 text-rose-500" />
            <span className="text-[12.5px] font-bold">Dating Profile</span>
          </button>

          {ORDER.map((type) => {
            const meta = CIRCLE_TYPE_META[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => pick(type)}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card px-3 py-6 text-center transition active:scale-[0.98]"
              >
                <span className="text-2xl">{meta.emoji}</span>
                <span className="text-[12.5px] font-bold">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
