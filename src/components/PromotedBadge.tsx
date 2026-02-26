import { Rocket } from "lucide-react";

const PromotedBadge = ({ className = "" }: { className?: string }) => (
  <span className={`inline-flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wider bg-primary/15 text-primary px-1.5 py-0.5 rounded-full ${className}`}>
    <Rocket className="w-2.5 h-2.5" /> Promoted
  </span>
);

export default PromotedBadge;
