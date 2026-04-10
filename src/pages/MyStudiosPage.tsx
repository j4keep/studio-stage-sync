import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, MapPin, Trash2, ChevronLeft, Star, Pencil, CheckCircle2, XCircle, CalendarDays, Ban, DollarSign, Clock, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import CreateStudioSheet from "@/components/CreateStudioSheet";
import EditStudioSheet from "@/components/EditStudioSheet";

interface Booking {
  id: string;
  studio_id: string;
  user_id: string;
  booking_date: string;
  hours: number;
  total_amount: number;
  status: string;
  session_code: string | null;
  created_at: string;
  approval_deadline: string | null;
  cancelled_at: string | null;
  cancellation_fee: number;
  payout_status: string;
  session_status?: string;
  profile?: { display_name: string | null; avatar_url: string | null };
  studio_name?: string;
}

interface Studio {
  id: string;
  name: string;
  location: string;
  hourly_rate: number;
  daily_rate: number | null;
  equipment: string[];
  engineer_available: boolean;
  rating: number;
  reviews_count: number;
  created_at: string;
  description: string | null;
  auto_accept?: boolean;
}

const CANCELLATION_FEE_RATE = 0.10;

const MyStudiosPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editStudio, setEditStudio] = useState<Studio | null>(null);
  const [photoMap, setPhotoMap] = useState<Map<string, string>>(new Map());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Check for expired bookings on load
  useEffect(() => {
    const checkExpired = async () => {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        await fetch(`https://${projectId}.supabase.co/functions/v1/expire-bookings`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
      } catch {}
    };
    checkExpired();
  }, []);

  const fetchStudios = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("studios")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setStudios(data as Studio[]);
      // Fetch first photo for each studio
      const ids = data.map((s: any) => s.id);
      if (ids.length > 0) {
        const { data: photos } = await (supabase as any)
          .from("studio_photos")
          .select("studio_id, photo_url")
          .in("studio_id", ids)
          .order("display_order", { ascending: true });
        const map = new Map<string, string>();
        (photos ?? []).forEach((p: any) => {
          if (!map.has(p.studio_id)) map.set(p.studio_id, p.photo_url);
        });
        setPhotoMap(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchStudios(); }, [user]);

  const fetchBookings = async () => {
    if (!user || studios.length === 0) return;
    setLoadingBookings(true);
    const studioIds = studios.map((s) => s.id);
    const { data } = await (supabase as any)
      .from("studio_bookings")
      .select("*")
      .in("studio_id", studioIds)
      .order("created_at", { ascending: false });

    if (data) {
      const userIds = [...new Set((data as Booking[]).map((b) => b.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);
      const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      const studioNameMap = new Map(studios.map((s) => [s.id, s.name]));

      setBookings(
        (data as Booking[]).map((b) => ({
          ...b,
          profile: profileMap.get(b.user_id) as Booking["profile"],
          studio_name: studioNameMap.get(b.studio_id),
        }))
      );
    }
    setLoadingBookings(false);
  };

  useEffect(() => {
    if (studios.length > 0) fetchBookings();
  }, [studios]);

  const handleBookingAction = async (bookingId: string, newStatus: "confirmed" | "rejected") => {
    setUpdatingId(bookingId);
    const { error } = await (supabase as any)
      .from("studio_bookings")
      .update({ status: newStatus })
      .eq("id", bookingId);
    setUpdatingId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: newStatus === "confirmed" ? "Booking approved!" : "Booking rejected" });
      fetchBookings();
    }
  };

  const handleCancel = async (booking: Booking) => {
    setUpdatingId(booking.id);
    const fee = +(booking.total_amount * CANCELLATION_FEE_RATE).toFixed(2);
    const { error } = await (supabase as any)
      .from("studio_bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_fee: fee,
        payout_status: "refunded",
      })
      .eq("id", booking.id);
    setUpdatingId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Booking cancelled. $${fee} cancellation fee applied.` });
      fetchBookings();
    }
  };

  const handleMarkCompleted = async (bookingId: string) => {
    setUpdatingId(bookingId);
    const { error } = await (supabase as any)
      .from("studio_bookings")
      .update({
        session_status: "awaiting_confirmation",
        engineer_completed_at: new Date().toISOString(),
      })
      .eq("id", bookingId);
    setUpdatingId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Session marked complete — awaiting artist confirmation", description: "Payment will be released once the artist confirms, or auto-released after 48 hours." });
      fetchBookings();
    }
  };

  const handleNoShow = async (booking: Booking) => {
    setUpdatingId(booking.id);
    const { error } = await (supabase as any)
      .from("studio_bookings")
      .update({ session_status: "no_show", payout_status: "refunded" })
      .eq("id", booking.id);
    setUpdatingId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "No-show reported — artist will be refunded." });
      fetchBookings();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("studios").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Studio removed" });
      fetchStudios();
    }
  };

  return (
    <div className="px-4 pt-4 pb-4">
      <button onClick={() => navigate("/profile")} className="flex items-center gap-2 text-muted-foreground mb-4">
        <ChevronLeft className="w-4 h-4" />
        <span className="text-sm">Back to Profile</span>
      </button>

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-display font-bold text-foreground">My Studios</h1>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold glow-primary flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> List Studio
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : studios.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">You haven't listed any studios yet</p>
          <button onClick={() => setShowCreate(true)}
            className="px-6 py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold glow-primary">
            List Your First Studio
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {studios.map((studio) => {
            const thumb = photoMap.get(studio.id);
            return (
              <motion.div key={studio.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-card border border-border overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-foreground">{studio.name}</h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">{studio.location}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setEditStudio(studio)}
                        className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-all">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(studio.id)}
                        className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {studio.equipment.map((e) => (
                      <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{e}</span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-primary">${studio.hourly_rate}/hr</span>
                      {studio.daily_rate && (
                        <span className="text-xs text-muted-foreground">${studio.daily_rate}/day</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-primary fill-primary" />
                      <span className="text-xs text-foreground">{studio.rating}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <CreateStudioSheet open={showCreate} onClose={() => setShowCreate(false)} onCreated={fetchStudios} />
      <EditStudioSheet open={!!editStudio} onClose={() => setEditStudio(null)} onUpdated={fetchStudios} studio={editStudio} />

      {studios.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-display font-bold text-foreground">Booking Requests</h2>
          </div>

          {loadingBookings ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : bookings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No bookings yet</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {bookings.map((booking) => {
                const isPending = booking.status === "pending";
                const isConfirmed = booking.status === "confirmed";
                const isCancelled = booking.status === "cancelled";
                const isExpired = booking.status === "expired";
                const isSessionPending = booking.session_status === "pending" || !booking.session_status;
                const deadlineMs = booking.approval_deadline ? new Date(booking.approval_deadline).getTime() - Date.now() : null;
                const deadlineMin = deadlineMs ? Math.max(0, Math.ceil(deadlineMs / 60000)) : null;
                return (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl bg-card border border-border p-3.5"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {booking.profile?.display_name ?? "Unknown Artist"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {booking.studio_name} · {new Date(booking.booking_date).toLocaleDateString()} · {new Date(booking.booking_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {booking.hours}h
                        </p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isPending
                          ? "bg-amber-500/15 text-amber-400"
                          : isConfirmed
                          ? "bg-emerald-500/15 text-emerald-400"
                          : isCancelled
                          ? "bg-orange-500/15 text-orange-400"
                          : isExpired
                          ? "bg-zinc-500/15 text-zinc-400"
                          : "bg-red-500/15 text-red-400"
                      }`}>
                        {isPending ? "Pending" : isConfirmed ? "Approved" : isCancelled ? "Cancelled" : isExpired ? "Expired" : "Rejected"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary">${booking.total_amount}</span>
                      <div className="flex items-center gap-2">
                        {booking.payout_status && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                            booking.payout_status === "held" ? "bg-amber-500/10 text-amber-400" :
                            booking.payout_status === "released" ? "bg-emerald-500/10 text-emerald-400" :
                            "bg-red-500/10 text-red-400"
                          }`}>
                            {booking.payout_status === "held" ? "💰 Held" : booking.payout_status === "released" ? "✅ Paid" : "↩️ Refunded"}
                          </span>
                        )}
                        {booking.session_code && (
                          <span className="text-[10px] font-mono text-muted-foreground">Code: {booking.session_code}</span>
                        )}
                      </div>
                    </div>

                    {/* Deadline countdown for pending */}
                    {isPending && deadlineMin !== null && (
                      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-amber-400">
                        <Clock className="w-3 h-3" />
                        <span>{deadlineMin > 0 ? `${deadlineMin} min left to respond` : "Deadline passed — will expire soon"}</span>
                      </div>
                    )}

                    {/* Cancellation fee display */}
                    {isCancelled && booking.cancellation_fee > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-orange-400">
                        <DollarSign className="w-3 h-3" />
                        <span>Cancellation fee: ${booking.cancellation_fee}</span>
                      </div>
                      )}

                    {isPending && (
                      <div className="flex gap-2 mt-3">
                        <button
                          disabled={updatingId === booking.id}
                          onClick={() => handleBookingAction(booking.id, "confirmed")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-600/30 transition disabled:opacity-40"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          disabled={updatingId === booking.id}
                          onClick={() => handleBookingAction(booking.id, "rejected")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-600/20 text-red-400 text-xs font-semibold hover:bg-red-600/30 transition disabled:opacity-40"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}

                    {/* Cancel + session management for confirmed bookings */}
                    {isConfirmed && (
                      <div className="flex flex-col gap-2 mt-3">
                        {booking.session_status === "awaiting_confirmation" && (
                          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2.5">
                            <p className="text-[11px] text-blue-300 font-semibold">⏳ Awaiting artist confirmation</p>
                            <p className="text-[10px] text-blue-300/60 mt-0.5">Auto-confirms in 48h if artist doesn't respond</p>
                          </div>
                        )}
                        {booking.session_status === "disputed" && (
                          <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-2.5">
                            <p className="text-[11px] text-purple-300 font-semibold">⚖️ Session Disputed</p>
                            <p className="text-[10px] text-purple-300/60 mt-0.5">Artist reported no-show. Under admin review.</p>
                          </div>
                        )}
                        {isSessionPending && (
                          <div className="flex gap-2">
                            <button
                              disabled={updatingId === booking.id}
                              onClick={() => handleMarkCompleted(booking.id)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-600/30 transition disabled:opacity-40"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Session Completed
                            </button>
                            <button
                              disabled={updatingId === booking.id}
                              onClick={() => handleNoShow(booking)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-600/20 text-amber-400 text-xs font-semibold hover:bg-amber-600/30 transition disabled:opacity-40"
                            >
                              <Ban className="w-3.5 h-3.5" /> No-Show
                            </button>
                          </div>
                        )}
                        {!["awaiting_confirmation", "disputed", "completed"].includes(booking.session_status || "") && (
                          <button
                            disabled={updatingId === booking.id}
                            onClick={() => handleCancel(booking)}
                            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-600/10 text-red-400 text-xs font-semibold hover:bg-red-600/20 transition disabled:opacity-40"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Cancel Booking (10% fee)
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MyStudiosPage;
