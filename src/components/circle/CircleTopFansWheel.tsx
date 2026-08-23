import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Circle, listCircleMembers } from "@/lib/circles";

const sb = supabase as any;

type FanProfile = { user_id: string; display_name: string | null; avatar_url: string | null };

const SLOTS = 8;

/** Warm, varied gradients so empty spokes read as "a person hasn't joined yet" rather
 *  than a blank system placeholder — cycled by slot index for visual variety. */
const SLOT_GRADIENTS = [
  "from-rose-400 to-orange-300",
  "from-sky-400 to-cyan-300",
  "from-violet-400 to-fuchsia-300",
  "from-amber-400 to-yellow-300",
  "from-emerald-400 to-teal-300",
  "from-pink-400 to-rose-300",
  "from-indigo-400 to-blue-300",
  "from-lime-400 to-green-300",
];

/** Simple head-and-shoulders silhouette — reads as "a person" at a glance, unlike a bare
 *  lucide User glyph, without needing real stock photography for open slots. */
function PersonSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none">
      <circle cx="20" cy="15" r="7" fill="white" fillOpacity={0.85} />
      <path d="M6 38c0-9 6.3-15 14-15s14 6 14 15" fill="white" fillOpacity={0.85} />
    </svg>
  );
}

type Props = {
  circle: Circle;
  isOwner?: boolean;
  onCreateAvatar?: () => void;
};

/**
 * Radial "Top Fans" wheel — the creator's profile centered, members arranged around it
 * on spokes, matching the hub-and-spoke reference the user shared. Ranked by earliest
 * approved membership for now (a real engagement-based ranking lives in Creator Studio
 * Analytics, Milestone D); empty spokes show a colorful person silhouette rather than a
 * flat gray dot, per the user's "real real people on there not white dots" note.
 */
export default function CircleTopFansWheel({ circle, isOwner, onCreateAvatar }: Props) {
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
  const centerAvatarUrl = owner?.avatar_url || circle.avatar_url;

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

        {/* center — the creator, or a "Create" prompt for an owner with no photo yet */}
        {isOwner && !centerAvatarUrl ? (
          <button
            type="button"
            onClick={onCreateAvatar}
            className="absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-full border-2 border-primary bg-primary text-primary-foreground shadow-lg"
            style={{ left: center, top: center }}
          >
            <Plus className="h-5 w-5" />
            <span className="text-[9px] font-black uppercase tracking-wide">Create</span>
          </button>
        ) : (
          <div
            className="absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-gradient-to-br from-slate-400 to-slate-300 shadow-lg"
            style={{ left: center, top: center }}
          >
            {centerAvatarUrl ? (
              <img src={centerAvatarUrl} alt={owner?.display_name || "Creator"} className="h-full w-full object-cover" />
            ) : (
              <PersonSilhouette className="h-9 w-9" />
            )}
          </div>
        )}

        {/* spokes — top fans, colorful silhouettes for empty slots */}
        {Array.from({ length: SLOTS }).map((_, i) => {
          const angle = (Math.PI * 2 * i) / SLOTS - Math.PI / 2;
          const x = center + Math.cos(angle) * radius;
          const y = center + Math.sin(angle) * radius;
          const fan = fans[i];
          return (
            <div
              key={i}
              className={`absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-gradient-to-br shadow-sm ${
                fan?.avatar_url ? "" : SLOT_GRADIENTS[i % SLOT_GRADIENTS.length]
              }`}
              style={{ left: x, top: y }}
              title={fan?.display_name || "Open spot"}
            >
              {fan?.avatar_url ? (
                <img src={fan.avatar_url} alt={fan.display_name || ""} className="h-full w-full object-cover" />
              ) : fan ? (
                <span className="text-[11px] font-black text-white">{(fan.display_name || "?").slice(0, 1).toUpperCase()}</span>
              ) : (
                <PersonSilhouette className="h-6 w-6" />
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
