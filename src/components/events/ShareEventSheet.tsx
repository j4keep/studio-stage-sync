import { useState } from "react";
import { Copy, Link2, Mail, MessageSquare, Rss, Share2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type EventLike = {
  id: string;
  title: string;
  description: string | null;
  media_url: string | null;
  media_type: string;
  address: string | null;
  starts_at: string | null;
};

function eventUrl(id: string) {
  return `${window.location.origin}/events/${id}`;
}

function buildMessage(ev: EventLike) {
  const when = ev.starts_at
    ? new Date(ev.starts_at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  return [
    `You're invited: ${ev.title}`,
    when ? `When: ${when}` : null,
    ev.address ? `Where: ${ev.address}` : null,
    eventUrl(ev.id),
  ]
    .filter(Boolean)
    .join("\n");
}

/** Share sheet for event hosts: post to the home feed, or invite people by text, email or link. */
export default function ShareEventSheet({
  event,
  onClose,
}: {
  event: EventLike;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [posting, setPosting] = useState(false);
  const message = buildMessage(event);

  const shareToFeed = async () => {
    if (!user) {
      toast.error("Sign in to share");
      return;
    }
    setPosting(true);
    try {
      const { error } = await (supabase as any).from("posts").insert({
        user_id: user.id,
        caption: message,
        media_url: event.media_url,
        media_type: event.media_url ? event.media_type : "image",
      });
      if (error) throw error;
      toast.success("Shared to your feed");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Could not share to feed");
    } finally {
      setPosting(false);
    }
  };

  const nativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: event.title, text: message, url: eventUrl(event.id) });
      } else {
        await navigator.clipboard.writeText(message);
        toast.success("Invite copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(eventUrl(event.id));
    toast.success("Link copied");
  };

  const rows = [
    {
      icon: Rss,
      label: "Share to my feed",
      hint: "Posts this event on the home feed",
      onClick: () => void shareToFeed(),
    },
    {
      icon: MessageSquare,
      label: "Text message",
      hint: "Send by SMS to phone numbers",
      onClick: () => {
        window.location.href = `sms:?&body=${encodeURIComponent(message)}`;
      },
    },
    {
      icon: Mail,
      label: "Email invite",
      hint: "Send to email addresses",
      onClick: () => {
        window.location.href = `mailto:?subject=${encodeURIComponent(
          `You're invited: ${event.title}`,
        )}&body=${encodeURIComponent(message)}`;
      },
    },
    {
      icon: Share2,
      label: "More apps",
      hint: "WhatsApp, Messenger, anything installed",
      onClick: () => void nativeShare(),
    },
    { icon: Link2, label: "Copy link", hint: eventUrl(event.id), onClick: () => void copyLink() },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border-t border-border bg-background p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Share event</p>
            <h2 className="truncate text-base font-black">{event.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2">
          {rows.map((r) => (
            <button
              key={r.label}
              type="button"
              disabled={posting && r.label === "Share to my feed"}
              onClick={r.onClick}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-left active:scale-[0.99] disabled:opacity-50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <r.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">
                  {posting && r.label === "Share to my feed" ? "Sharing…" : r.label}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">{r.hint}</span>
              </span>
              <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
