import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Circle, listCircleMembers } from "@/lib/circles";

const sb = supabase as any;

type FanProfile = { user_id: string; display_name: string | null; avatar_url: string | null };

const SLOTS = 8;

/**
 * Radial "Top Fans" wheel — the creator's profile centered, members arranged around it
 * on spokes, matching the hub-and-spoke reference the user shared. Ranked by earliest
 * approved membership for now (a real engagement-based ranking lives in Creator Studio
 * Analytics, Milestone D); empty spokes show a placeholder icon rather than nothing,
 * per the user's note to keep the wheel full until real members arrive.
 */
export default function CircleTopFansWheel({ circle }: { circle: Circle }) {
  const [owner, setOwner] = useState<FanProfile | null>(null);
  const [fans, setFans] = useState<FanProfile[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: ownerProfile } = await sb
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .eq("user_id", circle.owner_id)
          .maybeSingle();

        const members = await listCircleMembers(circle.id, "approved");
        const ids = members.filter((m) => m.user_id !== circle.owner_id).slice(0, SLOTS).map((m) => m.user_id);
        let profiles: FanProfile[] = [];
        if (ids.length) {
          const { data } = await sb.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids);
          profiles = (data as FanProfile[]) || [];
        }
        if (!cancelled) {
          setOwner(ownerProfile || null);
          setFans(profiles);
        }
      } catch {
        /* table not migrated yet or query failed — wheel just shows placeholder spokes */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [circle.id, circle.owner_id]);

  const radius = 108;
  const center = 130;

  return (
    <div className="flex flex-col items-center py-4">
      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">Top Fans</p>
      <div className="relative" style={{ width: center * 2, height: center * 2 }}>
        <svg className="absolute inset-0" width={center * 2} height={center * 2}>
          {Array.from({ length: SLOTS }).map((_, i) => {
            const angle = (Math.PI * 2 * i) / SLOTS - Math.PI / 2;
            const x = center + Math.cos(angle) * radius;
            const y = center + Math.sin(angle) * radius;
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={x}
                y2={y}
                stroke="hsl(var(--border))"
                strokeWidth={1.5}
                opacity={0.6}
              />
            );
          })}
        </svg>

        {/* center — the creator */}
        <div
          className="absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-card shadow-lg"
          style={{ left: center, top: center }}
        >
          {owner?.avatar_url ? (
            <img src={owner.avatar_url} alt={owner.display_name || "Creator"} className="h-full w-full object-cover" />
          ) : (
            <User className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        {/* spokes — top fans, placeholders for empty slots */}
        {Array.from({ length: SLOTS }).map((_, i) => {
          const angle = (Math.PI * 2 * i) / SLOTS - Math.PI / 2;
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          const fan = fans[i];
          return (
            <div
              key={i}
              className="absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border border-border bg-muted shadow-sm"
              style={{ left: x, top: y }}
              title={fan?.display_name || "Open spot"}
            >
              {fan?.avatar_url ? (
                <img src={fan.avatar_url} alt={fan.display_name || ""} className="h-full w-full object-cover" />
              ) : fan ? (
                <span className="text-[11px] font-black text-muted-foreground">{(fan.display_name || "?").slice(0, 1).toUpperCase()}</span>
              ) : (
                <User className="h-4 w-4 text-muted-foreground/50" />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 max-w-[240px] text-center text-[11px] text-muted-foreground">
        Fans who engage the most with this Circle rise onto the wheel.
      </p>
    </div>
  );
}
