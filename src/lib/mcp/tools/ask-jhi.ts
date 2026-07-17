import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "ask_jhi",
  title: "Ask YAJ (YAJ Buddy community companion)",
  description:
    "Ask YAJ Buddy — YAJ's AI community companion — about creative ideas, music, opportunities, Circles, collaboration, or the YAJ platform.",
  inputSchema: {
    prompt: z.string().min(1).max(2000).describe("The question or request for YAJ Buddy."),
  },
  annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ prompt }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      return { content: [{ type: "text", text: "Backend not configured." }], isError: true };
    }
    const resp = await fetch(`${url}/functions/v1/ask-jhi`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
    });
    if (!resp.ok || !resp.body) {
      const txt = await resp.text().catch(() => "");
      return { content: [{ type: "text", text: `YAJ Buddy error (${resp.status}): ${txt}` }], isError: true };
    }
    // Parse SSE stream
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let out = "";
    let done = false;
    while (!done) {
      const { done: d, value } = await reader.read();
      if (d) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        let line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const s = line.slice(6).trim();
        if (s === "[DONE]") { done = true; break; }
        try {
          const p = JSON.parse(s);
          const c = p.choices?.[0]?.delta?.content;
          if (c) out += c;
        } catch { /* ignore */ }
      }
    }
    return { content: [{ type: "text", text: out.trim() || "(no response)" }] };
  },
});
