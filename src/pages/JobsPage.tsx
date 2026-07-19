import { useMemo, useState } from "react";
import { Search, MapPin, Clock, Briefcase, Sparkles, Plus, X } from "lucide-react";

type JobCategory = {
  id: string;
  label: string;
  emoji: string;
  description: string;
};

const CATEGORIES: JobCategory[] = [
  { id: "featured", label: "Featured", emoji: "🔥", description: "Hand-picked opportunities" },
  { id: "near-you", label: "Near You", emoji: "📍", description: "Local gigs and roles" },
  { id: "remote", label: "Remote", emoji: "💻", description: "Work from anywhere" },
  { id: "students", label: "Students", emoji: "🎓", description: "Internships & campus" },
  { id: "trades", label: "Skilled Trades", emoji: "🛠", description: "Plumbers, electricians, mechanics" },
  { id: "creative", label: "Creative", emoji: "🎨", description: "Editors, designers, photographers" },
  { id: "corporate", label: "Corporate", emoji: "💼", description: "Full-time careers" },
  { id: "startups", label: "Startups", emoji: "🚀", description: "Early-stage teams hiring" },
  { id: "need-help", label: "Need Help Today", emoji: "🤝", description: "Same-day tasks" },
];

type SampleJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  pay: string;
  category: string;
  posted: string;
  tag?: string;
};

const SAMPLE_JOBS: SampleJob[] = [
  { id: "1", title: "Video Editor for Podcast", company: "Indie Studio", location: "Remote", type: "Contract", pay: "$40/hr", category: "creative", posted: "2h", tag: "Urgent" },
  { id: "2", title: "Need my TV mounted", company: "Homeowner", location: "Miami, FL", type: "Gig", pay: "$80", category: "need-help", posted: "20m", tag: "Today" },
  { id: "3", title: "Marketing Intern", company: "Local Agency", location: "New York, NY", type: "Internship", pay: "Paid", category: "students", posted: "1d" },
  { id: "4", title: "DJ for Friday Night", company: "Private Party", location: "Atlanta, GA", type: "Gig", pay: "$500", category: "need-help", posted: "3h", tag: "Weekend" },
  { id: "5", title: "Senior Product Designer", company: "SaaS Startup", location: "Remote", type: "Full-time", pay: "$140k–$180k", category: "corporate" , posted: "5h" },
  { id: "6", title: "Handyman — full day", company: "Property Manager", location: "Houston, TX", type: "Gig", pay: "$300", category: "trades", posted: "1h" },
  { id: "7", title: "Thumbnail Designer", company: "YouTuber", location: "Remote", type: "Contract", pay: "$25 / thumbnail", category: "creative", posted: "6h" },
  { id: "8", title: "Barista", company: "Neighborhood Cafe", location: "Brooklyn, NY", type: "Part-time", pay: "$18/hr + tips", category: "near-you", posted: "1d" },
];

export default function JobsPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("featured");

  const filteredJobs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    let jobs = SAMPLE_JOBS;
    if (activeCategory !== "featured") {
      jobs = jobs.filter((j) => j.category === activeCategory);
    }
    if (normalized) {
      jobs = jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(normalized) ||
          j.company.toLowerCase().includes(normalized) ||
          j.location.toLowerCase().includes(normalized),
      );
    }
    return jobs;
  }, [query, activeCategory]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-primary">Create • Connect • Elevate</p>
            <h1 className="text-2xl font-black tracking-tight">Opportunities</h1>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm active:scale-95 transition-transform"
          >
            <Plus className="w-3.5 h-3.5" />
            Post
          </button>
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search jobs, gigs, or services"
            className="w-full h-11 rounded-xl bg-muted border border-border pl-10 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/35"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label="Clear"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide overscroll-x-contain touch-pan-x">
        {CATEGORIES.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-full border text-xs font-semibold transition-colors ${
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              <span className="text-base leading-none">{cat.emoji}</span>
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Quick actions */}
      {activeCategory === "featured" && !query && (
        <section className="px-4 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <button className="relative overflow-hidden rounded-2xl p-4 text-left bg-gradient-to-br from-emerald-400 to-cyan-500 text-white shadow-sm active:scale-[0.98] transition">
              <Sparkles className="w-5 h-5 mb-2" />
              <p className="text-sm font-bold">Find Work</p>
              <p className="text-[11px] opacity-90">Jobs, gigs & internships</p>
            </button>
            <button className="relative overflow-hidden rounded-2xl p-4 text-left bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm active:scale-[0.98] transition">
              <Briefcase className="w-5 h-5 mb-2" />
              <p className="text-sm font-bold">Hire Someone</p>
              <p className="text-[11px] opacity-90">Post a job or task</p>
            </button>
          </div>
        </section>
      )}

      {/* Jobs list */}
      <section className="px-4 pb-24 space-y-3">
        {filteredJobs.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-semibold">No opportunities yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Try another category or search.</p>
          </div>
        ) : (
          filteredJobs.map((job) => (
            <button
              key={job.id}
              type="button"
              className="w-full text-left p-4 rounded-2xl bg-card border border-border hover:border-primary/40 transition-colors active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-foreground truncate">{job.title}</p>
                    {job.tag && (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                        {job.tag}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{job.company}</p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {job.location}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {job.posted}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground">{job.pay}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{job.type}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </section>
    </div>
  );
}
