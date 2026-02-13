import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Building2, MapPin, Clock, Star, Search, SlidersHorizontal, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import studio1 from "@/assets/studio-1.jpg";
import studio2 from "@/assets/studio-2.jpg";
import studio3 from "@/assets/studio-3.jpg";
import studio4 from "@/assets/studio-4.jpg";

// Fallback mock data when no database studios exist
const mockStudios = [
  { id: "mock-1", name: "Sunset Sound Lab", hourly_rate: 75, daily_rate: null, location: "Los Angeles, CA", rating: 4.9, reviews_count: 48, equipment: ["Pro Tools", "Neumann U87", "SSL Console"], image: studio1, available: true, engineer_available: true },
  { id: "mock-2", name: "Blue Room Studios", hourly_rate: 50, daily_rate: null, location: "Atlanta, GA", rating: 4.7, reviews_count: 32, equipment: ["Logic Pro", "AKG C414", "Focusrite"], image: studio2, available: true, engineer_available: false },
  { id: "mock-3", name: "Echo Chamber NYC", hourly_rate: 120, daily_rate: null, location: "New York, NY", rating: 5.0, reviews_count: 67, equipment: ["Ableton", "Neve 1073", "Genelec Monitors"], image: studio3, available: false, engineer_available: true },
  { id: "mock-4", name: "Vibe Factory", hourly_rate: 40, daily_rate: null, location: "Houston, TX", rating: 4.5, reviews_count: 21, equipment: ["FL Studio", "SM7B", "KRK Monitors"], image: studio4, available: true, engineer_available: false },
];

const fallbackImages = [studio1, studio2, studio3, studio4];

interface StudioData {
  id: string;
  name: string;
  hourly_rate: number;
  daily_rate: number | null;
  location: string;
  rating: number;
  reviews_count: number;
  equipment: string[];
  image?: string;
  available?: boolean;
  engineer_available: boolean;
  photos?: { photo_url: string; display_order: number }[];
  blocked_dates?: string[];
}

const StudioCard = ({ studio, onClick }: { studio: StudioData; onClick: () => void }) => {
  const img = studio.photos && studio.photos.length > 0
    ? studio.photos[0].photo_url
    : studio.image || fallbackImages[Math.floor(Math.random() * 4)];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-card border border-border overflow-hidden hover:border-primary/30 transition-all cursor-pointer"
      onClick={onClick}>
      <div className="relative w-full h-44 overflow-hidden">
        <img src={img} alt={studio.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-background/80 backdrop-blur-sm flex items-center gap-1">
          <Star className="w-3 h-3 text-primary fill-primary" />
          <span className="text-xs font-semibold text-foreground">{studio.rating}</span>
          <span className="text-[10px] text-muted-foreground">({studio.reviews_count})</span>
        </div>
        <div className="absolute bottom-3 left-3">
          <h3 className="text-base font-display font-bold text-white">{studio.name}</h3>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-white/70" />
            <span className="text-[11px] text-white/70">{studio.location}</span>
          </div>
        </div>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5">
          {studio.equipment.map((e) => (
            <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{e}</span>
          ))}
          {studio.engineer_available && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent-foreground flex items-center gap-1">
              <Users className="w-2.5 h-2.5" /> Engineer
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
          <div>
            <span className="text-lg font-display font-bold text-primary">${studio.hourly_rate}</span>
            <span className="text-xs text-muted-foreground">/hr</span>
            {studio.daily_rate && (
              <span className="text-xs text-muted-foreground ml-2">${studio.daily_rate}/day</span>
            )}
          </div>
          <button className="px-5 py-2.5 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold glow-primary hover:opacity-90 transition-opacity"
            onClick={(e) => { e.stopPropagation(); }}>
            Book Now
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// Calendar for studio detail view
const MiniCalendar = ({ blockedDates = [] }: { blockedDates?: string[] }) => {
  const [month] = useState(new Date());
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const monthName = month.toLocaleString("default", { month: "long", year: "numeric" });

  const isBlocked = (day: number) => {
    const dateStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return blockedDates.includes(dateStr);
  };

  return (
    <div className="p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center justify-between mb-3">
        <button className="text-muted-foreground"><ChevronLeft className="w-4 h-4" /></button>
        <span className="text-sm font-semibold text-foreground">{monthName}</span>
        <button className="text-muted-foreground"><ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="text-[10px] text-muted-foreground font-medium py-1">{d}</span>
        ))}
        {blanks.map((_, i) => <div key={`b-${i}`} />)}
        {days.map((d) => {
          const blocked = isBlocked(d);
          const isToday = d === new Date().getDate();
          return (
            <button key={d}
              className={`text-[11px] py-1.5 rounded-lg transition-all ${
                isToday ? "gradient-primary text-primary-foreground font-bold" :
                blocked ? "bg-destructive/15 text-destructive" :
                "text-foreground hover:bg-primary/10"
              }`}>
              {d}
            </button>
          );
        })}
      </div>
      <div className="flex gap-3 mt-3 pt-3 border-t border-border">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-[10px] text-muted-foreground">Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
          <span className="text-[10px] text-muted-foreground">Booked</span>
        </div>
      </div>
    </div>
  );
};

const StudiosPage = () => {
  const [selectedStudio, setSelectedStudio] = useState<StudioData | null>(null);
  const [activeFilter, setActiveFilter] = useState("All");
  const [studios, setStudios] = useState<StudioData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const filters = ["All", "Under $50/hr", "Top Rated", "Near Me", "Available Now"];

  useEffect(() => {
    const fetchStudios = async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("studios")
        .select("*, studio_photos(photo_url, display_order)")
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        const mapped = data.map((s: any, i: number) => ({
          ...s,
          photos: s.studio_photos || [],
          image: s.studio_photos?.[0]?.photo_url || fallbackImages[i % 4],
          available: true,
        }));
        setStudios(mapped);
      } else {
        // Use mock data as fallback
        setStudios(mockStudios as any);
      }
      setLoading(false);
    };
    fetchStudios();
  }, []);

  const filteredStudios = studios.filter((s) => {
    if (search) {
      const q = search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.location.toLowerCase().includes(q)) return false;
    }
    if (activeFilter === "Under $50/hr") return s.hourly_rate < 50;
    if (activeFilter === "Top Rated") return s.rating >= 4.8;
    return true;
  });

  if (selectedStudio) {
    return (
      <div className="px-4 pt-4 pb-4">
        <button onClick={() => setSelectedStudio(null)} className="flex items-center gap-2 text-muted-foreground mb-4">
          <ChevronLeft className="w-4 h-4" />
          <span className="text-sm">Back to Studios</span>
        </button>
        <div className="rounded-xl overflow-hidden border border-border">
          <div className="relative h-52">
            <img src={selectedStudio.image || fallbackImages[0]} alt={selectedStudio.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-4 left-4">
              <h1 className="text-xl font-display font-bold text-white">{selectedStudio.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <MapPin className="w-3 h-3 text-white/70" />
                <span className="text-xs text-white/70">{selectedStudio.location}</span>
                <Star className="w-3 h-3 text-primary fill-primary ml-2" />
                <span className="text-xs text-white">{selectedStudio.rating} ({selectedStudio.reviews_count} reviews)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Photo gallery */}
        {selectedStudio.photos && selectedStudio.photos.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
            {selectedStudio.photos.map((p, i) => (
              <img key={i} src={p.photo_url} alt={`Photo ${i + 1}`}
                className="w-24 h-16 rounded-lg object-cover border border-border flex-shrink-0" />
            ))}
          </div>
        )}

        <div className="mt-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Equipment</h3>
          <div className="flex flex-wrap gap-2">
            {selectedStudio.equipment.map((e) => (
              <span key={e} className="text-xs px-3 py-1.5 rounded-lg bg-card border border-border text-foreground">{e}</span>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Availability</h3>
          <MiniCalendar blockedDates={selectedStudio.blocked_dates} />
        </div>

        <div className="mt-4 p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-2xl font-display font-bold text-primary">${selectedStudio.hourly_rate}</span>
              <span className="text-sm text-muted-foreground">/hr</span>
              {selectedStudio.daily_rate && (
                <span className="text-sm text-muted-foreground ml-3">${selectedStudio.daily_rate}/day</span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">10% platform fee applies</span>
          </div>
          <button className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm glow-primary">
            Book This Studio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-display font-bold text-foreground">Studios</h1>
        </div>
        <button className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground">
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search studios by name or location..."
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all" />
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide">
        {filters.map((f) => (
          <button key={f} onClick={() => setActiveFilter(f)}
            className={`px-4 py-2 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
              activeFilter === f
                ? "gradient-primary text-primary-foreground glow-primary"
                : "bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/30"
            }`}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-4 mb-4">
          {filteredStudios.map((studio) => (
            <StudioCard key={studio.id} studio={studio} onClick={() => setSelectedStudio(studio)} />
          ))}
          {filteredStudios.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No studios match your search</p>
          )}
        </div>
      )}
    </div>
  );
};

export default StudiosPage;
