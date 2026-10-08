import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowUp, Trash2, X, Music2, Mic, Square, Volume2, Loader2, ImagePlus, Plus, AudioLines, Paperclip, Settings2, Camera, Images, FileText } from "lucide-react";
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
import { getWellnessCoachVoice } from "@/lib/wellness-coach-prefs";
import { supabase } from "@/integrations/supabase/client";
import {
  bumpYajAiActivity,
  getYajAiAutoSpeakReplies,
} from "@/lib/yaj-ai-prefs";

type ContentPart =
  | { type: "text"; text: string }
  | { type: "input_audio"; input_audio: { data: string; format: string } }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

type Msg = {
  role: "user" | "assistant";
  content: string | ContentPart[];
  // UI-only metadata for rendering a user message with an attached clip
  audioName?: string;
  imageUrl?: string;
  /** Preview of a camera frame the user showed YAJ (also may live in content). */
  cameraPreviewUrl?: string;
  attachmentName?: string;
  attachmentKind?: "image" | "file";
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-yaj`;

const SUGGESTIONS = [
  "How do I use Find Local Help and hire someone?",
  "Show me where to change my YAJ profile and settings",
  "How do I contact customer service or report a problem?",
  "What can I do in Explore and where should I start?",
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

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Strip UI-only fields. Keep camera images only on the latest user turn so
// history stays light; older frames become a short text placeholder.
function toApiMessages(messages: Msg[]) {
  const filtered = messages.filter(
    (m) => typeof m.content !== "string" || m.content.trim() !== "",
  );
  let lastUserIdx = -1;
  for (let i = filtered.length - 1; i >= 0; i--) {
    if (filtered[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }

  return filtered.map((m, i) => {
    if (typeof m.content === "string") return { role: m.role, content: m.content };
    const keepImages = m.role === "user" && i === lastUserIdx;
    const parts = m.content.flatMap((p): ContentPart[] => {
      if (p.type === "image_url" && !keepImages) {
        return [{ type: "text", text: "[Previously attached an image]" }];
      }
      if (p.type === "file" && !keepImages) {
        return [{ type: "text", text: `[Previously attached file: ${p.file.filename}]` }];
      }
      return [p];
    });
    return { role: m.role, content: parts };
  });
}

const AskYajPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [attachedImage, setAttachedImage] = useState<{ name: string; dataUrl: string } | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; dataUrl: string; type: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceStream, setVoiceStream] = useState<MediaStream | null>(null);
  const [voiceSeedPrompt, setVoiceSeedPrompt] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MicRecorder | null>(null);
  const messagesRef = useRef<Msg[]>([]);
  const wellnessVoiceLaunchRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => () => {
    stopYajAudio();
    recorderRef.current?.cancel();
  }, []);

  useEffect(() => {
    bumpYajAiActivity("chat");
  }, []);

  /** Wellness mood check-in → open voice mode with a seeded prompt. */
  useEffect(() => {
    const state = location.state as { openVoice?: boolean; prompt?: string } | null;
    if (!state?.openVoice || wellnessVoiceLaunchRef.current) return;
    wellnessVoiceLaunchRef.current = true;
    const prompt = typeof state.prompt === "string" ? state.prompt.trim() : "";
    navigate(location.pathname, { replace: true, state: {} });
    void (async () => {
      unlockYajAudio();
      stopYajAudio();
      setSpeakingIndex(null);
      try {
        const stream = await acquireMicStream();
        bumpYajAiActivity("voice");
        setVoiceStream(stream);
        setVoiceSeedPrompt(prompt || null);
        setVoiceMode(true);
      } catch (e) {
        wellnessVoiceLaunchRef.current = false;
        toast({
          title: "Microphone",
          description: describeMicError(e),
          variant: "destructive",
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

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
      const src = await synthesizeYajVoice(text, getWellnessCoachVoice());
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
        await sendAndMaybeSpeak(text);
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

  const handleImageChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Image required", description: "Choose a photo or image file.", variant: "destructive" });
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Choose an image under 12MB.", variant: "destructive" });
      return;
    }
    try {
      setAttachedImage({ name: file.name || "Photo", dataUrl: await fileToDataUrl(file) });
      setAttachedFile(null);
      setMenuOpen(false);
      inputRef.current?.focus();
    } catch {
      toast({ title: "Couldn't attach image", variant: "destructive" });
    }
  };

  const handleDocumentChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const allowed = /pdf|text|csv|json|xml|html|markdown|msword|officedocument/i.test(file.type) ||
      /\.(pdf|txt|md|csv|json|xml|html?|docx?)$/i.test(file.name);
    if (!allowed) {
      toast({ title: "Unsupported file", description: "Use PDF, Word, text, CSV, JSON, XML, HTML, or Markdown.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Keep documents under 10MB.", variant: "destructive" });
      return;
    }
    try {
      setAttachedFile({ name: file.name, dataUrl: await fileToDataUrl(file), type: file.type || "application/octet-stream" });
      setAttachedImage(null);
      setMenuOpen(false);
      inputRef.current?.focus();
    } catch {
      toast({ title: "Couldn't attach file", variant: "destructive" });
    }
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

  const sendMessage = async (
    text: string,
    options?: { imageDataUrl?: string },
  ): Promise<string> => {
    const imageDataUrl = options?.imageDataUrl || attachedImage?.dataUrl;
    if ((!text.trim() && !audioFile && !imageDataUrl && !attachedFile) || isLoading) return "";

    // Camera vision is recognition, not "generate an image".
    if (!audioFile && !imageDataUrl && (imageMode || looksLikeImageRequest(text))) {
      await generateImage(text.trim());
      return "";
    }

    let userContent: string | ContentPart[];
    let audioName: string | undefined;
    let cameraPreviewUrl: string | undefined;
    let attachmentName: string | undefined;
    let attachmentKind: "image" | "file" | undefined;

    if (audioFile) {
      const format = audioFormatFromMime(audioFile.type)!;
      const data = await fileToBase64(audioFile);
      audioName = audioFile.name;
      userContent = [
        { type: "text", text: text.trim() || "Listen to this clip — analyze it and tell me what you hear." },
        { type: "input_audio", input_audio: { data, format } },
      ];
    } else if (attachedFile) {
      attachmentName = attachedFile.name;
      attachmentKind = "file";
      userContent = [
        { type: "text", text: text.trim() || `Read ${attachedFile.name} and summarize the important information for me.` },
        { type: "file", file: { filename: attachedFile.name, file_data: attachedFile.dataUrl } },
      ];
    } else if (imageDataUrl) {
      cameraPreviewUrl = imageDataUrl;
      attachmentName = attachedImage?.name || "Photo";
      attachmentKind = "image";
      userContent = [
        {
          type: "text",
          text:
            text.trim() ||
            "I'm showing you something on my camera. Look carefully and tell me what you see — identify it if you can, and briefly explain.",
        },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ];
    } else {
      userContent = text.trim();
    }

    const userMsg: Msg = { role: "user", content: userContent, audioName, cameraPreviewUrl, attachmentName, attachmentKind };
    const allMessages = [...messagesRef.current, userMsg];
    setMessages(allMessages);
    setInput("");
    setAudioFile(null);
    setAttachedImage(null);
    setAttachedFile(null);
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
      const { data: sessionData } = await supabase.auth.getSession();
      const authToken =
        sessionData.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
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

  const sendAndMaybeSpeak = async (
    text: string,
    options?: { imageDataUrl?: string },
  ) => {
    const reply = await sendMessage(text, options);
    if (!reply.trim() || voiceMode || !getYajAiAutoSpeakReplies()) return;
    const index = messagesRef.current.length - 1;
    if (index >= 0 && messagesRef.current[index]?.role === "assistant") {
      void speak(reply, index);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendAndMaybeSpeak(input);
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
        {msg.attachmentKind === "file" && msg.attachmentName && (
          <div className="flex items-center gap-1.5 rounded-lg bg-black/10 px-2 py-1 text-[11px]">
            <FileText className="h-3.5 w-3.5" />
            <span className="max-w-[200px] truncate">{msg.attachmentName}</span>
          </div>
        )}
        {msg.cameraPreviewUrl && (
          <img
            src={msg.cameraPreviewUrl}
            alt="What you showed YAJ"
            className="max-h-40 w-auto rounded-xl border border-primary-foreground/20 object-cover"
          />
        )}
        {text && <div>{text}</div>}
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 max-h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <YajAiGeneratorIcon className="w-5 h-5" active />
          </div>
          <div>
            <h1 className="text-sm font-display font-bold text-foreground">Ask YAJ</h1>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigate("/ask-yaj/settings")}
            className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
            aria-label="YAJ AI settings"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
          {messages.length > 0 && (
            <button onClick={clearChat} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <YajAiGeneratorIcon className="w-10 h-10" active />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-display font-bold text-foreground">Hey! I'm YAJ</h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                Your guide to YAJ and everyday AI help — ask about the app, attach a photo or file, use voice, create ideas, and get pointed to the right place.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full max-w-sm mt-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void sendAndMaybeSpeak(s)}
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
      <div className="shrink-0 px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-2 border-t border-border bg-background space-y-2">
        {audioFile && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/30 text-xs text-foreground">
            <Music2 className="w-3.5 h-3.5 text-primary" />
            <span className="flex-1 truncate">{audioFile.name}</span>
            <button onClick={() => setAudioFile(null)} className="text-muted-foreground hover:text-destructive">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {attachedImage && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-foreground">
            <img src={attachedImage.dataUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
            <span className="flex-1 truncate">{attachedImage.name}</span>
            <button onClick={() => setAttachedImage(null)} className="text-muted-foreground hover:text-destructive">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {attachedFile && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-foreground">
            <FileText className="h-4 w-4 text-primary" />
            <span className="flex-1 truncate">{attachedFile.name}</span>
            <button onClick={() => setAttachedFile(null)} className="text-muted-foreground hover:text-destructive">
              <X className="h-3.5 w-3.5" />
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
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
            <div className="grid grid-cols-3 border-b border-border">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center gap-1.5 px-2 py-3 text-[11px] font-semibold text-foreground active:bg-muted"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"><Camera className="h-4 w-4" /></span>
                Camera
              </button>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="flex flex-col items-center gap-1.5 border-x border-border px-2 py-3 text-[11px] font-semibold text-foreground active:bg-muted"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"><Images className="h-4 w-4" /></span>
                Photos
              </button>
              <button
                type="button"
                onClick={() => documentInputRef.current?.click()}
                className="flex flex-col items-center gap-1.5 px-2 py-3 text-[11px] font-semibold text-foreground active:bg-muted"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"><FileText className="h-4 w-4" /></span>
                Files
              </button>
            </div>
            <button
              onClick={() => { setMenuOpen(false); setImageMode(true); inputRef.current?.focus(); }}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <ImagePlus className="h-4 w-4 text-muted-foreground" />
              Create an image
            </button>
            <button
              onClick={() => { setMenuOpen(false); handlePickAudio(); }}
              className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Paperclip className="h-4 w-4 text-muted-foreground" />
              Attach an audio clip
            </button>
            <button
              onClick={() => { setMenuOpen(false); navigate("/ask-yaj/settings"); }}
              className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              YAJ AI settings
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
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void handleImageChosen(e)}
          />
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleImageChosen(e)}
          />
          <input
            ref={documentInputRef}
            type="file"
            accept=".pdf,.txt,.md,.csv,.json,.xml,.html,.htm,.doc,.docx,application/pdf,text/*,application/json"
            className="hidden"
            onChange={(e) => void handleDocumentChosen(e)}
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
                  : audioFile || attachedImage || attachedFile
                    ? "Ask YAJ about this attachment..."
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
          {input.trim() || audioFile || attachedImage || attachedFile ? (
            <button
              onClick={() => void sendAndMaybeSpeak(input)}
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
                    bumpYajAiActivity("voice");
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
          onSend={({ text, imageDataUrl }) => sendMessage(text, { imageDataUrl })}
          initialStream={voiceStream}
          initialPrompt={voiceSeedPrompt}
          onClose={() => {
            setVoiceMode(false);
            setVoiceSeedPrompt(null);
            wellnessVoiceLaunchRef.current = false;
            voiceStream?.getTracks().forEach((t) => t.stop());
            setVoiceStream(null);
          }}
        />
      )}
    </div>
  );
};

export default AskYajPage;
