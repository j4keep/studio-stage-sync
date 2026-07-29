import { Ban, Flag, User } from "lucide-react";

export type MoreOptionsPeerRole = "seller" | "buyer" | "user";

type Props = {
  open: boolean;
  onClose: () => void;
  /** seller | buyer | user — drives labels */
  peerRole: MoreOptionsPeerRole;
  peerName: string;
  onViewProfile: () => void;
  onReport: () => void;
  onBlock: () => void;
};

function labelsFor(role: MoreOptionsPeerRole) {
  if (role === "seller") {
    return {
      title: "Seller",
      view: "View seller's profile",
      report: "Report seller",
      block: "Block seller",
    };
  }
  if (role === "buyer") {
    return {
      title: "Buyer",
      view: "View buyer's profile",
      report: "Report buyer",
      block: "Block buyer",
    };
  }
  return {
    title: "User",
    view: "View profile",
    report: "Report",
    block: "Block",
  };
}

/** Bottom sheet: View / Report / Block (no auto-submit). */
export default function MarketplaceMoreOptionsSheet({
  open,
  onClose,
  peerRole,
  peerName,
  onViewProfile,
  onReport,
  onBlock,
}: Props) {
  if (!open) return null;

  const labels = labelsFor(peerRole);

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/45 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-t-3xl border border-border bg-background shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        <p className="px-4 pb-2 text-center text-xs text-muted-foreground">
          More options · {peerName || labels.title}
        </p>
        <div className="divide-y divide-border border-t border-border">
          <button
            type="button"
            onClick={() => {
              onClose();
              onViewProfile();
            }}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold text-primary hover:bg-muted/50"
          >
            <User className="h-4 w-4 shrink-0" />
            {labels.view}
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onReport();
            }}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold text-foreground hover:bg-muted/50"
          >
            <Flag className="h-4 w-4 shrink-0" />
            {labels.report}
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onBlock();
            }}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold text-destructive hover:bg-muted/50"
          >
            <Ban className="h-4 w-4 shrink-0" />
            {labels.block}
          </button>
        </div>
        <div className="border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-full rounded-full bg-muted text-sm font-bold"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
