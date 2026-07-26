import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Star, Trophy } from "lucide-react";
import { getHireCategory, formatHourly } from "@/lib/hire-pro";
import { listProsByCategory, type ProProfile } from "@/lib/pro-profiles";

/** Category results — Top pros near you (Nextdoor list style). */
export default function HireCategoryPage() {
  const { categoryId } = useParams();
  const nav = useNavigate();
  const cat = getHireCategory(categoryId);
  const [pros, setPros] = useState<ProProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryId) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        setPros(await listProsByCategory(categoryId));
      } catch (e: any) {
        setError(e?.message || "Could not load pros");
        setPros([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [categoryId]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur">
        <button
          type="button"
          onClick={() => nav("/hire")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex-1 truncate text-center text-sm font-bold">{cat?.label || "Pros"}</h1>
        <div className="w-9" />
      </header>

      <div className="px-4 pb-28 pt-4">
        <h2 className="text-2xl font-black tracking-tight">
          Top {cat?.label || "Pros"} near you
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Local YAJ pros ready to help</p>

        {loading && <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="py-6 text-center text-sm text-destructive">{error}</p>}
        {!loading && !error && pros.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="text-sm font-semibold">No pros in this category yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Offer your services from My Gigs, or post a gig need on Opportunities.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => nav("/my-gigs?offer=1")}
                className="h-10 rounded-full bg-primary text-xs font-bold text-primary-foreground"
              >
                Offer my services
              </button>
              <button
                type="button"
                onClick={() => nav("/jobs")}
                className="h-10 rounded-full border border-border bg-muted text-xs font-bold"
              >
                Post a gig instead
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 space-y-5">
          {pros.map((pro) => {
            const name = pro.business_name || pro.display_name || "Pro";
            const snippet =
              pro.gig_experience_bio ||
              pro.about ||
              "Ready to help with local projects on YAJ.";
            const price = formatHourly(pro.hourly_rate);
            return (
              <button
                key={pro.user_id}
                type="button"
                onClick={() => nav(`/hire/pro/${pro.user_id}`)}
                className="w-full text-left"
              >
                <div className="flex gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
                    {pro.avatar_url ? (
                      <img src={pro.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-lg font-bold text-primary">
                        {name[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-foreground">{name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
                      <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                        <Star className="h-3.5 w-3.5 fill-foreground text-foreground" />
                        {pro.rating.average.toFixed(1)}
                        <span className="font-normal text-muted-foreground">
                          ({pro.rating.isDefault ? "New" : pro.rating.count})
                        </span>
                      </span>
                      {pro.hired_count >= 5 && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Trophy className="h-3 w-3 text-amber-500" /> Top pro
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-[12px] text-muted-foreground">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {pro.similar_jobs_count || Math.max(pro.hired_count, 1)} similar jobs done near you
                    </p>
                    {price && (
                      <p className="mt-0.5 text-[13px] font-bold text-foreground">
                        {price} estimated price
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 rounded-xl bg-muted/80 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Your neighbor said
                  </p>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-foreground">{snippet}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
