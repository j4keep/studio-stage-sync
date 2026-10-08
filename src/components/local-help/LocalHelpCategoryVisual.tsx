import type { LucideIcon } from "lucide-react";
import {
  Camera,
  Car,
  ChefHat,
  CircuitBoard,
  Dog,
  Drill,
  Hammer,
  Headphones,
  House,
  Leaf,
  Lightbulb,
  Paintbrush,
  PlugZap,
  ShowerHead,
  Sparkles,
  Truck,
  Wrench,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  handyman: Hammer,
  electrician: PlugZap,
  plumbing: ShowerHead,
  painting: Paintbrush,
  cleaning: Sparkles,
  lawn: Leaf,
  moving: Truck,
  photography: Camera,
  dj: Headphones,
  tech: CircuitBoard,
  pets: Dog,
  catering: ChefHat,
  auto: Car,
  contractor: Drill,
};

const PALETTES: Record<string, string> = {
  handyman: "from-[#24364b] via-[#315b72] to-[#d18b3a]",
  electrician: "from-[#172235] via-[#3a506b] to-[#f4b942]",
  plumbing: "from-[#16354a] via-[#167e9f] to-[#64c7e8]",
  painting: "from-[#35224f] via-[#7f4ca5] to-[#d37cc8]",
  cleaning: "from-[#163f43] via-[#2b8c7e] to-[#79c9b4]",
  lawn: "from-[#1c3a2a] via-[#3b7d44] to-[#8db65b]",
  moving: "from-[#26323d] via-[#536273] to-[#b26d3e]",
  photography: "from-[#2b2535] via-[#66506f] to-[#c17e8f]",
  dj: "from-[#17182e] via-[#443b7a] to-[#8d5bd0]",
  tech: "from-[#172d3d] via-[#28637b] to-[#52a9bd]",
  pets: "from-[#463227] via-[#986b4d] to-[#d6a66f]",
  catering: "from-[#4a2626] via-[#9a4b45] to-[#d18b5b]",
  auto: "from-[#1f252c] via-[#4d5965] to-[#9a5d42]",
  contractor: "from-[#302b26] via-[#6f5d47] to-[#b48a54]",
};

export function LocalHelpCategoryVisual({
  categoryId,
  label,
  compact = false,
}: {
  categoryId: string;
  label?: string;
  compact?: boolean;
}) {
  const Icon = ICONS[categoryId] || Wrench;
  const palette = PALETTES[categoryId] || "from-slate-800 via-slate-600 to-primary";

  return (
    <div className={`relative h-full w-full overflow-hidden bg-gradient-to-br ${palette}`}>
      <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,.22),transparent_28%),linear-gradient(135deg,transparent_45%,rgba(255,255,255,.07)_46%,transparent_52%)]" />
      <div className="absolute -right-7 -top-8 h-28 w-28 rounded-full border border-white/10 bg-white/5" />
      <div className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full border border-white/10 bg-black/10" />
      <div className={`absolute ${compact ? "left-4 top-1/2 -translate-y-1/2" : "left-5 bottom-5"} flex items-center gap-3`}>
        <div className={`flex ${compact ? "h-11 w-11" : "h-14 w-14"} items-center justify-center rounded-2xl border border-white/20 bg-black/20 shadow-xl backdrop-blur-sm`}>
          <Icon className={compact ? "h-5 w-5 text-white" : "h-7 w-7 text-white"} strokeWidth={1.8} />
        </div>
        {!compact && label && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/65">Local service</p>
            <p className="mt-0.5 text-base font-black text-white drop-shadow">{label}</p>
          </div>
        )}
      </div>
      <House className="absolute right-5 bottom-4 h-7 w-7 text-white/12" />
      <Lightbulb className="absolute right-12 top-5 h-5 w-5 text-white/10" />
    </div>
  );
}
