import { supabase } from "@/integrations/supabase/client";
import { generateR2Key, uploadToR2 } from "@/lib/r2-storage";

function safeName(name: string) {
  return (name || "podcast").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60) || "podcast";
}

function formatDuration(durationMs?: number) {
  if (!durationMs || durationMs <= 0) return null;
  const minutes = Math.max(1, Math.round(durationMs / 60000));
  return `${minutes} min`;
}

export async function publishPodcastAudio(input: {
  title: string;
  blob: Blob;
  mime?: string;
  ext?: string;
  durationMs?: number;
  coverUrl?: string | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("Sign in to publish a podcast");

  const ext = (input.ext || input.blob.type.split("/")[1] || "wav").replace(/[^a-z0-9]/gi, "").toLowerCase() || "wav";
  const mime = input.mime || input.blob.type || "audio/wav";
  const fileName = `${Date.now()}-${safeName(input.title)}.${ext}`;
  const key = generateR2Key(user.id, "podcasts", fileName);
  const file = input.blob instanceof File ? input.blob : new File([input.blob], fileName, { type: mime });

  const upload = await uploadToR2(file, { folder: undefined, fileName: key, mimeType: mime });
  if (!upload.success || !upload.data) throw new Error(upload.error || "Podcast upload failed");

  const { error } = await (supabase as any).from("podcasts").insert({
    user_id: user.id,
    title: input.title || "Podcast",
    episode: "New Episode",
    duration: formatDuration(input.durationMs),
    cover_url: input.coverUrl ?? null,
    media_url: upload.data.key,
    is_video: false,
  });
  if (error) throw error;

  window.dispatchEvent(new CustomEvent("wheuat-radio-updated"));
}