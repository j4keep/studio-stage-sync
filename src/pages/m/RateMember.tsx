import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Star, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const STAR_LABELS = ["Very poor", "Below average", "Okay", "Good", "Excellent"];

const TAGS = [
  { label: "Paid on time", positive: true },
  { label: "Communicated clearly", positive: true },
  { label: "Reliable", positive: true },
  { label: "Paid late", positive: false },
  { label: "Hard to reach", positive: false },
];

const RateMember = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const rateeId = searchParams.get("rateeId");
  const rateeName = searchParams.get("rateeName") || "Member";
  const contextId = searchParams.get("contextId"); // circle_id
  const circleName = searchParams.get("circleName") || "Savings Circle";

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    if (!rateeId || !contextId) {
      toast.error("Missing required information");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create the rating
      const { error: ratingError } = await supabase
        .from("user_ratings")
        .insert({
          ratee_id: rateeId,
          rater_id: user.id,
          context_type: "savings_circle",
          context_id: contextId,
          score: rating,
          comment: comment.trim() || null,
          tags: selectedTags.join(",") || null,
        });

      if (ratingError) throw ratingError;

      // Get or create reputation summary
      const { data: existingRep } = await supabase
        .from("user_reputation_summary")
        .select("*")
        .eq("user_id", rateeId)
        .single();

      // Calculate new savings score
      const oldAvg = existingRep?.savings_score || 0;
      const oldCount = existingRep?.savings_ratings_count || 0;
      const newAvg = (oldAvg * oldCount + rating) / (oldCount + 1);
      
      const updates = {
        savings_score: newAvg,
        savings_ratings_count: oldCount + 1,
        reliability_score: Math.round(newAvg * 20), // Convert 0-5 to 0-100
        last_updated: new Date().toISOString(),
      };

      if (existingRep) {
        const { error: updateError } = await supabase
          .from("user_reputation_summary")
          .update(updates)
          .eq("user_id", rateeId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("user_reputation_summary")
          .insert({
            user_id: rateeId,
            ...updates,
          });

        if (insertError) throw insertError;
      }

      toast.success("Thanks! Your rating helps the Atchup community.");
      navigate(-1);
    } catch (error) {
      console.error("Error submitting rating:", error);
      toast.error("Failed to submit rating. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Rate Member</h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Member Header */}
        <div className="text-center space-y-3">
          <Avatar className="w-20 h-20 mx-auto">
            <AvatarFallback className="text-2xl bg-primary/10 text-primary">
              {getInitials(rateeName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-bold">Rate {rateeName}</h2>
            <p className="text-muted-foreground text-sm mt-1">
              From: {circleName}
            </p>
          </div>
        </div>

        {/* Star Rating */}
        <div className="bg-card rounded-lg p-6 space-y-4 border border-border">
          <p className="text-center font-medium">
            How was your experience with this member?
          </p>
          
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="transition-transform hover:scale-110 active:scale-95"
              >
                <Star
                  className={`h-10 w-10 ${
                    star <= (hoverRating || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>

          {rating > 0 && (
            <p className="text-center text-sm font-medium text-primary">
              {STAR_LABELS[rating - 1]}
            </p>
          )}
        </div>

        {/* Quick Tags */}
        <div className="space-y-3">
          <p className="font-medium text-sm">Quick feedback (optional)</p>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tag) => (
              <Badge
                key={tag.label}
                variant={selectedTags.includes(tag.label) ? "default" : "outline"}
                className={`cursor-pointer transition-colors ${
                  selectedTags.includes(tag.label)
                    ? tag.positive
                      ? "bg-green-500 hover:bg-green-600"
                      : "bg-orange-500 hover:bg-orange-600"
                    : ""
                }`}
                onClick={() => toggleTag(tag.label)}
              >
                {tag.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div className="space-y-2">
          <label className="font-medium text-sm">
            Anything you want to add? (optional)
          </label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share a short review to help others decide."
            rows={4}
            className="resize-none"
          />
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? "Submitting..." : "Submit rating"}
          </Button>
          
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="w-full"
            disabled={isSubmitting}
          >
            Skip for now
          </Button>
        </div>

        {/* Footer Info */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Ratings help the Atchup community understand who is reliable and
            pays on time. This does not affect any external credit score.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RateMember;