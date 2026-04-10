import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, CalendarDays, Clock, DollarSign, Star, Hash, AlertTriangle, XCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
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
  engineer_completed_at: string | null;
  artist_confirmed: boolean | null;
  artist_responded_at: string | null;
  studio?: { name: string; location: string; hourly_rate: number; user_id: string };
  reviewed?: boolean;
  has_strike?: boolean;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  confirmed: "bg-emerald-500/15 text-emerald-400",
  cancelled: "bg-orange-500/15 text-orange-400",
  expired: "bg-zinc-500/15 text-zinc-400",
  rejected: "bg-red-500/15 text-red-400",
  no_show: "bg-red-500/15 text-red-400",
  awaiting_confirmation: "bg-blue-500/15 text-blue-400",
  disputed: "bg-purple-500/15 text-purple-400",
  completed: "bg-emerald-500/15 text-emerald-400",
};

const getStatusLabel = (booking: BookingRow) => {
  if (booking.session_status === "no_show") return "🚫 No-Show";
  if (booking.session_status === "disputed") return "⚖️ Disputed";
  if (booking.session_status === "awaiting_confirmation") return "🔔 Awaiting Your Confirmation";
  if (booking.session_status === "completed") return "✅ Completed";
  const labels: Record<string, string> = {
    pending: "Pending",
    confirmed: "Approved",
    cancelled: "Cancelled",
    expired: "Expired",
    rejected: "Rejected",
  };
  return labels[booking.status] || booking.status;
};

const getStatusColor = (booking: BookingRow) => {
  if (booking.session_status === "no_show") return statusColors.no_show;
  if (booking.session_status === "disputed") return statusColors.disputed;
  if (booking.session_status === "awaiting_confirmation") return statusColors.awaiting_confirmation;
  if (booking.session_status === "completed") return statusColors.completed;
  return statusColors[booking.status] || "bg-zinc-500/15 text-zinc-400";
};

const MyBookingsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rateBooking, setRateBooking] = useState<BookingRow | null>(null);
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchBookings = async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await (supabase as any)
      .from("studio_bookings")
      .select("*, studios:studio_id(name, location, hourly_rate, user_id)")
      .eq("user_id", user.id)
      .order("booking_date", { ascending: false });

    if (data) {
      const bookingIds = data.map((b: any) => b.id);
      let reviewedIds = new Set<string>();
      let strikeIds = new Set<string>();

      if (bookingIds.length > 0) {
        const [reviewsRes, strikesRes] = await Promise.all([
          (supabase as any).from("studio_reviews").select("booking_id").in("booking_id", bookingIds),
          (supabase as any).from("no_show_strikes").select("booking_id").in("booking_id", bookingIds),
        ]);
        reviewedIds = new Set((reviewsRes.data || []).map((r: any) => r.booking_id));
        strikeIds = new Set((strikesRes.data || []).map((r: any) => r.booking_id));
      }

      setBookings(
        data.map((b: any) => ({
          ...b,
          studio: b.studios,
          reviewed: reviewedIds.has(b.id),
          has_strike: strikeIds.has(b.id),
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => { fetchBookings(); }, [user]);

  const today = new Date().toISOString().split("T")[0];
  const filtered = bookings.filter((b) => {
    if (filter === "upcoming") return b.booking_date >= today && b.status !== "cancelled" && b.status !== "expired" && b.status !== "rejected";
    if (filter === "past") return b.booking_date < today || b.session_status === "completed" || b.session_status === "disputed";
    return true;
  });

  const handleCancel = async (booking: BookingRow) => {
    if (!user) return;
    const fee = Math.round(booking.total_amount * 0.1 * 100) / 100;
    const confirmed = window.confirm(
      `Cancel this booking? A 10% cancellation fee of $${fee} will apply.`
    );
    if (!confirmed) return;

    setActionLoading(booking.id);
    const { error } = await (supabase as any)
      .from("studio_bookings")
      .update({
        status: "cancelled",
        cancellation_fee: fee,
        cancelled_at: new Date().toISOString(),
        payout_status: "refunded",
      })
      .eq("id", booking.id)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to cancel booking");
    } else {
      toast.success(`Booking cancelled. $${fee} cancellation fee applied.`);
      fetchBookings();
    }
    setActionLoading(null);
  };

  /** Artist confirms the session was completed — triggers payout release */
  const handleConfirmCompletion = async (booking: BookingRow) => {
    if (!user) return;
    setActionLoading(booking.id);
    const { error } = await (supabase as any)
      .from("studio_bookings")
      .update({
        artist_confirmed: true,
        artist_responded_at: new Date().toISOString(),
      })
      .eq("id", booking.id)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to confirm session");
    } else {
      toast.success("Session confirmed! Payment released to engineer.");
      fetchBookings();
    }
    setActionLoading(null);
  };

  /** Artist disputes — says engineer didn't show up */
  const handleDisputeNoShow = async (booking: BookingRow) => {
    if (!user || !booking.studio) return;
    const confirmed = window.confirm(
      "Report that this session did NOT happen? This will create a dispute and a support ticket will be auto-created for admin review. Payment will stay held until resolved."
    );
    if (!confirmed) return;

    setActionLoading(booking.id);
    const { error } = await (supabase as any)
      .from("studio_bookings")
      .update({
        artist_confirmed: false,
        artist_responded_at: new Date().toISOString(),
      })
      .eq("id", booking.id)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to file dispute");
    } else {
      toast.success("Dispute filed. A support ticket has been created for review.");
      fetchBookings();
    }
    setActionLoading(null);
  };

  /** Legacy direct no-show report (for when engineer hasn't marked complete at all) */
  const handleReportNoShow = async (booking: BookingRow) => {
    if (!user || !booking.studio) return;
    const confirmed = window.confirm(
      "Report this engineer as a no-show? Your payment will be fully refunded and a strike will be recorded against this studio."
    );
    if (!confirmed) return;

    setActionLoading(booking.id);
    const { error: strikeError } = await (supabase as any)
      .from("no_show_strikes")
      .insert({
        engineer_id: booking.studio.user_id,
        booking_id: booking.id,
        studio_id: booking.studio_id,
        reported_by: user.id,
      });

    if (strikeError) {
      toast.error(strikeError.message?.includes("unique") ? "No-show already reported" : "Failed to report no-show");
      setActionLoading(null);
      return;
    }

    await (supabase as any)
      .from("studio_bookings")
      .update({ session_status: "no_show", payout_status: "refunded", cancellation_fee: 0 })
      .eq("id", booking.id);

    toast.success("No-show reported. Full refund issued and strike recorded.");
    fetchBookings();
    setActionLoading(null);
  };

  const canCancel = (b: BookingRow) =>
    (b.status === "pending" || b.status === "confirmed") &&
    !["completed", "no_show", "disputed", "awaiting_confirmation"].includes(b.session_status);

  const canReportNoShow = (b: BookingRow) =>
    b.status === "confirmed" &&
    !["completed", "no_show", "disputed", "awaiting_confirmation"].includes(b.session_status) &&
    !b.has_strike &&
    b.booking_date <= today;

  const needsConfirmation = (b: BookingRow) =>
    b.session_status === "awaiting_confirmation" && b.artist_confirmed === null;

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
              className={`rounded-xl bg-card border p-4 ${needsConfirmation(booking) ? "border-blue-500/40 ring-1 ring-blue-500/20" : "border-border"}`}>
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{booking.studio?.name || "Studio"}</h3>
                  <p className="text-[11px] text-muted-foreground">{booking.studio?.location}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getStatusColor(booking)}`}>
                  {getStatusLabel(booking)}
                </span>
              </div>

              {/* Awaiting confirmation banner */}
              {needsConfirmation(booking) && (
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 mb-3">
                  <p className="text-xs text-blue-300 font-semibold mb-1">🔔 Engineer marked this session as completed</p>
                  <p className="text-[11px] text-blue-300/70">Please confirm if the session happened, or report a no-show if it didn't. Auto-confirms in 48 hours.</p>
                </div>
              )}

              {/* Details */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="w-3 h-3" />
                  <span>{new Date(booking.booking_date).toLocaleDateString()} · {new Date(booking.booking_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
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

              {/* Receipt */}
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

              {/* Confirm / Dispute buttons (two-sided confirmation) */}
              {needsConfirmation(booking) && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  <button
                    onClick={() => handleConfirmCompletion(booking)}
                    disabled={actionLoading === booking.id}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {actionLoading === booking.id ? "Confirming..." : "Confirm Session"}
                  </button>
                  <button
                    onClick={() => handleDisputeNoShow(booking)}
                    disabled={actionLoading === booking.id}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-semibold disabled:opacity-50"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {actionLoading === booking.id ? "Filing..." : "Dispute — No-Show"}
                  </button>
                </div>
              )}

              {/* Disputed status message */}
              {booking.session_status === "disputed" && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-purple-400">
                  <ShieldAlert className="w-3 h-3" /> Under review — a support ticket has been created
                </div>
              )}

              {/* Cancel & No-Show (for bookings where engineer hasn't acted yet) */}
              {(canCancel(booking) || canReportNoShow(booking)) && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  {canCancel(booking) && (
                    <button
                      onClick={() => handleCancel(booking)}
                      disabled={actionLoading === booking.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400 text-[11px] font-semibold disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {actionLoading === booking.id ? "Cancelling..." : "Cancel Booking"}
                    </button>
                  )}
                  {canReportNoShow(booking) && (
                    <button
                      onClick={() => handleReportNoShow(booking)}
                      disabled={actionLoading === booking.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-[11px] font-semibold disabled:opacity-50"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {actionLoading === booking.id ? "Reporting..." : "Report No-Show"}
                    </button>
                  )}
                </div>
              )}

              {booking.has_strike && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-400">
                  <AlertTriangle className="w-3 h-3" /> No-show reported — full refund issued
                </div>
              )}
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
