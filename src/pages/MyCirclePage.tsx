import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, HelpCircle, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import ConnectionsDiscovery from "@/components/circle/ConnectionsDiscovery";
import CircleQuickActions from "@/components/circle/CircleQuickActions";
import MyCirclesList from "@/components/circle/MyCirclesList";
import CircleCard from "@/components/circle/CircleCard";
import CreateCircleSheet from "@/components/circle/CreateCircleSheet";
import { Circle, listDiscoverableCircles, listExclusiveCircles, listMyCircles } from "@/lib/circles";
import { toast } from "@/hooks/use-toast";

type NavTab = "home" | "discover" | "circles";

const MyCirclePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<NavTab>("home");
  const [createOpen, setCreateOpen] = useState(false);
  const [hasAnyCircle, setHasAnyCircle] = useState<boolean | null>(null);
  const [discover, setDiscover] = useState<Circle[] | null>(null);
  const [exclusive, setExclusive] = useState<Circle[] | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    void listMyCircles(user.id)
      .then((rows) => setHasAnyCircle(rows.length > 0))
      .catch(() => setHasAnyCircle(false));
  }, [user?.id]);

  useEffect(() => {
    void listDiscoverableCircles({ limit: 12 }).then(setDiscover).catch(() => setDiscover([]));
    void listExclusiveCircles(10).then(setExclusive).catch(() => setExclusive([]));
  }, []);

  const startExclusive = () => {
    setCreateOpen(false);
    navigate("/circle/create/creator");
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-24 text-foreground">
      <div className="sticky top-0 z-10 border-b border-border bg-background px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-black">My Circle</h1>
            <p className="text-[11px] text-muted-foreground">Your people. Your private spaces. Your exclusive content.</p>
          </div>
          <button type="button" className="p-2 text-muted-foreground">
            <HelpCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 flex gap-1">
          {([
            { id: "home", label: "Home" },
            { id: "discover", label: "Discover" },
            { id: "circles", label: "My Circles" },
          ] as { id: NavTab; label: string }[]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition ${
                tab === t.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "circles" ? (
        <div className="pt-4">
          <MyCirclesList />
        </div>
      ) : tab === "discover" ? (
        <div className="pt-2">
          <ConnectionsDiscovery />
        </div>
      ) : (
        <div className="space-y-6 pt-5">
          <CircleQuickActions
            onCreateCircle={() => setCreateOpen(true)}
            onCreateDating={() => toast({ title: "Dating profiles are coming soon", description: "This is being built right now — check back shortly." })}
            onStartExclusive={startExclusive}
            onFindPeople={() => setTab("discover")}
          />

          {hasAnyCircle === false && (
            <div className="mx-4 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
              <Sparkles className="h-8 w-8 text-primary" />
              <h2 className="text-base font-bold">Start your Circle</h2>
              <p className="max-w-xs text-[13px] text-muted-foreground">
                Create a private community, meet new people, date, or build a subscriber-only space.
              </p>
              <div className="mt-1 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => setCreateOpen(true)} className="rounded-full bg-primary px-4 py-2 text-[12.5px] font-black text-primary-foreground">
                  Create Circle
                </button>
                <button
                  type="button"
                  onClick={() => toast({ title: "Dating profiles are coming soon" })}
                  className="rounded-full border border-border bg-card px-4 py-2 text-[12.5px] font-bold"
                >
                  Dating
                </button>
                <button type="button" onClick={startExclusive} className="rounded-full border border-border bg-card px-4 py-2 text-[12.5px] font-bold">
                  Exclusive Content
                </button>
                <button type="button" onClick={() => setTab("discover")} className="rounded-full border border-border bg-card px-4 py-2 text-[12.5px] font-bold">
                  Invite Friends
                </button>
              </div>
            </div>
          )}

          {hasAnyCircle && (
            <section>
              <h2 className="mb-2 px-4 text-[12.5px] font-black">Your Circles</h2>
              <MyCirclesList />
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between px-4">
              <h2 className="text-[12.5px] font-black">Discover</h2>
              <button type="button" onClick={() => setTab("discover")} className="text-[11px] font-bold text-primary">See all</button>
            </div>
            <CircleRow circles={discover} emptyLabel="No Circles to discover yet — be the first to create one." />
          </section>

          <section>
            <div className="mb-2 flex items-center gap-1.5 px-4">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <h2 className="text-[12.5px] font-black">Exclusive</h2>
            </div>
            <CircleRow circles={exclusive} emptyLabel="No creator Circles yet." />
          </section>

          <section>
            <div className="mb-2 flex items-center gap-1.5 px-4">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-[12.5px] font-black">People Near You</h2>
            </div>
            <ConnectionsDiscovery />
          </section>
        </div>
      )}

      <CreateCircleSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};

function CircleRow({ circles, emptyLabel }: { circles: Circle[] | null; emptyLabel: string }) {
  if (circles === null) {
    return (
      <div className="flex gap-3 overflow-x-auto px-4 pb-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 w-40 shrink-0 animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
        ))}
      </div>
    );
  }
  if (!circles.length) {
    return <p className="px-4 text-[12.5px] text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="flex gap-3 overflow-x-auto px-4 pb-1">
      {circles.map((c) => (
        <CircleCard key={c.id} circle={c} />
      ))}
    </div>
  );
}

export default MyCirclePage;
