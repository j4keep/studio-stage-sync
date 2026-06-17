import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  extensionCost,
  formatCurrency,
  type EngineerBookingProfile,
  type PendingExtension,
} from "./bookingTypes";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pending: PendingExtension | null;
  rates: EngineerBookingProfile;
  onApprove: () => void;
  onDecline: () => void;
};

export function ExtensionApprovalDialog({
  open,
  onOpenChange,
  pending,
  rates,
  onApprove,
  onDecline,
}: Props) {
  const visible = open && !!pending;

  return (
    <Dialog open={visible} onOpenChange={onOpenChange}>
      {pending ? (
        <DialogContent className="border-zinc-700 bg-zinc-950 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-amber-100">Extension request</DialogTitle>
            <DialogDescription className="text-zinc-400">
              The artist is requesting additional booked time. Approval updates the session clock and
              billing at your overtime rate.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-amber-500/25 bg-gradient-to-br from-zinc-900/80 to-black/50 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/60">
              Requested add-on
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-3">
              <span className="text-2xl font-semibold tabular-nums text-white">+{pending.minutes} min</span>
              <span className="text-sm font-medium text-amber-200/90">
                {formatCurrency(extensionCost(pending.minutes, rates.overtimeHourlyRate))}
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
              Charged at {formatCurrency(rates.overtimeHourlyRate)} / hr overtime. Artist sees the timer
              extend immediately on approve.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={onDecline}
              className="rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={onApprove}
              className="rounded-lg border border-amber-500/50 bg-gradient-to-b from-amber-600 to-amber-800 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-950/50 hover:from-amber-500 hover:to-amber-700"
            >
              Approve & bill
            </button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
