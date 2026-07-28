import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";

/** Marketplace messages hub — reuses YAJ chat with marketplace context. */
export default function MarketplaceMessagesPage() {
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button type="button" onClick={() => nav("/marketplace")} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-black">Marketplace messages</h1>
      </header>
      <div className="flex flex-col items-center px-6 pt-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MessageCircle className="h-7 w-7" />
        </div>
        <p className="mt-4 text-base font-black">Chat about listings</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Marketplace conversations use YAJ messaging. Avatars open Marketplace profiles — not social profiles.
        </p>
        <button
          type="button"
          onClick={() => nav("/messages")}
          className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
        >
          Open messages
        </button>
      </div>    </div>
  );
}
