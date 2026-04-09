import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import RateSessionModal from "./RateSessionModal";

/**
 * Checks on mount if user has any completed but unrated studio bookings.
 * If found, auto-opens the rating modal for the first one.
 */
const UnratedSessionPopup = () => {
  const { user } = useAuth();
  const [unrated, setUnrated] = useState<{
    bookingId: string;
    studioId: string;
    studioName: string;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;

    const check = async () => {
      // Get completed bookings
      const { data: completedBookings } = await (supabase as any)
        .from("studio_bookings")
        .select("id, studio_id, studios:studio_id(name)")
        .eq("user_id", user.id)
        .eq("session_status", "completed")
        .order("created_at", { ascending: false });

      if (!completedBookings || completedBookings.length === 0) return;

      const bookingIds = completedBookings.map((b: any) => b.id);
      const { data: reviews } = await (supabase as any)
        .from("studio_reviews")
        .select("booking_id")
        .in("booking_id", bookingIds);

      const reviewedIds = new Set((reviews || []).map((r: any) => r.booking_id));
      const first = completedBookings.find((b: any) => !reviewedIds.has(b.id));

      if (first) {
        // Check if we already dismissed this session recently
        const dismissKey = `rate_dismissed_${first.id}`;
        const lastDismissed = localStorage.getItem(dismissKey);
        if (lastDismissed) {
          const hrs = (Date.now() - parseInt(lastDismissed)) / 3600000;
          if (hrs < 24) return; // Don't re-prompt within 24h
        }

        setUnrated({
          bookingId: first.id,
          studioId: first.studio_id,
          studioName: first.studios?.name || "Studio",
        });
      }
    };

    // Small delay so it doesn't flash immediately on page load
    const timer = setTimeout(check, 2000);
    return () => clearTimeout(timer);
  }, [user]);

  if (!unrated || dismissed) return null;

  const handleClose = () => {
    localStorage.setItem(`rate_dismissed_${unrated.bookingId}`, String(Date.now()));
    setDismissed(true);
  };

  return (
    <RateSessionModal
      open
      onClose={handleClose}
      bookingId={unrated.bookingId}
      studioId={unrated.studioId}
      studioName={unrated.studioName}
      onRated={() => setDismissed(true)}
    />
  );
};

export default UnratedSessionPopup;
