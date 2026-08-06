/** Trust mark for verified deal merchants. */
export default function VerifiedBusinessBadge({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[9px] font-bold text-white shadow-sm"
        title="Verified Business"
        aria-label="Verified Business"
      >
        ✓
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-500 text-[8px] font-bold text-white">
        ✓
      </span>
      Verified Business
    </span>
  );
}
