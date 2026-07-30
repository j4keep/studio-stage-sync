const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-yaj`;

async function collectYajStream(resp: Response): Promise<string> {
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to reach YAJ Buddy");
  }
  if (!resp.body) throw new Error("No response from YAJ Buddy");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let result = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) result += content;
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  return result.trim();
}

async function askYaj(prompt: string): Promise<string> {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
  });
  const raw = await collectYajStream(resp);
  return raw.replace(/^["'`]+|["'`]+$/g, "").trim();
}

/** Use YAJ Buddy to polish a post title. */
export async function yajRewritePostTitle(title: string, description?: string): Promise<string> {
  const ctx = description?.trim() ? `\nPost description for context: ${description.trim()}` : "";
  return askYaj(
    `As YAJ Buddy, rewrite this YAJ community post title to be catchy, clear, and scroll-stopping. Max 80 characters. Preserve the user's voice. Return ONLY the rewritten title — no quotes, labels, hashtags, or explanation.${ctx}\n\nTitle: ${title.trim() || "Untitled post"}`,
  );
}

/** Use YAJ Buddy to polish a post description. */
export async function yajRewritePostDescription(description: string, title?: string): Promise<string> {
  const ctx = title?.trim() ? `\nPost title for context: ${title.trim()}` : "";
  return askYaj(
    `As YAJ Buddy, rewrite this YAJ community post description to be engaging and natural. Preserve the user's voice and intent. Keep it concise (1–3 short sentences). Return ONLY the rewritten description — no quotes, labels, or explanation.${ctx}\n\nDescription: ${description.trim() || "No description yet"}`,
  );
}
