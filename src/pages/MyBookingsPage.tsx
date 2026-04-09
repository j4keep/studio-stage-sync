import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, CalendarDays, Clock, DollarSign, Star, Hash, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import RateSessionModal from "@/components/RateSessionModal";

interface BookingRow {
  id: string;
  studio_id: string;
  booking_date: string;
  hours: number;
  total_amount: number;
  status: string;
  session_code: string | null;
  created_at: string;
  cancellation_fee: number;
  payout_status: string;
  session_status: string;
  studio?: { name: string; location: string; hourly_rate: number };
  reviewed?: boolean;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  confirmed: "bg-emerald-500/15 text-emerald-400",
  cancelled: "bg-orange-500/15 text-orange-400",
  expired: "bg-zinc-500/15 text-zinc-400",
  rejected: "bg-red-500/15 text-red-400",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  confirmed: "Approved",
  cancelled: "Cancelled",
  expired: "Expired",
  rejected: "Rejected",
};

const MyBookingsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rateBooking, setRateBooking] = useState<BookingRow | null>(null);
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");

  const fetchBookings = async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await (supabase as any)
      .from("studio_bookings")
      .select("*, studios:studio_id(name, location, hourly_rate)")
      .eq("user_id", user.id)
      .order("booking_date", { ascending: false });

    if (data) {
      // Check which bookings have been reviewed
      const bookingIds = data.map((b: any) => b.id);
      let reviewedIds = new Set<string>();
      if (bookingIds.length > 0) {
        const { data: reviews } = await (supabase as any)
          .from("studio_reviews")
          .select("booking_id")
          .in("booking_id", bookingIds);
        reviewedIds = new Set((reviews || []).map((r: any) => r.booking_id));
      }

      setBookings(
        data.map((b: any) => ({
          ...b,
          studio: b.studios,
          reviewed: reviewedIds.has(b.id),
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => { fetchBookings(); }, [user]);

  const today = new Date().toISOString().split("T")[0];
  const filtered = bookings.filter((b) => {
    if (filter === "upcoming") return b.booking_date >= today && b.status !== "cancelled" && b.status !== "expired" && b.status !== "rejected";
    if (filter === "past") return b.booking_date < today || b.session_status === "completed";
    return true;
  });

  return (
    <div className="px-4 pt-4 pb-20">
      <button onClick={() => navigate("/profile")} className="flex items-center gap-2 text-muted-foreground mb-4">
        <ChevronLeft className="w-4 h-4" />
        <span className="text-sm">Back to Profile</span>
      </button>

      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-display font-bold text-foreground">My Bookings</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(["all", "upcoming", "past"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === f ? "gradient-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No bookings found</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((booking) => (
            <motion.div key={booking.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-card border border-border p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{booking.studio?.name || "Studio"}</h3>
                  <p className="text-[11px] text-muted-foreground">{booking.studio?.location}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[booking.status] || "bg-zinc-500/15 text-zinc-400"}`}>
                  {statusLabels[booking.status] || booking.status}
                </span>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="w-3 h-3" />
                  <span>{new Date(booking.booking_date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{booking.hours}h session</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <DollarSign className="w-3 h-3" />
                  <span>${booking.total_amount}</span>
                </div>
                {booking.session_code && (
                  <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                    <Hash className="w-3 h-3" />
                    <span>{booking.session_code}</span>
                  </div>
                )}
              </div>

              {/* Receipt breakdown */}
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="text-foreground">${booking.studio?.hourly_rate || 0}/hr</span>
                </div>
                <div className="flex justify-between text-[11px] mt-1">
                  <span className="text-muted-foreground">Hours</span>
                  <span className="text-foreground">{booking.hours}</span>
                </div>
                {booking.cancellation_fee > 0 && (
                  <div className="flex justify-between text-[11px] mt-1">
                    <span className="text-orange-400">Cancellation fee</span>
                    <span className="text-orange-400">${booking.cancellation_fee}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs font-bold mt-1.5 pt-1.5 border-t border-border">
                  <span className="text-foreground">Total</span>
                  <span className="text-primary">${booking.total_amount}</span>
                </div>
              </div>

              {/* Payout status */}
              <div className="flex items-center justify-between mt-2">
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                  booking.payout_status === "held" ? "bg-amber-500/10 text-amber-400" :
                  booking.payout_status === "released" ? "bg-emerald-500/10 text-emerald-400" :
                  "bg-red-500/10 text-red-400"
                }`}>
                  {booking.payout_status === "held" ? "💰 Payment Held" : booking.payout_status === "released" ? "✅ Paid" : "↩️ Refunded"}
                </span>

                {/* Rate button for completed sessions */}
                {booking.session_status === "completed" && !booking.reviewed && (
                  <button onClick={() => setRateBooking(booking)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg gradient-primary text-primary-foreground text-[11px] font-semibold">
                    <Star className="w-3 h-3" /> Rate Session
                  </button>
                )}
                {booking.reviewed && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                    <Star className="w-3 h-3 fill-emerald-400" /> Reviewed
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {rateBooking && (
        <RateSessionModal
          open={!!rateBooking}
          onClose={() => setRateBooking(null)}
          bookingId={rateBooking.id}
          studioId={rateBooking.studio_id}
          studioName={rateBooking.studio?.name || "Studio"}
          onRated={fetchBookings}
        />
      )}
    </div>
  );
};

export default MyBookingsPage;
