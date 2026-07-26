import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, MessageCircle, Star, Trophy } from "lucide-react";
import { toast } from "sonner";
import { formatHourly, formatResponseTime, getLocalHelpCategory } from "@/lib/local-help";
import { listLocalHelpPros, type LocalHelpPro } from "@/lib/pro-profiles";
import { useAuth } from "@/contexts/AuthContext";

export default function LocalHelpCategoryPage() {
  const { categoryId } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const cat = getLocalHelpCategory(categoryId);
  const [pros, setPros] = useState<LocalHelpPro[]>([]);
  const [loading, setLoading] = useState(true);
  const q = params.get("q") || "";

  useEffect(() => {
    if (!categoryId) return;
    void (async () => {
      setLoading(true);
      try {
        setPros(await listLocalHelpPros(categoryId, q || undefined));
      } catch (e: any) {
        toast.error(e?.message || "Could not load helpers");
        setPros([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [categoryId, q]);

  const message = (pro: LocalHelpPro) => {
    if (!user) return toast.error("Sign in to message");
    nav("/messages", {
      state: {
        startWithUserId: pro.user_id,
        startWithProfile: {
          user_id: pro.user_id,
          display_name: pro.business_name || pro.display_name,
          avatar_url: pro.avatar_url,
        },
        gigTitle: cat ? `${cat.label} help` : "Local help",
      },
    });
  };

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur">
        <button type="button" onClick={() => nav("/local-help")} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex-1 truncate text-center text-sm font-bold">{cat?.label || "Local help"}</h1>
        <div className="w-9" />
      </header>

      <div className="px-4 pt-4">
        <h2 className="text-2xl font-black tracking-tight">
          {cat?.emoji} {cat?.label || "Helpers"} near you
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Qualified people on YAJ — neighbors, freelancers, students & pros
        </p>

        {loading && <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>}
        {!loading && pros.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="text-sm font-semibold">No helpers in this category yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Be the first — offer your skills, or ask YAJ Buddy to post a need.</p>
            <button
              type="button"
              onClick={() => nav("/local-help")}
              className="mt-4 h-10 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground"
            >
              Back to Find Local Help
            </button>
          </div>
        )}

        <div className="mt-5 space-y-4">
          {pros.map((pro) => {
            const name = pro.business_name || pro.display_name || "Helper";
            const snippet = pro.gig_experience_bio || pro.about || "Ready to help locally on YAJ.";
            const price = formatHourly(pro.hourly_rate);
            return (
              <article key={pro.user_id} className="rounded-2xl border border-border bg-card p-3">
                <button type="button" onClick={() => nav(`/local-help/pro/${pro.user_id}`)} className="flex w-full gap-3 text-left">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
                    {pro.avatar_url ? (
                      <img src={pro.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-lg font-bold text-primary">{name[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold">{name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px]">
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {pro.rating.average.toFixed(1)}
                        <span className="font-normal text-muted-foreground">
                          ({pro.rating.isDefault ? "New" : pro.rating.count})
                        </span>
                      </span>
                      {pro.hired_count >= 5 && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Trophy className="h-3 w-3 text-amber-500" /> Top helper
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {pro.similar_jobs_count || Math.max(pro.hired_count, 1)} similar jobs · {formatResponseTime(pro.responds_minutes)}
                    </p>
                    {price && <p className="mt-0.5 text-[13px] font-bold">From {price}</p>}
                  </div>
                </button>
                <div className="mt-3 rounded-xl bg-muted/80 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Neighbors said</p>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-snug">{snippet}</p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => nav(`/local-help/pro/${pro.user_id}`)}
                    className="h-9 rounded-xl border border-border bg-background text-[11px] font-bold"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => message(pro)}
                    className="flex h-9 items-center justify-center gap-1 rounded-xl border border-border bg-background text-[11px] font-bold"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Message
                  </button>
                  <button
                    type="button"
                    onClick={() => nav(`/local-help/pro/${pro.user_id}?hire=1`)}
                    className="h-9 rounded-xl bg-primary text-[11px] font-bold text-primary-foreground"
                  >
                    Hire
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
