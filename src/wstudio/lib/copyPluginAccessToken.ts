import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Copies the current Supabase user JWT for the native plugin session-lookup (Bearer). */
export async function copyAccessTokenForPlugin(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    toast.error("Sign in required.");
    return false;
  }
  try {
    await navigator.clipboard.writeText(token);
    toast.success(
      "Access token copied. Paste it into the W.Studio plugin SYNC field. It expires when your browser session ends — copy again if SYNC fails.",
    );
    return true;
  } catch {
    toast.error("Could not copy. Allow clipboard access or copy the token from storage manually.");
    return false;
  }
}
