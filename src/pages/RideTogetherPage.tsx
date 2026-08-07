import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Fuel, MapPin, Plus, ShieldCheck, Users } from "lucide-react";

type Ride = {
  id: string;
  destination: string;
  category: string;
  from: string;
  when: string;
  seats: number;
  cost: "Free" | "Split gas";
  driver: string;
};

const DESTINATIONS = [
  { id: "work", label: "Work", emoji: "📍" },
  { id: "concert", label: "Concert", emoji: "🎵" },
  { id: "gaming", label: "Gaming event", emoji: "🎮" },
  { id: "restaurant", label: "Restaurant", emoji: "🍔" },
  { id: "airport", label: "Airport", emoji: "🛫" },
  { id: "sports", label: "Sports", emoji: "🏀" },
  { id: "school", label: "School", emoji: "🎓" },
  { id: "custom", label: "Custom destination", emoji: "➕" },
];

const SAMPLE_RIDES: Ride[] = [
  {
    id: "r1",
    destination: "Drake concert — Downtown Arena",
    category: "concert",
    from: "Downtown",
    when: "Today, 6:30 PM",
    seats: 2,
    cost: "Split gas",
    driver: "Maya R.",
  },
  {
    id: "r2",
    destination: "Miami road trip",
    category: "custom",
    from: "Orlando",
    when: "Tomorrow, 9:00 AM",
    seats: 3,
    cost: "Split gas",
    driver: "Andre T.",
  },
  {
    id: "r3",
    destination: "Morning commute — Midtown offices",
    category: "work",
    from: "Eastside",
    when: "Weekdays, 7:15 AM",
    seats: 1,
    cost: "Free",
    driver: "Jess L.",
  },
  {
    id: "r4",
    destination: "Airport drop-off — Terminal B",
    category: "airport",
    from: "Northside",
    when: "Sat, 4:00 AM",
    seats: 2,
    cost: "Split gas",
    driver: "Sam K.",
  },
];

export default function RideTogetherPage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<string | null>(null);
  const [joined, setJoined] = useState<string[]>([]);

  const rides = useMemo(
    () => (category ? SAMPLE_RIDES.filter((r) => r.category === category) : SAMPLE_RIDES),
    [category],
  );

  return (
    <div className="min-h-screen bg-background pb-32 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 px-4 pb-3 pt-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-full p-1.5 text-muted-foreground active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-[20px] font-black tracking-tight">Ride Together</h1>
            <p className="text-[11px] text-muted-foreground">
              Share the ride to the places you&apos;re already going.
            </p>
          </div>
        </div>
      </header>

      <section className="px-4 pt-4">
        <h2 className="text-[12px] font-black uppercase tracking-[0.12em] text-muted-foreground">
          Where are you going?
        </h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {DESTINATIONS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setCategory((prev) => (prev === d.id ? null : d.id))}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition active:scale-95 ${
                category === d.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground"
              }`}
            >
              <span className="mr-1">{d.emoji}</span>
              {d.label}
            </button>
          ))}
        </div>
      </section>

      <section className="px-4 pt-5">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-[13px] font-bold text-primary-foreground active:scale-[0.99]"
        >
          <Plus className="h-4 w-4" />
          Post a ride
        </button>
      </section>

      <section className="px-4 pt-6">
        <h2 className="mb-2 text-[13px] font-black">Rides near you</h2>
        <div className="space-y-3">
          {rides.map((ride) => {
            const isJoined = joined.includes(ride.id);
            return (
              <article
                key={ride.id}
                className="rounded-2xl border border-border/60 bg-card p-3 shadow-[0_4px_14px_rgba(15,23,42,0.06)]"
              >
                <p className="text-[14px] font-bold leading-snug">{ride.destination}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Leaving {ride.from}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {ride.when}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" /> {ride.seats} seat{ride.seats === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Fuel className="h-3 w-3" /> {ride.cost}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="flex-1 truncate text-[11px] font-semibold text-muted-foreground">
                    Driver · {ride.driver}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setJoined((prev) => (isJoined ? prev.filter((x) => x !== ride.id) : [...prev, ride.id]))
                    }
                    className={`rounded-full px-3 py-1.5 text-[12px] font-bold active:scale-95 ${
                      isJoined
                        ? "border border-border bg-muted text-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {isJoined ? "Requested" : "Join ride"}
                  </button>
                </div>
              </article>
            );
          })}
          {rides.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
              <p className="font-bold">No rides posted here yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">Be the first — post your ride.</p>
            </div>
          )}
        </div>
      </section>

      <section className="px-4 pt-6">
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="text-[13px] font-black">Ride safely</h2>
          </div>
          <ul className="space-y-1 text-[12px] text-muted-foreground">
            <li>· Riding is opt-in — only you decide who you ride with.</li>
            <li>· Ride with verified profiles and check ratings first.</li>
            <li>· Rate each other after the ride; report or block anytime.</li>
            <li>· Share your ride status with a trusted contact.</li>
            <li>· Free or splitting gas is always stated up front.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
