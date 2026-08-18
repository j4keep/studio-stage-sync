import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "get_featured_content",
  title: "Get featured YAJ content",
  description:
    "List recent public content on YAJ (podcasts, videos, songs, battles, or feed posts). Use this to see what creators are publishing.",
  inputSchema: {
    kind: z
      .enum(["podcasts", "videos", "songs", "battles", "posts"])
      .describe("Which type of content to fetch."),
    limit: z.number().int().min(1).max(25).default(10).describe("How many items to return (max 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ kind, limit }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      return { content: [{ type: "text", text: "Backend not configured." }], isError: true };
    }
    const sb = createClient(url, key, { auth: { persistSession: false } });

    const table = kind === "posts" ? "feed_posts" : kind;
    const { data, error } = await sb
      .from(table)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { items: data ?? [] },
    };
  },
});
