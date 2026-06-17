import { useState } from "react";
import { Star, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface RateSessionModalProps {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  studioId: string;
  studioName: string;
  onRated: () => void;
}

const RateSessionModal = ({ open, onClose, bookingId, studioId, studioName, onRated }: RateSessionModalProps) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || rating === 0) return;
    setSubmitting(true);
    const { error } = await (supabase as any).from("studio_reviews").insert({
      studio_id: studioId,
      user_id: user.id,
      booking_id: bookingId,
      rating,
      comment: comment.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: "Could not submit review", variant: "destructive" });
    } else {
      toast({ title: "Thanks for your review!", description: `You gave ${rating} star${rating > 1 ? "s" : ""}` });
      onRated();
      onClose();
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl border-border bg-background p-0" aria-describedby={undefined}>
        <div className="p-6 max-w-md mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-display font-bold text-foreground">Rate Your Session</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-card flex items-center justify-center">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Studio name */}
          <p className="text-sm text-muted-foreground mb-6 text-center">{studioName}</p>

          {/* Stars */}
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s}
                onMouseEnter={() => setHoverRating(s)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(s)}
                className="transition-transform hover:scale-110"
              >
                <Star className={`w-10 h-10 transition-colors ${
                  s <= displayRating ? "text-primary fill-primary" : "text-muted-foreground/30"
                }`} />
              </button>
            ))}
          </div>

          {/* Rating label */}
          <p className="text-center text-sm font-semibold text-foreground mb-4">
            {displayRating === 0 ? "Tap a star" :
             displayRating === 1 ? "Poor" :
             displayRating === 2 ? "Fair" :
             displayRating === 3 ? "Good" :
             displayRating === 4 ? "Great" : "Excellent!"}
          </p>

          {/* Comment */}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="How was your experience? (optional)"
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-foreground text-sm resize-none focus:outline-none focus:border-primary/50 mb-4"
          />

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm glow-primary disabled:opacity-50 transition-opacity"
          >
            {submitting ? "Submitting..." : "Submit Review"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default RateSessionModal;
