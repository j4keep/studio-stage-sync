import { Home, Music, Sliders, Download } from "lucide-react";

export type WStudioScreen = "home" | "studio" | "mixer" | "export";

interface WStudioNavProps {
  active: WStudioScreen;
  onNavigate: (screen: WStudioScreen) => void;
}

const tabs: { id: WStudioScreen; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "studio", label: "Studio", icon: Music },
  { id: "mixer", label: "Mixer", icon: Sliders },
  { id: "export", label: "Export", icon: Download },
];

export default function WStudioNav({ active, onNavigate }: WStudioNavProps) {
  return (
    <nav className="flex items-center justify-around py-2 border-t border-[#333] shrink-0"
      style={{ background: "#1a1a2e" }}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            className="flex flex-col items-center gap-0.5 px-4 py-1"
          >
            <Icon className={`w-5 h-5 ${isActive ? "text-[#63b3ed]" : "text-[#666]"}`} />
            <span className={`text-[10px] font-semibold ${isActive ? "text-[#63b3ed]" : "text-[#666]"}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
