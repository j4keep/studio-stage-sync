const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-jhi`;

async function collectJhiStream(resp: Response): Promise<string> {
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to reach Jhi");
  }
  if (!resp.body) throw new Error("No response from Jhi");

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

async function askJhi(prompt: string): Promise<string> {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
  });
  const raw = await collectJhiStream(resp);
  return raw.replace(/^["'`]+|["'`]+$/g, "").trim();
}

/** Use J-Hi to polish a post title. */
export async function jhiRewritePostTitle(title: string, description?: string): Promise<string> {
  const ctx = description?.trim() ? `\nPost description for context: ${description.trim()}` : "";
  return askJhi(
    `Rewrite this social media post title to be catchy, clear, and scroll-stopping. Max 80 characters. Return ONLY the rewritten title — no quotes, labels, hashtags, or explanation.${ctx}\n\nTitle: ${title.trim() || "Untitled post"}`,
  );
}

/** Use J-Hi to polish a post description. */
export async function jhiRewritePostDescription(description: string, title?: string): Promise<string> {
  const ctx = title?.trim() ? `\nPost title for context: ${title.trim()}` : "";
  return askJhi(
    `Rewrite this social media post description to be engaging and natural. Keep it concise (1–3 short sentences). Return ONLY the rewritten description — no quotes, labels, or explanation.${ctx}\n\nDescription: ${description.trim() || "No description yet"}`,
  );
}
