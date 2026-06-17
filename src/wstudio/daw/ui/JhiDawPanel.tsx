import { useState, useRef, useEffect } from "react";
import { ArrowUp, Trash2, Paperclip, X, Music2, MessageSquare, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import JhiIcon from "@/components/JhiIcon";

type ContentPart =
  | { type: "text"; text: string }
  | { type: "input_audio"; input_audio: { data: string; format: string } };

type Msg = {
  role: "user" | "assistant";
  content: string | ContentPart[];
  audioName?: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-jhi`;

function audioFormatFromMime(mime: string): string | null {
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav") || m.includes("wave")) return "wav";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("flac")) return "flac";
  return null;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const QUICK_PROMPTS = [
  "Give me a 4-bar 808 loop like Metro Boomin",
  "Suggest a chord progression in F minor",
  "What BPM works best for drill?",
];

/**
 * Floating Jhi button + slide-in side panel for use inside the DAW.
 * Self-contained: streams from the same `ask-jhi` edge function.
 */
export function JhiDawPanel({ themeMode = "dark" }: { themeMode?: "light" | "dark" }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDark = themeMode === "dark";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const handleAudioChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast.error("Audio files only");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Keep clips under ~8MB");
      return;
    }
    if (!audioFormatFromMime(file.type)) {
      toast.error("Use mp3, wav, m4a, webm, ogg, or flac");
      return;
    }
    setAudioFile(file);
  };

  const send = async (text: string) => {
    if ((!text.trim() && !audioFile) || isLoading) return;
    let userContent: string | ContentPart[];
    let audioName: string | undefined;
    if (audioFile) {
      const format = audioFormatFromMime(audioFile.type)!;
      const data = await fileToBase64(audioFile);
      audioName = audioFile.name;
      userContent = [
        { type: "text", text: text.trim() || "Listen to this clip and break it down." },
        { type: "input_audio", input_audio: { data, format } },
      ];
    } else {
      userContent = text.trim();
    }
    const userMsg: Msg = { role: "user", content: userContent, audioName };
    const all = [...messages, userMsg];
    setMessages(all);
    setInput("");
    setAudioFile(null);
    setIsLoading(true);

    let soFar = "";
    const upsert = (chunk: string) => {
      soFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: soFar } : m));
        }
        return [...prev, { role: "assistant", content: soFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: all.map((m) => ({ role: m.role, content: m.content })) }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to reach Jhi");
      }
      if (!resp.body) throw new Error("No response stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const r = await reader.read();
        if (r.done) break;
        buf += decoder.decode(r.value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Jhi error");
      if (soFar === "") setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  // Theme classes
  const bg = isDark ? "bg-neutral-950" : "bg-white";
  const border = isDark ? "border-neutral-800" : "border-neutral-200";
  const text = isDark ? "text-neutral-100" : "text-neutral-900";
  const muted = isDark ? "text-neutral-400" : "text-neutral-500";
  const cardBg = isDark ? "bg-neutral-900" : "bg-neutral-50";

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[80] w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 shadow-2xl shadow-cyan-500/30 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform"
          title="Ask Jhi"
        >
          <JhiIcon className="w-7 h-7" active />
        </button>
      )}

      {/* Side panel */}
      {open && (
        <div
          className={`fixed top-0 right-0 bottom-0 z-[80] w-full sm:w-[420px] ${bg} ${text} border-l ${border} shadow-2xl flex flex-col`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${border}`}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center">
                <JhiIcon className="w-5 h-5" active />
              </div>
              <div>
                <div className="text-sm font-bold">Ask Jhi</div>
                <div className={`text-[10px] ${muted}`}>Producer · in-DAW assistant</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={() => { setMessages([]); toast.success("Chat cleared"); }}
                  className={`w-8 h-8 rounded-full ${cardBg} border ${border} flex items-center justify-center ${muted} hover:text-red-500 transition-colors`}
                  title="Clear chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className={`w-8 h-8 rounded-full ${cardBg} border ${border} flex items-center justify-center ${muted} hover:${text} transition-colors`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-cyan-400" />
                </div>
                <div className="text-center">
                  <div className="text-base font-bold">Your in-house producer</div>
                  <div className={`text-xs ${muted} mt-1 max-w-[280px]`}>
                    Ask for beats, chord progressions, mix tips. Attach a clip and I'll tell you the BPM, key, and vibe.
                  </div>
                </div>
                <div className="w-full space-y-1.5">
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className={`w-full p-2.5 rounded-xl ${cardBg} border ${border} text-[11px] text-left hover:border-cyan-500/40 transition-all leading-tight`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-cyan-600 to-blue-600 text-white rounded-br-md"
                      : `${cardBg} border ${border} rounded-bl-md`
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm [&>strong]:font-bold">
                        <ReactMarkdown>{typeof msg.content === "string" ? msg.content : ""}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {msg.audioName && (
                          <div className="flex items-center gap-1.5 text-[11px] opacity-90">
                            <Music2 className="w-3 h-3" />
                            <span className="truncate max-w-[200px]">{msg.audioName}</span>
                          </div>
                        )}
                        <div>{typeof msg.content === "string" ? msg.content : (msg.content.find((p) => p.type === "text") as { text: string } | undefined)?.text}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className={`${cardBg} border ${border} rounded-2xl rounded-bl-md px-4 py-3`}>
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-500/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-cyan-500/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-cyan-500/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className={`px-3 pb-3 pt-2 border-t ${border} space-y-2`}>
            {audioFile && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs">
                <Music2 className="w-3.5 h-3.5 text-cyan-400" />
                <span className="flex-1 truncate">{audioFile.name}</span>
                <button onClick={() => setAudioFile(null)} className={`${muted} hover:text-red-500`}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className={`flex items-end gap-2 ${cardBg} border ${border} rounded-2xl px-2 py-2`}>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac,.aac"
                className="hidden"
                onChange={handleAudioChosen}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className={`w-8 h-8 rounded-full ${bg} border ${border} flex items-center justify-center ${muted} hover:text-cyan-400 disabled:opacity-40 transition-colors shrink-0`}
                title="Attach an audio clip"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder={audioFile ? "Add a note (optional)..." : "Ask for a beat, chord, mix tip..."}
                rows={1}
                className={`flex-1 bg-transparent text-sm ${text} placeholder:${muted.replace("text-", "text-")} resize-none outline-none max-h-24`}
                style={{ minHeight: "24px" }}
              />
              <button
                onClick={() => send(input)}
                disabled={(!input.trim() && !audioFile) || isLoading}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white disabled:opacity-40 transition-opacity shrink-0"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default JhiDawPanel;
