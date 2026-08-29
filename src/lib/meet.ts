import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/marketplace-api";
import { getR2DownloadUrl, uploadToR2 } from "@/lib/r2-storage";

export const MEET_MAX_PHOTOS = 4;

export type MeetProfile = {
  user_id: string;
  display_name: string;
  headline: string | null;
  bio: string | null;
  birth_year: number | null;
  gender: string | null;
  looking_for: string | null;
  city: string | null;
  photo_urls: string[];
  interests: string[];
  prompt_question: string | null;
  prompt_answer: string | null;
  open_to_interview: boolean;
  is_visible: boolean;
  created_at?: string;
  updated_at?: string;
};

export type MeetInterviewRequest = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  message: string | null;
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: string;
  updated_at?: string;
};

export const MEET_PROMPT_OPTIONS = [
  "A perfect first hang looks like…",
  "I'm looking for someone who…",
  "My friends would describe me as…",
  "Ask me about…",
  "I geek out on…",
];

export const MEET_LOOKING_OPTIONS = [
  "Friendship",
  "Dating",
  "Something serious",
  "Not sure yet",
];

const LOCAL_PROFILES_KEY = "yaj_meet_profiles_v1";
const LOCAL_REQUESTS_KEY = "yaj_meet_requests_v1";

function readLocalProfiles(): MeetProfile[] {
  try {
    const raw = localStorage.getItem(LOCAL_PROFILES_KEY);
    return raw ? (JSON.parse(raw) as MeetProfile[]) : [];
  } catch {
    return [];
  }
}

function writeLocalProfiles(rows: MeetProfile[]) {
  try {
    localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

function readLocalRequests(): MeetInterviewRequest[] {
  try {
    const raw = localStorage.getItem(LOCAL_REQUESTS_KEY);
    return raw ? (JSON.parse(raw) as MeetInterviewRequest[]) : [];
  } catch {
    return [];
  }
}

function writeLocalRequests(rows: MeetInterviewRequest[]) {
  try {
    localStorage.setItem(LOCAL_REQUESTS_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

function normalizeProfile(row: any): MeetProfile {
  const photos = Array.isArray(row.photo_urls)
    ? row.photo_urls.filter((u: unknown) => typeof u === "string")
    : [];
  const interests = Array.isArray(row.interests)
    ? row.interests.filter((u: unknown) => typeof u === "string")
    : [];
  return {
    user_id: row.user_id,
    display_name: row.display_name || "Member",
    headline: row.headline ?? null,
    bio: row.bio ?? null,
    birth_year: row.birth_year ?? null,
    gender: row.gender ?? null,
    looking_for: row.looking_for ?? null,
    city: row.city ?? null,
    photo_urls: photos,
    interests,
    prompt_question: row.prompt_question ?? null,
    prompt_answer: row.prompt_answer ?? null,
    open_to_interview: row.open_to_interview !== false,
    is_visible: row.is_visible !== false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function ageFromBirthYear(year: number | null | undefined): number | null {
  if (!year || year < 1900) return null;
  const now = new Date();
  // Treat birth year as Jan 1 for Meet display age (year-of-birth UX).
  return Math.max(0, now.getFullYear() - year);
}

/** Meet is 18+. Birth year is required; under-18 cannot create or keep a visible profile. */
export function meetAgeGate(birthYear: number | null | undefined): {
  ok: boolean;
  age: number | null;
  error: string | null;
} {
  if (birthYear == null || birthYear === ("" as unknown) || !Number.isFinite(Number(birthYear))) {
    return { ok: false, age: null, error: "Enter the year you were born. Meet on YAJ is 18+ only." };
  }
  const y = Math.floor(Number(birthYear));
  const currentYear = new Date().getFullYear();
  if (!Number.isFinite(y) || y < 1900 || y > currentYear) {
    return { ok: false, age: null, error: "Enter a valid birth year." };
  }
  const age = currentYear - y;
  if (age < 18) {
    return {
      ok: false,
      age,
      error: "You must be 18 or older to use Meet on YAJ. Under-18 profiles are not allowed.",
    };
  }
  if (age > 120) {
    return { ok: false, age, error: "Enter a valid birth year." };
  }
  return { ok: true, age, error: null };
}

export async function uploadMeetPhoto(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose a photo (JPG, PNG, or HEIC).");
  }
  const compressed = await compressImage(file, 1600, 0.84);
  const ext =
    (compressed.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${
    ext === "heic" || ext === "heif" ? "jpg" : ext
  }`;
  const mime = compressed.type || "image/jpeg";
  const path = `meet/${userId}/${safeName}`;

  try {
    const { error } = await supabase.storage.from("media").upload(path, compressed, {
      upsert: true,
      contentType: mime,
    });
    if (!error) {
      const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
      if (pub?.publicUrl) return pub.publicUrl;
    }
  } catch {
    /* fall through to R2 */
  }

  const res = await uploadToR2(compressed, {
    folder: "meet",
    fileName: `${userId}/${safeName}`,
    mimeType: mime,
  });
  if (!res.success || !res.data?.key) throw new Error(res.error || "Photo upload failed");
  return getR2DownloadUrl(res.data.key);
}

export async function listMeetProfiles(opts?: {
  excludeUserId?: string | null;
  city?: string | null;
  /** When true (default), only profiles with at least one photo appear in the browse grid. */
  requirePhotos?: boolean;
}): Promise<MeetProfile[]> {
  const requirePhotos = opts?.requirePhotos !== false;

  const { data, error } = await supabase
    .from("meet_profiles" as any)
    .select("*")
    .eq("is_visible", true)
    .order("updated_at", { ascending: false })
    .limit(80);

  if (error) {
    console.warn("[meet] listMeetProfiles fallback", error.message);
    let rows = readLocalProfiles().filter((p) => p.is_visible);
    if (opts?.excludeUserId) rows = rows.filter((p) => p.user_id !== opts.excludeUserId);
    if (opts?.city) {
      const c = opts.city.toLowerCase();
      rows = rows.filter((p) => (p.city || "").toLowerCase().includes(c));
    }
    rows = rows.filter((p) => meetAgeGate(p.birth_year).ok);
    if (requirePhotos) rows = rows.filter((p) => p.photo_urls.length > 0);
    return rows;
  }

  let rows = (data || []).map(normalizeProfile);
  if (opts?.excludeUserId) rows = rows.filter((p) => p.user_id !== opts.excludeUserId);
  if (opts?.city) {
    const c = opts.city.toLowerCase();
    rows = rows.filter((p) => (p.city || "").toLowerCase().includes(c));
  }
  // Never surface under-18 or missing-age profiles in the dating scroll.
  rows = rows.filter((p) => meetAgeGate(p.birth_year).ok);
  if (requirePhotos) rows = rows.filter((p) => p.photo_urls.length > 0);
  return rows;
}

export async function getMeetProfile(userId: string): Promise<MeetProfile | null> {
  const { data, error } = await supabase
    .from("meet_profiles" as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[meet] getMeetProfile fallback", error.message);
    return readLocalProfiles().find((p) => p.user_id === userId) ?? null;
  }
  return data ? normalizeProfile(data) : null;
}

export async function upsertMeetProfile(
  userId: string,
  patch: Partial<MeetProfile> & { display_name: string; birth_year: number },
): Promise<MeetProfile> {
  const gate = meetAgeGate(patch.birth_year);
  if (!gate.ok) {
    throw new Error(gate.error || "You must be 18 or older to use Meet on YAJ.");
  }

  const photos = (patch.photo_urls ?? [])
    .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    .map((u) => u.trim())
    .slice(0, MEET_MAX_PHOTOS);
  const visible = patch.is_visible !== false;
  if (visible && photos.length < 1) {
    throw new Error("Add at least one photo to show your Meet profile.");
  }

  const payload = {
    user_id: userId,
    display_name: patch.display_name,
    headline: patch.headline ?? null,
    bio: patch.bio ?? null,
    birth_year: Math.floor(Number(patch.birth_year)),
    gender: patch.gender ?? null,
    looking_for: patch.looking_for ?? null,
    city: patch.city ?? null,
    photo_urls: photos,
    interests: patch.interests ?? [],
    prompt_question: patch.prompt_question ?? null,
    prompt_answer: patch.prompt_answer ?? null,
    open_to_interview: patch.open_to_interview !== false,
    is_visible: visible,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("meet_profiles" as any)
    .upsert(payload as any, { onConflict: "user_id" })
    .select("*")
    .maybeSingle();

  if (error) {
    console.warn("[meet] upsertMeetProfile fallback", error.message);
    const rows = readLocalProfiles().filter((p) => p.user_id !== userId);
    const next = normalizeProfile({ ...payload, created_at: new Date().toISOString() });
    writeLocalProfiles([next, ...rows]);
    return next;
  }
  return normalizeProfile(data);
}

export async function requestInterview(opts: {
  fromUserId: string;
  toUserId: string;
  message?: string;
}): Promise<MeetInterviewRequest> {
  if (opts.fromUserId === opts.toUserId) throw new Error("You can't interview yourself.");

  const payload = {
    from_user_id: opts.fromUserId,
    to_user_id: opts.toUserId,
    message: opts.message?.trim() || null,
    status: "pending" as const,
  };

  const { data, error } = await supabase
    .from("meet_interview_requests" as any)
    .upsert(payload as any, { onConflict: "from_user_id,to_user_id" })
    .select("*")
    .maybeSingle();

  if (error) {
    console.warn("[meet] requestInterview fallback", error.message);
    const rows = readLocalRequests().filter(
      (r) => !(r.from_user_id === opts.fromUserId && r.to_user_id === opts.toUserId),
    );
    const next: MeetInterviewRequest = {
      id: crypto.randomUUID(),
      ...payload,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    writeLocalRequests([next, ...rows]);
    return next;
  }
  return data as MeetInterviewRequest;
}

export async function listMyInterviewInbox(userId: string): Promise<MeetInterviewRequest[]> {
  const { data, error } = await supabase
    .from("meet_interview_requests" as any)
    .select("*")
    .or(`to_user_id.eq.${userId},from_user_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.warn("[meet] listMyInterviewInbox fallback", error.message);
    return readLocalRequests().filter((r) => r.to_user_id === userId || r.from_user_id === userId);
  }
  return (data || []) as MeetInterviewRequest[];
}

export async function respondToInterview(
  requestId: string,
  status: "accepted" | "declined" | "cancelled",
): Promise<void> {
  const { error } = await supabase
    .from("meet_interview_requests" as any)
    .update({ status, updated_at: new Date().toISOString() } as any)
    .eq("id", requestId);

  if (error) {
    console.warn("[meet] respondToInterview fallback", error.message);
    const rows = readLocalRequests().map((r) =>
      r.id === requestId ? { ...r, status, updated_at: new Date().toISOString() } : r,
    );
    writeLocalRequests(rows);
  }
}

export async function getInterviewBetween(
  fromUserId: string,
  toUserId: string,
): Promise<MeetInterviewRequest | null> {
  const { data, error } = await supabase
    .from("meet_interview_requests" as any)
    .select("*")
    .eq("from_user_id", fromUserId)
    .eq("to_user_id", toUserId)
    .maybeSingle();

  if (error) {
    return (
      readLocalRequests().find((r) => r.from_user_id === fromUserId && r.to_user_id === toUserId) ??
      null
    );
  }
  return (data as MeetInterviewRequest) || null;
}
