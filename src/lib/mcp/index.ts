import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getFeaturedContent from "./tools/get-featured-content";
import askYaj from "./tools/ask-yaj";

// Issuer must be the direct Supabase host, built from the project ref literal.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "wheuat-mcp",
  title: "WHEUAT",
  version: "0.1.0",
  instructions:
    "Tools for WHEUAT — a mobile-first platform for independent artists and creators. Use `get_featured_content` to browse recent podcasts, videos, songs, battles, or posts. Use `ask_yaj` to consult YAJ, the app's AI companion, for creative ideas, music, opportunities, Circles, collaboration, and platform guidance.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getFeaturedContent, askYaj],
});
