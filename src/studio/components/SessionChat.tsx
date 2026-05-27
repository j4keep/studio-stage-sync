import { useRef, useState, useEffect } from "react";
import { useStudio } from "../state/StudioContext";
import { Send } from "lucide-react";

export default function SessionChat({ author }: { author: string }) {
  const { messages, sendMessage } = useStudio();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(author, text);
    setText("");
  };

  return (
    <div className="studio-card p-4 flex flex-col h-full min-h-0">
      <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--studio-text-muted))] mb-2">Session Chat</div>
      <div className="flex-1 min-h-[160px] overflow-y-auto space-y-2 pr-1 scrollbar-hide">
        {messages.length === 0 && (
          <div className="text-xs text-[hsl(var(--studio-text-muted))] text-center py-6">No messages yet.</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className="text-[hsl(var(--studio-blue))] font-medium">{m.author}:</span>{" "}
            <span className="text-[hsl(var(--studio-text))]">{m.body}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 studio-card-inset px-3 py-2 text-sm focus:outline-none focus:border-[hsl(var(--studio-blue))]"
        />
        <button type="submit" className="studio-btn-primary studio-btn" disabled={!text.trim()}>
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
