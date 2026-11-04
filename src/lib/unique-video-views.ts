import { supabase } from "@/integrations/supabase/client";

/** Server deduplicates by signed-in account across every viewing surface.
 * Anonymous viewers are not counted until abuse-resistant identity is available.
 * Called only after actual video playback, never when a thumbnail scrolls into view.
 */
export async function recordUniqueVideoView(
  contentId: string,
  surface: "post" | "circle",
): Promise<boolean> {
  const rpc = surface === "post" ? "record_unique_post_video_view" : "record_unique_circle_video_view";
  const idArg = surface === "post" ? "p_post_id" : "p_content_id";
  const { data, error } = await (supabase as any).rpc(rpc, { [idArg]: contentId });
  if (error) {
    console.warn("[video-views] Unique-view recording unavailable:", error.message);
    return false;
  }
  if (data === true) window.dispatchEvent(new Event("yaj-video-view-recorded"));
  return data === true;
}
