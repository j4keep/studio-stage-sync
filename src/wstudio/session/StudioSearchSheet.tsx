import { useEffect, useState } from "react";
import { Search, Star, Wifi, Clock, ChevronLeft, ChevronRight, X, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

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

interface StudioPhoto {
  id: string;
  photo_url: string;
  display_order: number | null;
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
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [studios, setStudios] = useState<(Studio & { profile?: StudioProfile; photos?: StudioPhoto[] })[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<(Studio & { profile?: StudioProfile; photos?: StudioPhoto[] }) | null>(null);
  const [hours, setHours] = useState(2);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [expandedPhotos, setExpandedPhotos] = useState<StudioPhoto[] | null>(null);
  const [expandedIndex, setExpandedIndex] = useState(0);
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

  useEffect(() => {
    setPhotoIndex(0);
  }, [selected]);

  const fetchStudios = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("studios")
      .select("*")
      .order("rating", { ascending: false });

    if (data) {
      const userIds = [...new Set(data.map((s) => s.user_id))];
      const studioIds = data.map((s) => s.id);

      const [{ data: profiles }, { data: photos }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds),
        supabase.from("studio_photos").select("id, studio_id, photo_url, display_order").in("studio_id", studioIds).order("display_order", { ascending: true }),
      ]);

      const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      const photoMap = new Map<string, StudioPhoto[]>();
      (photos ?? []).forEach((p) => {
        const list = photoMap.get(p.studio_id) ?? [];
        list.push(p);
        photoMap.set(p.studio_id, list);
      });

      setStudios(
        data.map((s) => ({
          ...s,
          equipment: s.equipment ?? [],
          engineer_available: s.engineer_available ?? false,
          rating: Number(s.rating ?? 0),
          reviews_count: s.reviews_count ?? 0,
          description: s.description,
          profile: profileMap.get(s.user_id) as StudioProfile | undefined,
          photos: photoMap.get(s.id) ?? [],
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

  const navigateToProfile = (userId: string) => {
    onClose();
    navigate(`/artist/${userId}`);
  };

  const studioPhotos = selected?.photos ?? [];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl border-zinc-800 bg-zinc-950 p-0">
        <SheetHeader className="border-b border-zinc-800 px-4 py-3 flex flex-row items-center justify-between">
          <button
            onClick={() => (selected ? setSelected(null) : onClose())}
            className="flex items-center gap-1 text-sm font-semibold text-white hover:text-amber-300 transition"
          >
            <ChevronLeft className="h-5 w-5" />
            Back
          </button>
          <SheetTitle className="text-sm font-semibold text-white">
            {selected ? "Book Session" : "Find a Studio"}
          </SheetTitle>
          <div className="w-14" />
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
              filtered.map((studio) => {
                const thumb = studio.photos?.[0]?.photo_url;
                return (
                  <button
                    key={studio.id}
                    onClick={() => setSelected(studio)}
                    className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 text-left transition hover:border-amber-700/40 overflow-hidden"
                  >
                    {/* Photo thumbnail */}
                    {thumb && (
                      <div className="w-full h-32 overflow-hidden">
                        <img src={thumb} alt={studio.name} className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="p-3 pt-2 flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-white">{studio.name}</h3>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                            <Wifi className="h-3 w-3" />
                            <span>Remote Studio</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-amber-400">
                          <Star className="h-3 w-3 fill-amber-400" />
                          <span className="text-xs font-medium">{studio.rating}</span>
                        </div>
                      </div>

                      {/* Engineer profile row */}
                      {studio.profile && (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigateToProfile(studio.user_id); }}
                          className="flex items-center gap-2 py-1.5 rounded-lg hover:bg-zinc-800/50 transition -mx-1 px-1"
                        >
                          <Avatar className="h-6 w-6">
                            {studio.profile.avatar_url ? (
                              <AvatarImage src={studio.profile.avatar_url} />
                            ) : null}
                            <AvatarFallback className="bg-zinc-700 text-[10px] text-zinc-300">
                              {(studio.profile.display_name ?? "E")[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[11px] text-amber-300 font-medium truncate">
                            {studio.profile.display_name ?? "Engineer"}
                          </span>
                          <ChevronRight className="h-3 w-3 text-zinc-500 ml-auto" />
                        </button>
                      )}

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
                    </div>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4 overflow-y-auto p-4" style={{ maxHeight: "calc(85vh - 56px)" }}>
            {/* Photo gallery */}
            {studioPhotos.length > 0 && (
              <div className="relative rounded-xl overflow-hidden">
                <img
                  src={studioPhotos[photoIndex]?.photo_url}
                  alt={`Studio photo ${photoIndex + 1}`}
                  className="w-full h-44 object-cover"
                />
                {studioPhotos.length > 1 && (
                  <>
                    <button
                      onClick={() => setPhotoIndex((photoIndex - 1 + studioPhotos.length) % studioPhotos.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setPhotoIndex((photoIndex + 1) % studioPhotos.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {studioPhotos.map((_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === photoIndex ? "bg-amber-400" : "bg-white/40"}`} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <h3 className="text-base font-semibold text-white">{selected.name}</h3>
              {/* Engineer profile */}
              {selected.profile && (
                <button
                  onClick={() => navigateToProfile(selected.user_id)}
                  className="flex items-center gap-2 mt-2 py-1.5 rounded-lg hover:bg-zinc-800/50 transition -mx-1 px-1"
                >
                  <Avatar className="h-7 w-7">
                    {selected.profile.avatar_url ? (
                      <AvatarImage src={selected.profile.avatar_url} />
                    ) : null}
                    <AvatarFallback className="bg-zinc-700 text-[10px] text-zinc-300">
                      {(selected.profile.display_name ?? "E")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-amber-300 font-medium">
                    {selected.profile.display_name ?? "Engineer"}
                  </span>
                  <span className="text-[10px] text-zinc-500">· View Profile</span>
                </button>
              )}
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
