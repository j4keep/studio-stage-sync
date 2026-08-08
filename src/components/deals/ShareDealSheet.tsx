import { useState } from "react";
import { Link2, Mail, MessageSquare, Rss, Share2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { dealCoverUrl, type Deal } from "@/lib/deals-api";
import { toast } from "sonner";

function dealUrl(id: string) {
  return `${window.location.origin}/deals/${id}`;
}

function buildMessage(deal: Deal) {
  return [
    `${deal.discount_badge ? `${deal.discount_badge} — ` : ""}${deal.title}`,
    deal.deal_businesses?.name ? `at ${deal.deal_businesses.name}` : null,
    deal.expires_at ? `Ends ${new Date(deal.expires_at).toLocaleDateString()}` : null,
    dealUrl(deal.id),
  ]
    .filter(Boolean)
    .join("\n");
}

/** Share sheet for deal owners: post the deal to the home feed, or send it out. */
export default function ShareDealSheet({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  const { user } = useAuth();
  const [posting, setPosting] = useState(false);
  const message = buildMessage(deal);

  const shareToFeed = async () => {
    if (!user) {
      toast.error("Sign in to share");
      return;
    }
    setPosting(true);
    try {
      const cover = dealCoverUrl(deal);
      const { error } = await (supabase as any).from("posts").insert({
        user_id: user.id,
        caption: message,
        media_url: cover,
        media_type: "image",
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
        await navigator.share({ title: deal.title, text: message, url: dealUrl(deal.id) });
      } else {
        await navigator.clipboard.writeText(message);
        toast.success("Deal copied");
      }
    } catch {
      /* cancelled */
    }
  };

  const rows = [
    {
      icon: Rss,
      label: "Share to my feed",
      hint: "Posts this deal on the home feed",
      onClick: () => void shareToFeed(),
    },
    {
      icon: MessageSquare,
      label: "Text message",
      hint: "Send by SMS",
      onClick: () => {
        window.location.href = `sms:?&body=${encodeURIComponent(message)}`;
      },
    },
    {
      icon: Mail,
      label: "Email",
      hint: "Send by email",
      onClick: () => {
        window.location.href = `mailto:?subject=${encodeURIComponent(deal.title)}&body=${encodeURIComponent(message)}`;
      },
    },
    { icon: Share2, label: "More apps", hint: "Anything installed", onClick: () => void nativeShare() },
    {
      icon: Link2,
      label: "Copy link",
      hint: dealUrl(deal.id),
      onClick: async () => {
        await navigator.clipboard.writeText(dealUrl(deal.id));
        toast.success("Link copied");
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border-t border-border bg-background p-4 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-orange-600">Share deal</p>
            <h2 className="truncate text-base font-black">{deal.title}</h2>
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
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/10 text-orange-600">
                <r.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">
                  {posting && r.label === "Share to my feed" ? "Sharing…" : r.label}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">{r.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
