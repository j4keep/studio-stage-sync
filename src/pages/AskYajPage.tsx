import { useState, useRef, useEffect } from "react";
import { ArrowUp, Trash2, X, Music2, Mic, Square, Volume2, Loader2, ImagePlus, Plus, AudioLines, Paperclip } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import YajAiGeneratorIcon from "@/components/YajAiGeneratorIcon";
import YajVoiceMode from "@/components/YajVoiceMode";
import ReactMarkdown from "react-markdown";
import {
  generateYajImage,
  synthesizeYajVoice,
  transcribeYajAudio,
  looksLikeImageRequest,
  startMicRecording,
  playYajAudio,
  stopYajAudio,
  unlockYajAudio,
  acquireMicStream,
  describeMicError,
  type MicRecorder,
} from "@/lib/yaj-media";

type ContentPart =
  | { type: "text"; text: string }
  | { type: "input_audio"; input_audio: { data: string; format: string } };

type Msg = {
  role: "user" | "assistant";
  content: string | ContentPart[];
  // UI-only metadata for rendering a user message with an attached clip
  audioName?: string;
  imageUrl?: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-yaj`;

const SUGGESTIONS = [
  "Help me find a creative collaborator in my community",
  "Give me a launch plan for my next song",
  "Write a strong post for a new opportunity",
  "How can I grow my Circle and keep people engaged?",
];

// Map a File's MIME type to the format string Lovable AI Gateway expects.
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

// Strip UI-only fields and convert string content to plain text for the API.
function toApiMessages(messages: Msg[]) {
  return messages
    .filter((m) => typeof m.content !== "string" || m.content.trim() !== "")
    .map((m) => ({ role: m.role, content: m.content }));
}

const AskYajPage = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceStream, setVoiceStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MicRecorder | null>(null);
  const messagesRef = useRef<Msg[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => () => {
    stopYajAudio();
    recorderRef.current?.cancel();
  }, []);

  const handlePickAudio = () => fileInputRef.current?.click();

  const stopSpeaking = () => {
    stopYajAudio();
    setSpeakingIndex(null);
  };

  const speak = async (text: string, index: number) => {
    if (speakingIndex === index) {
      stopSpeaking();
      return;
    }
    stopSpeaking();
    if (!text.trim()) return;
    unlockYajAudio();
    setSpeakingIndex(index);
    try {
      const src = await synthesizeYajVoice(text);
      playYajAudio(src, () => setSpeakingIndex((cur) => (cur === index ? null : cur)));
    } catch (e: any) {
      setSpeakingIndex(null);
      toast({ title: "Voice unavailable", description: e.message || "Try again.", variant: "destructive" });
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      const rec = recorderRef.current;
      recorderRef.current = null;
      setIsRecording(false);
      if (!rec) return;
      setIsTranscribing(true);
      try {
        const dataUrl = await rec.stop();
        if (!dataUrl) {
          toast({ title: "Nothing recorded", description: "Hold on a little longer and try again." });
          return;
        }
        const text = await transcribeYajAudio(dataUrl);
        if (!text) {
          toast({ title: "Didn't catch that", description: "Try speaking a bit closer to the mic." });
          return;
        }
        await sendMessage(text);
      } catch (e: any) {
        toast({ title: "Voice input failed", description: e.message || "Try again.", variant: "destructive" });
      } finally {
        setIsTranscribing(false);
      }
      return;
    }

    try {
      stopSpeaking();
      unlockYajAudio();
      recorderRef.current = await startMicRecording();
      setIsRecording(true);
    } catch (e) {
      toast({
        title: "Microphone",
        description: describeMicError(e),
        variant: "destructive",
      });
    }
  };

  const handleAudioChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      toast({ title: "Audio only", description: "Pick an audio file (mp3, wav, m4a, webm).", variant: "destructive" });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Too long", description: "Keep clips under ~8MB (a few seconds is plenty).", variant: "destructive" });
      return;
    }
    if (!audioFormatFromMime(file.type)) {
      toast({ title: "Unsupported format", description: "Use mp3, wav, m4a, webm, ogg, or flac.", variant: "destructive" });
      return;
    }
    setAudioFile(file);
  };

  const generateImage = async (prompt: string) => {
    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    setInput("");
    setImageMode(false);
    setIsLoading(true);
    try {
      const image = await generateYajImage(prompt);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Here's what I made for you 🎨", imageUrl: image },
      ]);
    } catch (e: any) {
      toast({ title: "Couldn't make that image", description: e.message || "Try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (text: string): Promise<string> => {
    if ((!text.trim() && !audioFile) || isLoading) return "";

    if (!audioFile && (imageMode || looksLikeImageRequest(text))) {
      await generateImage(text.trim());
      return "";
    }

    let userContent: string | ContentPart[];
    let audioName: string | undefined;

    if (audioFile) {
      const format = audioFormatFromMime(audioFile.type)!;
      const data = await fileToBase64(audioFile);
      audioName = audioFile.name;
      userContent = [
        { type: "text", text: text.trim() || "Listen to this clip — analyze it and tell me what you hear." },
        { type: "input_audio", input_audio: { data, format } },
      ];
    } else {
      userContent = text.trim();
    }

    const userMsg: Msg = { role: "user", content: userContent, audioName };
    const allMessages = [...messagesRef.current, userMsg];
    setMessages(allMessages);
    setInput("");
    setAudioFile(null);
    setIsLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: toApiMessages(allMessages) }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to reach YAJ");
      }

      if (!resp.body) throw new Error("No response stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
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
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }

      return assistantSoFar;
    } catch (e: any) {
      console.error("YAJ error:", e);
      toast({ title: "Oops!", description: e.message || "Something went wrong", variant: "destructive" });
      if (assistantSoFar === "") {
        setMessages((prev) => prev.slice(0, -1));
      }
      return assistantSoFar;
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    toast({ title: "Chat cleared" });
  };

  const renderUserContent = (msg: Msg) => {
    const text = typeof msg.content === "string"
      ? msg.content
      : (msg.content.find((p) => p.type === "text") as { text: string } | undefined)?.text ?? "";
    return (
      <div className="space-y-1.5">
        {msg.audioName && (
          <div className="flex items-center gap-1.5 text-[11px] opacity-90">
            <Music2 className="w-3 h-3" />
            <span className="truncate max-w-[180px]">{msg.audioName}</span>
          </div>
        )}
        {text && <div>{text}</div>}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <YajAiGeneratorIcon className="w-5 h-5" active />
          </div>
          <div>
            <h1 className="text-sm font-display font-bold text-foreground">Ask YAJ</h1>
            <p className="text-[10px] text-muted-foreground">Community companion</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <YajAiGeneratorIcon className="w-10 h-10" active />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-display font-bold text-foreground">Hey! I'm YAJ</h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                Your AI community companion for ideas, opportunities, music, and building together. Your space. Your people. Your vibe.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full max-w-sm mt-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="p-2.5 rounded-xl bg-card border border-border text-[11px] text-foreground font-medium text-left hover:border-primary/30 transition-all leading-tight"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-card border border-border text-foreground rounded-bl-md"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="space-y-2">
                    {typeof msg.content === "string" && msg.content && (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                    {msg.imageUrl && (
                      <img
                        src={msg.imageUrl}
                        alt="Image generated by YAJ"
                        loading="lazy"
                        className="rounded-xl w-full max-w-[320px] border border-border"
                      />
                    )}
                    {typeof msg.content === "string" && msg.content.trim() && (
                      <button
                        onClick={() => speak(msg.content as string, i)}
                        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                      >
                        {speakingIndex === i ? <Square className="w-3 h-3" /> : <Volume2 className="w-3.5 h-3.5" />}
                        {speakingIndex === i ? "Stop" : "Listen"}
                      </button>
                    )}
                  </div>
                ) : (
                  renderUserContent(msg)
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-border space-y-2">
        {audioFile && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/30 text-xs text-foreground">
            <Music2 className="w-3.5 h-3.5 text-primary" />
            <span className="flex-1 truncate">{audioFile.name}</span>
            <button onClick={() => setAudioFile(null)} className="text-muted-foreground hover:text-destructive">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {imageMode && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/30 text-xs text-foreground">
            <ImagePlus className="w-3.5 h-3.5 text-primary" />
            <span className="flex-1">Image mode — describe what to create</span>
            <button onClick={() => setImageMode(false)} className="text-muted-foreground hover:text-destructive">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {menuOpen && (
          <div className="rounded-2xl bg-card border border-border overflow-hidden">
            <button
              onClick={() => { setMenuOpen(false); setImageMode(true); inputRef.current?.focus(); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <ImagePlus className="w-4 h-4 text-muted-foreground" />
              Create an image
            </button>
            <button
              onClick={() => { setMenuOpen(false); handlePickAudio(); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors border-t border-border"
            >
              <Paperclip className="w-4 h-4 text-muted-foreground" />
              Attach an audio clip
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 bg-card border border-border rounded-2xl px-2 py-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac,.aac"
            className="hidden"
            onChange={handleAudioChosen}
          />
          <button
            onClick={() => setMenuOpen((v) => !v)}
            disabled={isLoading}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary disabled:opacity-40 transition-colors shrink-0"
            aria-label="More options"
          >
            <Plus className={`w-5 h-5 transition-transform ${menuOpen ? "rotate-45" : ""}`} />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isRecording
                ? "Listening… tap stop when you're done"
                : imageMode
                  ? "Describe the image you want..."
                  : audioFile
                    ? "Add a note (optional)..."
                    : "Ask YAJ anything..."
            }
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-24"
            style={{ minHeight: "24px" }}
          />
          <button
            onClick={toggleRecording}
            disabled={isLoading || isTranscribing}
            className={`w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-40 transition-colors shrink-0 ${
              isRecording ? "bg-destructive text-destructive-foreground animate-pulse" : "text-muted-foreground hover:text-primary"
            }`}
            aria-label={isRecording ? "Stop and send" : "Dictate a message"}
          >
            {isTranscribing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isRecording ? (
              <Square className="w-3.5 h-3.5" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>
          {input.trim() || audioFile ? (
            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading}
              className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground disabled:opacity-40 transition-opacity shrink-0"
              aria-label="Send"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => {
                void (async () => {
                  unlockYajAudio();
                  stopSpeaking();
                  // Acquire mic in this tap so iOS/Safari don't treat a later
                  // useEffect getUserMedia as "blocked".
                  try {
                    const stream = await acquireMicStream();
                    setVoiceStream(stream);
                    setVoiceMode(true);
                  } catch (e) {
                    toast({
                      title: "Microphone",
                      description: describeMicError(e),
                      variant: "destructive",
                    });
                  }
                })();
              }}
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground shrink-0"
              aria-label="Start voice conversation"
            >
              <AudioLines className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {voiceMode && (
        <YajVoiceMode
          onSend={(text) => sendMessage(text)}
          initialStream={voiceStream}
          onClose={() => {
            setVoiceMode(false);
            voiceStream?.getTracks().forEach((t) => t.stop());
            setVoiceStream(null);
          }}
        />
      )}
    </div>
  );
};

export default AskYajPage;
