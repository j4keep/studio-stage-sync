import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { HIRE_CATEGORIES } from "@/lib/hire-pro";

/** Nextdoor-style Hire a Pro category grid. */
export default function HireProPage() {
  const nav = useNavigate();
  const [q, setQ] = useState("");

  const cats = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return HIRE_CATEGORIES;
    return HIRE_CATEGORIES.filter((c) => c.label.toLowerCase().includes(n));
  }, [q]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => nav("/jobs")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="flex-1 text-center text-lg font-black tracking-tight">Hire a Pro</h1>
          <div className="w-9" />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search general contractor"
            className="h-11 w-full rounded-full border border-border bg-muted pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 p-4 pb-28">
        {cats.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => nav(`/hire/${cat.id}`)}
            className="relative aspect-[4/3] overflow-hidden rounded-2xl text-left shadow-sm active:scale-[0.98] transition"
          >
            <img src={cat.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
            <p className="absolute bottom-3 left-3 right-3 text-[13px] font-bold leading-snug text-white drop-shadow">
              {cat.label}
            </p>
          </button>
        ))}
      </section>
    </div>
  );
}
