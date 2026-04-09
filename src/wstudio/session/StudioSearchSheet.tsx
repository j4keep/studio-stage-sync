import { useEffect, useState } from "react";
import { Search, MapPin, Star, Wifi, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
  user_id: string;
  description: string | null;
}

interface StudioProfile {
  display_name: string | null;
  avatar_url: string | null;
}

export function StudioSearchSheet({
  open,
  onClose,
  onBooked,
}: {
  open: boolean;
  onClose: () => void;
  onBooked: (code: string) => void;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [studios, setStudios] = useState<(Studio & { profile?: StudioProfile })[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<(Studio & { profile?: StudioProfile }) | null>(null);
  const [hours, setHours] = useState(2);
  const [bookingDate, setBookingDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - (d.getMinutes() % 15), 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchStudios();
  }, [open]);

  const fetchStudios = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("studios")
      .select("*")
      .order("rating", { ascending: false });

    if (data) {
      // Fetch profiles for each studio owner
      const userIds = [...new Set(data.map((s) => s.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.user_id, p])
      );

      setStudios(
        data.map((s) => ({
          ...s,
          equipment: s.equipment ?? [],
          engineer_available: s.engineer_available ?? false,
          rating: Number(s.rating ?? 0),
          reviews_count: s.reviews_count ?? 0,
          description: s.description,
          profile: profileMap.get(s.user_id) as StudioProfile | undefined,
        }))
      );
    }
    setLoading(false);
  };

  const filtered = studios.filter((s) => {
    const q = query.toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.location.toLowerCase().includes(q) ||
      (s.profile?.display_name ?? "").toLowerCase().includes(q)
    );
  });

  const handleBook = async () => {
    if (!user || !selected) return;
    setBooking(true);

    const total = selected.hourly_rate * hours;
    const { data, error } = await (supabase as any)
      .from("studio_bookings")
      .insert({
        studio_id: selected.id,
        user_id: user.id,
        booking_date: new Date(bookingDate).toISOString().slice(0, 10),
        hours,
        total_amount: total,
        status: "confirmed",
        session_status: "pending",
      })
      .select("session_code")
      .single();

    setBooking(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const code = data?.session_code as string;
    toast.success(`Session booked! Your code: ${code}`);
    onBooked(code);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl border-zinc-800 bg-zinc-950 p-0">
        <SheetHeader className="border-b border-zinc-800 px-4 py-3">
          <SheetTitle className="text-sm font-semibold text-white">
            {selected ? "Book Session" : "Find a Studio"}
          </SheetTitle>
        </SheetHeader>

        {!selected ? (
          <div className="flex flex-col gap-3 overflow-y-auto p-4" style={{ maxHeight: "calc(85vh - 56px)" }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search studios or engineers..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-amber-600/60"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">No studios found</p>
            ) : (
              filtered.map((studio) => (
                <button
                  key={studio.id}
                  onClick={() => setSelected(studio)}
                  className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-left transition hover:border-amber-700/40"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">{studio.name}</h3>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                        <Wifi className="h-3 w-3" />
                        <span>Remote Studio</span>
                        {studio.profile?.display_name && (
                          <>
                            <span className="text-zinc-600">·</span>
                            <span>{studio.profile.display_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-amber-400">
                      <Star className="h-3 w-3 fill-amber-400" />
                      <span className="text-xs font-medium">{studio.rating}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {studio.equipment.slice(0, 4).map((e) => (
                      <span key={e} className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                        {e}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
                    <span className="text-sm font-bold text-amber-300">${studio.hourly_rate}/hr</span>
                    {studio.engineer_available && (
                      <span className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                        Engineer Available
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4 overflow-y-auto p-4" style={{ maxHeight: "calc(85vh - 56px)" }}>
            <button
              onClick={() => setSelected(null)}
              className="self-start flex items-center gap-1 text-sm font-semibold text-white hover:text-amber-300 transition"
            >
              ← Back to results
            </button>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <h3 className="text-base font-semibold text-white">{selected.name}</h3>
              <p className="mt-0.5 text-xs text-zinc-400">
                {selected.profile?.display_name ?? "Engineer"} · Remote Studio
              </p>
              {selected.description && (
                <p className="mt-2 text-xs text-zinc-500">{selected.description}</p>
              )}
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                <Clock className="h-3 w-3" /> Date & Time
              </label>
              <input
                type="datetime-local"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-amber-600/60"
              />
            </div>

            <div>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Session Length
              </span>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4].map((h) => (
                  <button
                    key={h}
                    onClick={() => setHours(h)}
                    className={`rounded-lg border px-4 py-2 text-xs font-semibold transition ${
                      hours === h
                        ? "border-amber-500/60 bg-amber-950/50 text-amber-100"
                        : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black/30 p-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-widest text-zinc-500">Rate</div>
                  <div className="text-sm font-medium text-zinc-200">
                    ${selected.hourly_rate} <span className="text-zinc-500">/ hour</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] font-semibold uppercase tracking-widest text-amber-200/70">Total</div>
                  <div className="font-mono text-xl font-semibold tabular-nums text-amber-100">
                    ${(selected.hourly_rate * hours).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleBook}
              disabled={booking || !user}
              className="w-full rounded-xl border border-amber-600/40 bg-gradient-to-b from-amber-700/90 to-amber-950 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-950/40 transition hover:from-amber-600 hover:to-amber-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {booking ? "Booking..." : !user ? "Sign in to book" : "Confirm & Get Session Code"}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
