import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, BriefcaseBusiness, Film, Loader2, Search, Shield, ShoppingBag, Swords, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { adminDeleteCreatorBook, listAllCreatorBooksForAdmin } from "@/lib/creator-books";
import type { BookItem } from "@/lib/books-catalog";
import { WheuatTv, type WheuatTvItem } from "@/pages/wheuat-tv/wheuatTvStore";

type Tab = "books" | "tv" | "jobs" | "marketplace" | "battles";

type AdminJob = {
  id: string;
  employer_id: string;
  title: string;
  category: string;
  location: string | null;
  status: string;
  created_at: string;
};

type AdminMarketplaceListing = {
  id: string;
  seller_id: string;
  title: string;
  category: string;
  price: number | null;
  status: string;
  cover_url: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
};

type AdminBattle = {
  id: string;
  challenger_id: string;
  opponent_id: string | null;
  title: string;
  media_type: string;
  status: string;
  challenger_cover_url: string | null;
  opponent_cover_url: string | null;
  created_at: string;
};

export default function AdminContentPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("books");
  const [books, setBooks] = useState<BookItem[]>([]);
  const [tv, setTv] = useState<WheuatTvItem[]>([]);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [marketplace, setMarketplace] = useState<AdminMarketplaceListing[]>([]);
  const [battles, setBattles] = useState<AdminBattle[]>([]);
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("Policy violation");
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    void supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => setIsAdmin(Boolean(data)));
  }, [user]);

  const load = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [bookRows, tvRows, jobsResult, marketplaceResult, battlesResult] = await Promise.all([
        listAllCreatorBooksForAdmin(),
        WheuatTv.list(),
        (supabase as any)
          .from("job_listings")
          .select("id,employer_id,title,category,location,status,created_at")
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("marketplace_listings")
          .select("id,seller_id,title,category,price,status,cover_url,city,state,created_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("battles")
          .select("id,challenger_id,opponent_id,title,media_type,status,challenger_cover_url,opponent_cover_url,created_at")
          .order("created_at", { ascending: false }),
      ]);
      if (jobsResult.error) throw jobsResult.error;
      if (marketplaceResult.error) throw marketplaceResult.error;
      if (battlesResult.error) throw battlesResult.error;
      setBooks(bookRows);
      setTv(tvRows.filter((item) => !item.isOriginal));
      setJobs((jobsResult.data || []) as AdminJob[]);
      setMarketplace((marketplaceResult.data || []) as AdminMarketplaceListing[]);
      setBattles((battlesResult.data || []) as AdminBattle[]);
    } catch (e: any) {
      toast.error(e?.message || "Could not load creator content");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const q = query.trim().toLowerCase();
  const filteredBooks = useMemo(
    () => !q ? books : books.filter((book) => [book.title, book.author, book.category, book.blurb].join(" ").toLowerCase().includes(q)),
    [books, q],
  );
  const filteredTv = useMemo(
    () => !q ? tv : tv.filter((item) => [item.title, item.creator.displayName, item.category, item.description].filter(Boolean).join(" ").toLowerCase().includes(q)),
    [tv, q],
  );
  const filteredJobs = useMemo(
    () => !q ? jobs : jobs.filter((job) => [job.title, job.category, job.location, job.status].filter(Boolean).join(" ").toLowerCase().includes(q)),
    [jobs, q],
  );
  const filteredMarketplace = useMemo(
    () =>
      !q
        ? marketplace
        : marketplace.filter((item) =>
            [item.title, item.category, item.city, item.state, item.status]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(q),
          ),
    [marketplace, q],
  );

  const filteredBattles = useMemo(
    () =>
      !q
        ? battles
        : battles.filter((battle) =>
            [battle.title, battle.media_type, battle.status]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(q),
          ),
    [battles, q],
  );

  const removeBook = async (book: BookItem) => {
    if (!user) return;
    if (!window.confirm(`Remove "${book.title}" from YAJ Books for: ${reason}?`)) return;
    setRemoving(`book:${book.id}`);
    try {
      await adminDeleteCreatorBook(user.id, book, reason);
      setBooks((current) => current.filter((item) => item.id !== book.id));
      toast.success("Book removed and moderation action logged");
    } catch (e: any) {
      toast.error(e?.message || "Could not remove book");
    } finally {
      setRemoving(null);
    }
  };

  const removeTv = async (item: WheuatTvItem) => {
    if (!user) return;
    if (!window.confirm(`Remove "${item.title}" from YAJ.TV for: ${reason}?`)) return;
    setRemoving(`tv:${item.id}`);
    try {
      const { error: logError } = await (supabase as any).from("admin_content_removals").insert({
        admin_user_id: user.id,
        content_type: "tv",
        content_id: item.id,
        creator_user_id: item.creator.id,
        title: item.title,
        reason: reason.trim() || "Policy violation",
      });
      if (logError) throw logError;
      await WheuatTv.remove(item.id, item.videoKey);
      setTv((current) => current.filter((row) => row.id !== item.id));
      toast.success("YAJ.TV title removed and moderation action logged");
    } catch (e: any) {
      toast.error(e?.message || "Could not remove YAJ.TV title");
    } finally {
      setRemoving(null);
    }
  };

  const removeJob = async (job: AdminJob) => {
    if (!user) return;
    if (!window.confirm(`Remove "${job.title}" from Opportunities for: ${reason}?`)) return;
    setRemoving(`job:${job.id}`);
    try {
      const { error: logError } = await (supabase as any).from("admin_content_removals").insert({
        admin_user_id: user.id,
        content_type: "job",
        content_id: job.id,
        creator_user_id: job.employer_id,
        title: job.title,
        reason: reason.trim() || "Policy violation",
      });
      if (logError) throw logError;

      const { error } = await (supabase as any).from("job_listings").delete().eq("id", job.id);
      if (error) throw error;

      setJobs((current) => current.filter((row) => row.id !== job.id));
      toast.success("Job removed and moderation action logged");
    } catch (e: any) {
      toast.error(e?.message || "Could not remove job");
    } finally {
      setRemoving(null);
    }
  };

  const removeMarketplaceListing = async (item: AdminMarketplaceListing) => {
    if (!user) return;
    if (!window.confirm(`Remove "${item.title}" from Marketplace for: ${reason}?`)) return;
    setRemoving(`marketplace:${item.id}`);
    try {
      const { error: logError } = await (supabase as any).from("admin_content_removals").insert({
        admin_user_id: user.id,
        content_type: "marketplace",
        content_id: item.id,
        creator_user_id: item.seller_id,
        title: item.title,
        reason: reason.trim() || "Policy violation",
      });
      if (logError) throw logError;

      const { error } = await (supabase as any)
        .from("marketplace_listings")
        .update({
          status: "removed",
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      if (error) throw error;

      setMarketplace((current) => current.filter((row) => row.id !== item.id));
      toast.success("Marketplace listing removed and moderation action logged");
    } catch (e: any) {
      toast.error(e?.message || "Could not remove listing");
    } finally {
      setRemoving(null);
    }
  };

  const removeBattle = async (battle: AdminBattle) => {
    if (!user) return;
    if (!window.confirm(`Remove "${battle.title}" from Battles for: ${reason}?`)) return;
    setRemoving(`battle:${battle.id}`);
    try {
      const { error: logError } = await (supabase as any).from("admin_content_removals").insert({
        admin_user_id: user.id,
        content_type: "battle",
        content_id: battle.id,
        creator_user_id: battle.challenger_id,
        title: battle.title,
        reason: reason.trim() || "Policy violation",
      });
      if (logError) throw logError;

      const { error } = await (supabase as any).from("battles").delete().eq("id", battle.id);
      if (error) throw error;

      setBattles((current) => current.filter((row) => row.id !== battle.id));
      toast.success("Battle removed and moderation action logged");
    } catch (e: any) {
      toast.error(e?.message || "Could not remove battle");
    } finally {
      setRemoving(null);
    }
  };

  if (isAdmin === null) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!isAdmin) {
    return (
      <div className="px-4 pt-6">
        <button onClick={() => nav(-1)} className="mb-4"><ArrowLeft className="h-5 w-5" /></button>
        <div className="rounded-2xl border p-8 text-center">
          <Shield className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-bold">Admin only</p>
        </div>
      </div>
    );
  }

  const items =
    tab === "books"
      ? filteredBooks
      : tab === "tv"
        ? filteredTv
        : tab === "jobs"
          ? filteredJobs
          : tab === "marketplace"
            ? filteredMarketplace
            : filteredBattles;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3">
        <button onClick={() => nav("/admin/trust-safety")} className="flex h-9 w-9 items-center justify-center rounded-full border">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold">Content Moderation</h1>
          <p className="text-xs text-muted-foreground">Operator removal controls for creator Books, YAJ.TV, Opportunities, Marketplace and Battles.</p>
        </div>
      </header>

      <div className="mt-5 flex gap-2 overflow-x-auto">
        <button onClick={() => setTab("books")} className={`shrink-0 flex-1 rounded-full px-4 py-2 text-sm font-bold ${tab === "books" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          <BookOpen className="mr-1.5 inline h-4 w-4" /> Books
        </button>
        <button onClick={() => setTab("tv")} className={`shrink-0 flex-1 rounded-full px-4 py-2 text-sm font-bold ${tab === "tv" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          <Film className="mr-1.5 inline h-4 w-4" /> YAJ.TV
        </button>
        <button onClick={() => setTab("jobs")} className={`shrink-0 flex-1 rounded-full px-4 py-2 text-sm font-bold ${tab === "jobs" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          <BriefcaseBusiness className="mr-1.5 inline h-4 w-4" /> Jobs
        </button>
        <button onClick={() => setTab("marketplace")} className={`shrink-0 flex-1 rounded-full px-4 py-2 text-sm font-bold ${tab === "marketplace" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          <ShoppingBag className="mr-1.5 inline h-4 w-4" /> Marketplace
        </button>
        <button onClick={() => setTab("battles")} className={`shrink-0 flex-1 rounded-full px-4 py-2 text-sm font-bold ${tab === "battles" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
          <Swords className="mr-1.5 inline h-4 w-4" /> Battles
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search creator content" className="h-11 w-full rounded-xl border bg-background pl-9 pr-3 text-sm" />
        </div>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="h-11 rounded-xl border bg-background px-3 text-sm">
          <option>Policy violation</option>
          <option>Adult/graphic content in Kids</option>
          <option>Pornographic content</option>
          <option>Wrong category</option>
          <option>Copyright complaint</option>
          <option>Spam or deceptive content</option>
          <option>Safety violation</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No matching creator content.</p>
      ) : tab === "books" ? (
        <div className="mt-5 space-y-3">
          {filteredBooks.map((book) => (
            <article key={book.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                {book.coverImage ? <img src={book.coverImage} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{book.title}</p>
                <p className="text-xs text-muted-foreground">{book.author} · {book.audience} · {book.category}</p>
                {book.audience === "kids" && <p className="mt-1 text-[10px] font-semibold text-orange-600">Kids catalog content</p>}
              </div>
              <button disabled={removing === `book:${book.id}`} onClick={() => void removeBook(book)} className="flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold text-red-600 disabled:opacity-50">
                {removing === `book:${book.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remove
              </button>
            </article>
          ))}
        </div>
      ) : tab === "tv" ? (
        <div className="mt-5 space-y-3">
          {filteredTv.map((item) => (
            <article key={item.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-black">
                {item.thumbUrl ? <img src={item.thumbUrl} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.creator.displayName} · {item.category || item.kind}</p>
              </div>
              <button disabled={removing === `tv:${item.id}`} onClick={() => void removeTv(item)} className="flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold text-red-600 disabled:opacity-50">
                {removing === `tv:${item.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remove
              </button>
            </article>
          ))}
        </div>
      ) : tab === "jobs" ? (
        <div className="mt-5 space-y-3">
          {filteredJobs.map((job) => (
            <article key={job.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted">
                <BriefcaseBusiness className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{job.title}</p>
                <p className="text-xs text-muted-foreground">
                  {job.category} · {job.location || "No location"} · {job.status}
                </p>
              </div>
              <button disabled={removing === `job:${job.id}`} onClick={() => void removeJob(job)} className="flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold text-red-600 disabled:opacity-50">
                {removing === `job:${job.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remove
              </button>
            </article>
          ))}
        </div>
      ) : tab === "marketplace" ? (
        <div className="mt-5 space-y-3">
          {filteredMarketplace.map((item) => (
            <article key={item.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                {item.cover_url ? (
                  <img src={item.cover_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.category} · {[item.city, item.state].filter(Boolean).join(", ") || "No location"} · {item.status}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold">
                  {item.price == null ? "No price" : `${Number(item.price).toLocaleString()}`}
                </p>
              </div>
              <button
                disabled={removing === `marketplace:${item.id}`}
                onClick={() => void removeMarketplaceListing(item)}
                className="flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold text-red-600 disabled:opacity-50"
              >
                {removing === `marketplace:${item.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remove
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {filteredBattles.map((battle) => {
            const cover = battle.challenger_cover_url || battle.opponent_cover_url;
            return (
              <article key={battle.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                  {cover ? (
                    <img src={cover} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Swords className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{battle.title}</p>
                  <p className="text-xs text-muted-foreground">{battle.media_type} battle · {battle.status}</p>
                </div>
                <button
                  disabled={removing === `battle:${battle.id}`}
                  onClick={() => void removeBattle(battle)}
                  className="flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold text-red-600 disabled:opacity-50"
                >
                  {removing === `battle:${battle.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Remove
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
