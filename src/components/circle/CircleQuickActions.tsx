import { Heart, Sparkles, UserPlus, Users } from "lucide-react";

type Props = {
  onCreateCircle: () => void;
  onCreateDating: () => void;
  onStartExclusive: () => void;
  onFindPeople: () => void;
};

const ACTIONS = (p: Props) => [
  { key: "circle", label: "Create a Circle", icon: Users, onClick: p.onCreateCircle },
  { key: "dating", label: "Create Dating Profile", icon: Heart, onClick: p.onCreateDating },
  { key: "exclusive", label: "Start Exclusive Content", icon: Sparkles, onClick: p.onStartExclusive },
  { key: "find", label: "Find People", icon: UserPlus, onClick: p.onFindPeople },
];

export default function CircleQuickActions(props: Props) {
  return (
    <div className="grid grid-cols-2 gap-2.5 px-4">
      {ACTIONS(props).map((a) => (
        <button
          key={a.key}
          type="button"
          onClick={a.onClick}
          className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-3 text-left shadow-sm transition active:scale-[0.98]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <a.icon className="h-4.5 w-4.5" />
          </span>
          <span className="text-[12.5px] font-bold leading-tight">{a.label}</span>
        </button>
      ))}
    </div>
  );
}
