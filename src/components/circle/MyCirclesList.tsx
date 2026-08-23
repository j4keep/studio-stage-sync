import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Circle, CircleMember, listCreatedCircles, listMyCircles } from "@/lib/circles";
import CircleCard from "./CircleCard";

type SubTab = "joined" | "created";

export default function MyCirclesList() {
  const { user } = useAuth();
  const [sub, setSub] = useState<SubTab>("joined");
  const [joined, setJoined] = useState<{ circle: Circle; membership: CircleMember }[] | null>(null);
  const [created, setCreated] = useState<Circle[] | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    void listMyCircles(user.id).then(setJoined).catch(() => setJoined([]));
    void listCreatedCircles(user.id).then(setCreated).catch(() => setCreated([]));
  }, [user?.id]);

  const joinedOnly = (joined || []).filter(({ circle }) => circle.owner_id !== user?.id);
  const list = sub === "joined" ? joinedOnly.map((j) => j.circle) : created || [];
  const loading = sub === "joined" ? joined === null : created === null;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 px-4">
        {(["joined", "created"] as SubTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSub(t)}
            className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${
              sub === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"
            }`}
          >
            {t === "joined" ? "Joined" : "Created by Me"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-x-auto px-4 pb-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 w-40 shrink-0 animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
          ))}
        </div>
      ) : list.length ? (
        <div className="flex gap-3 overflow-x-auto px-4 pb-1">
          {list.map((c) => (
            <CircleCard key={c.id} circle={c} />
          ))}
        </div>
      ) : (
        <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
          {sub === "joined" ? "You haven't joined any Circles yet." : "You haven't created any Circles yet."}
        </p>
      )}
    </div>
  );
}
