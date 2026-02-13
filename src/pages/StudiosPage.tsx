import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, MapPin, Clock, Star, Wifi, Mic2, Headphones, Search, SlidersHorizontal, Calendar, ChevronLeft, ChevronRight, X, Users } from "lucide-react";
import studio1 from "@/assets/studio-1.jpg";
import studio2 from "@/assets/studio-2.jpg";
import studio3 from "@/assets/studio-3.jpg";
import studio4 from "@/assets/studio-4.jpg";

const studios = [
  {
    name: "Sunset Sound Lab",
    rate: 75,
    location: "Los Angeles, CA",
    rating: 4.9,
    reviews: 48,
    equipment: ["Pro Tools", "Neumann U87", "SSL Console"],
    image: studio1,
    available: true,
    engineer: true,
  },
  {
    name: "Blue Room Studios",
    rate: 50,
    location: "Atlanta, GA",
    rating: 4.7,
    reviews: 32,
    equipment: ["Logic Pro", "AKG C414", "Focusrite"],
    image: studio2,
    available: true,
    engineer: false,
  },
  {
    name: "Echo Chamber NYC",
    rate: 120,
    location: "New York, NY",
    rating: 5.0,
    reviews: 67,
    equipment: ["Ableton", "Neve 1073", "Genelec Monitors"],
    image: studio3,
    available: false,
    engineer: true,
  },
  {
    name: "Vibe Factory",
    rate: 40,
    location: "Houston, TX",
    rating: 4.5,
    reviews: 21,
    equipment: ["FL Studio", "SM7B", "KRK Monitors"],
    image: studio4,
    available: true,
    engineer: false,
  },
];

const StudioCard = ({ studio, onClick }: { studio: typeof studios[0]; onClick: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-xl bg-card border border-border overflow-hidden hover:border-primary/30 transition-all cursor-pointer"
    onClick={onClick}
  >
    {/* Studio Image */}
    <div className="relative w-full h-44 overflow-hidden">
      <img src={studio.image} alt={studio.name} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-background/80 backdrop-blur-sm flex items-center gap-1">
        <Star className="w-3 h-3 text-primary fill-primary" />
        <span className="text-xs font-semibold text-foreground">{studio.rating}</span>
        <span className="text-[10px] text-muted-foreground">({studio.reviews})</span>
      </div>
      {studio.available ? (
        <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-green-500/20 backdrop-blur-sm">
          <span className="text-[10px] font-semibold text-green-400">Available</span>
        </div>
      ) : (
        <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-red-500/20 backdrop-blur-sm">
          <span className="text-[10px] font-semibold text-red-400">Booked</span>
        </div>
      )}
      <div className="absolute bottom-3 left-3">
        <h3 className="text-base font-display font-bold text-white">{studio.name}</h3>
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin className="w-3 h-3 text-white/70" />
          <span className="text-[11px] text-white/70">{studio.location}</span>
        </div>
      </div>
    </div>

    <div className="p-4">
      {/* Equipment Tags */}
      <div className="flex flex-wrap gap-1.5">
        {studio.equipment.map((e) => (
          <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {e}
          </span>
        ))}
        {studio.engineer && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent-foreground flex items-center gap-1">
            <Users className="w-2.5 h-2.5" /> Engineer Available
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <div>
          <span className="text-lg font-display font-bold text-primary">${studio.rate}</span>
          <span className="text-xs text-muted-foreground">/hr</span>
        </div>
        <button
          className="px-5 py-2.5 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold glow-primary hover:opacity-90 transition-opacity"
          onClick={(e) => { e.stopPropagation(); }}
        >
          Book Now
        </button>
      </div>
    </div>
  </motion.div>
);

// Simple calendar component
const MiniCalendar = () => {
  const [month] = useState(new Date());
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const bookedDays = [5, 6, 12, 13, 19, 20, 25];
  const monthName = month.toLocaleString("default", { month: "long", year: "numeric" });

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
          const isBooked = bookedDays.includes(d);
          const isToday = d === new Date().getDate();
          return (
            <button
              key={d}
              className={`text-[11px] py-1.5 rounded-lg transition-all ${
                isToday ? "gradient-primary text-primary-foreground font-bold" :
                isBooked ? "bg-red-500/15 text-red-400" :
                "text-foreground hover:bg-primary/10"
              }`}
            >
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
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <span className="text-[10px] text-muted-foreground">Booked</span>
        </div>
      </div>
    </div>
  );
};

const StudiosPage = () => {
  const [selectedStudio, setSelectedStudio] = useState<typeof studios[0] | null>(null);
  const [activeFilter, setActiveFilter] = useState("All");

  const filters = ["All", "Under $50/hr", "Top Rated", "Near Me", "Available Now"];

  if (selectedStudio) {
    return (
      <div className="px-4 pt-4 pb-4">
        {/* Back */}
        <button onClick={() => setSelectedStudio(null)} className="flex items-center gap-2 text-muted-foreground mb-4">
          <ChevronLeft className="w-4 h-4" />
          <span className="text-sm">Back to Studios</span>
        </button>

        {/* Studio Detail */}
        <div className="rounded-xl overflow-hidden border border-border">
          <div className="relative h-52">
            <img src={selectedStudio.image} alt={selectedStudio.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-4 left-4">
              <h1 className="text-xl font-display font-bold text-white">{selectedStudio.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <MapPin className="w-3 h-3 text-white/70" />
                <span className="text-xs text-white/70">{selectedStudio.location}</span>
                <Star className="w-3 h-3 text-primary fill-primary ml-2" />
                <span className="text-xs text-white">{selectedStudio.rating} ({selectedStudio.reviews} reviews)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Equipment */}
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Equipment</h3>
          <div className="flex flex-wrap gap-2">
            {selectedStudio.equipment.map((e) => (
              <span key={e} className="text-xs px-3 py-1.5 rounded-lg bg-card border border-border text-foreground">
                {e}
              </span>
            ))}
          </div>
        </div>

        {/* Calendar */}
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Availability</h3>
          <MiniCalendar />
        </div>

        {/* Booking CTA */}
        <div className="mt-4 p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-2xl font-display font-bold text-primary">${selectedStudio.rate}</span>
              <span className="text-sm text-muted-foreground">/hr</span>
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

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search studios by name or location..."
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-4 py-2 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
              activeFilter === f
                ? "gradient-primary text-primary-foreground glow-primary"
                : "bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/30"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Studios List */}
      <div className="flex flex-col gap-4 mb-4">
        {studios.map((studio) => (
          <StudioCard key={studio.name} studio={studio} onClick={() => setSelectedStudio(studio)} />
        ))}
      </div>
    </div>
  );
};

export default StudiosPage;
