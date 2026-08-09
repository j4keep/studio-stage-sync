import { useState } from "react";
import { Link2, Mail, MessageSquare, Rss, Share2, Store, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { listingCoverUrl, type MarketplaceListing } from "@/lib/marketplace-api";
import { formatPrice } from "@/lib/marketplace";
import { toast } from "sonner";

const isVideoUrl = (u: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u);

function itemPath(listing: MarketplaceListing) {
  return listing.listing_type === "five_under"
    ? `/marketplace/product/${listing.id}`
    : `/marketplace/listing/${listing.id}`;
}

function absolute(path: string) {
  return `${window.location.origin}${path}`;
}

/** Share sheet for sellers: post an item (or their storefront) to their profile feed. */
export default function ShareListingSheet({
  listing,
  storeName,
  onClose,
}: {
  listing: MarketplaceListing;
  storeName?: string | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [posting, setPosting] = useState<"item" | "store" | null>(null);

  const itemUrl = absolute(itemPath(listing));
  const storeUrl = absolute(`/marketplace/store/${listing.seller_id}`);
  const message = [
    `${listing.title} — ${formatPrice(listing.price, listing.listing_type)}`,
    storeName ? `At ${storeName}` : null,
    itemUrl,
  ]
    .filter(Boolean)
    .join("\n");

  const shareToFeed = async (target: "item" | "store") => {
    if (!user) {
      toast.error("Sign in to share");
      return;
    }
    setPosting(target);
    try {
      const cover = listingCoverUrl(listing);
      const caption =
        target === "item"
          ? message
          : [`${storeName || "My store"} — shop my items`, storeUrl].join("\n");
      const { error } = await (supabase as any).from("posts").insert({
        user_id: user.id,
        caption,
        media_url: cover && !isVideoUrl(cover) ? cover : null,
        media_type: "image",
      });
      if (error) throw error;
      toast.success("Shared to your profile feed");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Could not share");
    } finally {
      setPosting(null);
    }
  };

  const nativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: listing.title, text: message, url: itemUrl });
      } else {
        await navigator.clipboard.writeText(message);
        toast.success("Item copied");
      }
    } catch {
      /* cancelled */
    }
  };

  const rows = [
    {
      icon: Rss,
      label: posting === "item" ? "Sharing…" : "Share to my profile",
      hint: "Posts this item on your feed with a link back to your store",
      onClick: () => void shareToFeed("item"),
    },
    {
      icon: Store,
      label: posting === "store" ? "Sharing…" : "Share my storefront",
      hint: "Posts your store so people can browse everything",
      onClick: () => void shareToFeed("store"),
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
        window.location.href = `mailto:?subject=${encodeURIComponent(listing.title)}&body=${encodeURIComponent(message)}`;
      },
    },
    { icon: Share2, label: "More apps", hint: "Anything installed", onClick: () => void nativeShare() },
    {
      icon: Link2,
      label: "Copy link",
      hint: itemUrl,
      onClick: async () => {
        await navigator.clipboard.writeText(itemUrl);
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
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Share item</p>
            <h2 className="truncate text-base font-black">{listing.title}</h2>
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
              key={r.hint}
              type="button"
              disabled={posting != null}
              onClick={r.onClick}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-left active:scale-[0.99] disabled:opacity-50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <r.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{r.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{r.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
