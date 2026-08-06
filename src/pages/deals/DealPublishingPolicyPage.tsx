import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function DealPublishingPolicyPage() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-black">Deals publishing policy</h1>
      </header>
      <div className="space-y-4 px-4 py-4 text-sm leading-relaxed">
        <p>
          Deals are limited-time promotions from verified businesses, approved sellers, organizations, and
          authorized partners. They are separate from Marketplace peer-to-peer listings.
        </p>
        <div>
          <h2 className="font-bold">Prohibited offers</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Illegal goods or services</li>
            <li>Weapons and ammunition</li>
            <li>Controlled substances</li>
            <li>Prescription medication</li>
            <li>Tobacco or nicotine products</li>
            <li>Adult sexual services</li>
            <li>Counterfeit goods</li>
            <li>Gambling</li>
            <li>Fraudulent financial offers</li>
            <li>Misleading health claims</li>
            <li>Unsafe or recalled products</li>
            <li>Discriminatory promotions</li>
            <li>Age-restricted products without appropriate safeguards</li>
          </ul>
        </div>
        <p className="text-muted-foreground">
          Offers matching these categories are blocked or routed for manual review. Sponsored placement must be
          clearly labeled. Never fabricate ratings, claim counts, savings, or urgency.
        </p>
      </div>
    </div>
  );
}
