import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/** Purchases hub — transactions expand in Phase 2. */
export default function MarketplacePurchasesPage() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button type="button" onClick={() => nav("/marketplace/account")} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-black">Purchases</h1>
      </header>
      <p className="px-6 py-16 text-center text-sm text-muted-foreground">
        Completed purchases will appear here after an offer is accepted and marked complete.
      </p>
      <button type="button" onClick={() => nav("/marketplace/offers")} className="mx-auto block text-sm font-bold text-primary">
        View offers
      </button>    </div>
  );
}
