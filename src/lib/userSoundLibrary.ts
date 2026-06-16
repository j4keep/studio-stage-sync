import { supabase } from "@/integrations/supabase/client";
import { downloadFromR2 } from "@/lib/r2-storage";
import type { LoopDef, LoopCategory } from "@/wstudio/daw/lib/loopGenerator";

export interface UserSoundRow {
  id: string;
  name: string;
  category: string;
  genre: string | null;
  pack: string | null;
  bpm: number | null;
  musical_key: string | null;
  tags: string[] | null;
  r2_key: string;
  duration_sec: number | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
}

const VALID_CATEGORIES: LoopCategory[] = [
  "drums","808","hi-hats","snare","kick","clap","synth","bass","piano","guitar","sfx","vocal",
];

const CATEGORY_COLORS: Record<LoopCategory, string> = {
  drums: "#ec4899", "808": "#a855f7", "hi-hats": "#22d3ee", snare: "#f43f5e",
  kick: "#f97316", clap: "#eab308", synth: "#8b5cf6", bass: "#10b981",
  piano: "#3b82f6", guitar: "#84cc16", sfx: "#f59e0b", vocal: "#fb7185",
};

export function categorizeFilename(name: string): LoopCategory {
  const n = name.toLowerCase();
  if (/(808|sub)/.test(n)) return "808";
  if (/(hi.?hat|hat\b|hh\b)/.test(n)) return "hi-hats";
  if (/snare/.test(n)) return "snare";
  if (/clap/.test(n)) return "clap";
  if (/kick/.test(n)) return "kick";
  if (/(drum|loop|break|perc)/.test(n)) return "drums";
  if (/bass/.test(n)) return "bass";
  if (/piano|rhodes|key/.test(n)) return "piano";
  if (/guitar|gtr/.test(n)) return "guitar";
  if (/vox|vocal|chop/.test(n)) return "vocal";
  if (/fx|sfx|riser|sweep|impact/.test(n)) return "sfx";
  return "synth";
}

export function detectBpm(name: string): number | null {
  const m = name.match(/(\d{2,3})\s*bpm/i) || name.match(/_(\d{2,3})_/);
  if (!m) return null;
  const v = parseInt(m[1], 10);
  return v >= 40 && v <= 220 ? v : null;
}

export function detectKey(name: string): string {
  const m = name.match(/[\s_-]([A-G][#b]?m?)(?:in|maj)?[\s_.-]/i);
  return m ? m[1] : "";
}

export function sanitizeCategory(v: string): LoopCategory {
  return (VALID_CATEGORIES as string[]).includes(v) ? (v as LoopCategory) : "synth";
}

export function colorForCategory(cat: LoopCategory): string {
  return CATEGORY_COLORS[cat] || "#06b6d4";
}

export async function listUserSounds(): Promise<UserSoundRow[]> {
  const { data, error } = await supabase
    .from("sound_library")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[userSoundLibrary] list error:", error);
    return [];
  }
  return (data ?? []) as UserSoundRow[];
}

export function userRowToLoopDef(row: UserSoundRow): LoopDef {
  const cat = sanitizeCategory(row.category);
  return {
    id: `user-${row.id}`,
    name: row.name,
    pack: row.pack || "My Library",
    genre: row.genre || "Custom",
    category: cat,
    bpm: row.bpm ?? 120,
    bars: 2,
    key: row.musical_key || undefined,
    color: row.color || colorForCategory(cat),
  };
}

const audioCache = new Map<string, AudioBuffer>();

export async function fetchAndDecodeUserSound(
  row: UserSoundRow,
  ctx: AudioContext,
): Promise<AudioBuffer> {
  const cached = audioCache.get(row.id);
  if (cached) return cached;
  const res = await downloadFromR2(row.r2_key);
  if (!res.success || !res.data) {
    throw new Error(res.error || "Failed to download sound");
  }
  const arr = await res.data.arrayBuffer();
  const buf = await ctx.decodeAudioData(arr);
  audioCache.set(row.id, buf);
  return buf;
}
