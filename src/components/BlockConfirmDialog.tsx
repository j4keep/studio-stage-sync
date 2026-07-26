import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  name: string;
  loading?: boolean;
};

/** Facebook-style confirm before blocking someone across all YAJ pages. */
export default function BlockConfirmDialog({ open, onClose, onConfirm, name, loading }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Block {name}?</DialogTitle>
          <DialogDescription className="space-y-2 text-left text-sm text-muted-foreground">
            <span className="block">
              {name} will be blocked on all your YAJ pages. They won&apos;t be able to see your profile,
              posts, or message you, and you won&apos;t see theirs.
            </span>
            <span className="block">
              If you follow each other, you&apos;ll both be unfollowed. Unblocking later won&apos;t restore
              the follow — you&apos;d need to follow again.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold text-foreground sm:flex-none sm:px-4"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50 sm:flex-none sm:px-4"
          >
            {loading ? "Blocking…" : "Block"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
