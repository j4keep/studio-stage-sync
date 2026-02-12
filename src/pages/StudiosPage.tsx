import { motion } from "framer-motion";
import { Building2, MapPin, Clock, Star, Wifi, Mic2, Headphones } from "lucide-react";

const studios = [
  {
    name: "Sunset Sound Lab",
    rate: 75,
    location: "Los Angeles, CA",
    rating: 4.9,
    reviews: 48,
    equipment: ["Pro Tools", "Neumann U87", "SSL Console"],
  },
  {
    name: "Blue Room Studios",
    rate: 50,
    location: "Atlanta, GA",
    rating: 4.7,
    reviews: 32,
    equipment: ["Logic Pro", "AKG C414", "Focusrite"],
  },
  {
    name: "Echo Chamber NYC",
    rate: 120,
    location: "New York, NY",
    rating: 5.0,
    reviews: 67,
    equipment: ["Ableton", "Neve 1073", "Genelec Monitors"],
  },
  {
    name: "Vibe Factory",
    rate: 40,
    location: "Houston, TX",
    rating: 4.5,
    reviews: 21,
    equipment: ["FL Studio", "SM7B", "KRK Monitors"],
  },
];

const StudioCard = ({ studio }: { studio: typeof studios[0] }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-xl bg-card border border-border overflow-hidden"
  >
    {/* Studio Image Placeholder */}
    <div className="w-full h-40 gradient-primary relative flex items-center justify-center">
      <Building2 className="w-12 h-12 text-primary-foreground/50" />
      <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-background/80 backdrop-blur-sm flex items-center gap-1">
        <Star className="w-3 h-3 text-primary fill-primary" />
        <span className="text-xs font-semibold text-foreground">{studio.rating}</span>
        <span className="text-[10px] text-muted-foreground">({studio.reviews})</span>
      </div>
    </div>

    <div className="p-4">
      <h3 className="text-base font-display font-bold text-foreground">{studio.name}</h3>
      <div className="flex items-center gap-1 mt-1">
        <MapPin className="w-3 h-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{studio.location}</span>
      </div>

      {/* Equipment Tags */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {studio.equipment.map((e) => (
          <span key={e} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {e}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-primary" />
          <span className="text-sm font-semibold text-primary">${studio.rate}/hr</span>
        </div>
        <button className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold glow-primary hover:opacity-90 transition-opacity">
          Book Now
        </button>
      </div>
    </div>
  </motion.div>
);

const StudiosPage = () => {
  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-2 mb-6">
        <Building2 className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-display font-bold text-foreground">Studios</h1>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search studios by name or location..."
          className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
        />
      </div>

      {/* Quick Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
        {["All", "Under $50/hr", "Top Rated", "Near Me"].map((f) => (
          <button
            key={f}
            className="px-4 py-2 rounded-full bg-card border border-border text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/30 transition-all whitespace-nowrap first:bg-primary/10 first:text-primary first:border-primary/20"
          >
            {f}
          </button>
        ))}
      </div>

      {/* Studios Grid */}
      <div className="flex flex-col gap-4 mb-4">
        {studios.map((studio) => (
          <StudioCard key={studio.name} studio={studio} />
        ))}
      </div>
    </div>
  );
};

export default StudiosPage;
