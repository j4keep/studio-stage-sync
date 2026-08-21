import { DialogueContent } from "@/lib/neighborhood/engine";

type Props = {
  dialogue: DialogueContent | null;
  onAccept: (missionId: string) => void;
  onDeliver: (missionId: string) => void;
  onClose: () => void;
};

/** Short, mobile-friendly NPC conversations — never a dialogue tree, just a line and one or two
 *  buttons, per the brief. */
export default function DialogueOverlay({ dialogue, onAccept, onDeliver, onClose }: Props) {
  if (!dialogue) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="mb-6 w-[92%] max-w-sm rounded-2xl border border-white/15 bg-[#241a3d] p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-black text-white"
            style={{ backgroundColor: dialogue.npc.color }}
          >
            {dialogue.npc.name[0]}
          </span>
          <div>
            <p className="text-sm font-black text-white">{dialogue.npc.name}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/50">{dialogue.npc.title}</p>
          </div>
        </div>

        <p className="mt-3 text-sm font-medium leading-snug text-white/90">{dialogue.line}</p>

        <div className="mt-4 flex gap-2">
          {dialogue.kind === "offer" && (
            <>
              <button
                type="button"
                onClick={() => onAccept(dialogue.mission.id)}
                className="flex-1 rounded-full bg-[#FF7A59] py-2.5 text-sm font-black text-white"
              >
                Sure
              </button>
              <button type="button" onClick={onClose} className="flex-1 rounded-full border border-white/20 py-2.5 text-sm font-black text-white/80">
                Maybe later
              </button>
            </>
          )}

          {dialogue.kind === "delivered" && (
            <button
              type="button"
              onClick={() => onDeliver(dialogue.mission.id)}
              className="flex-1 rounded-full bg-[#2FB6C4] py-2.5 text-sm font-black text-white"
            >
              Nice!
            </button>
          )}

          {(dialogue.kind === "reminder" || dialogue.kind === "greeting") && (
            <button type="button" onClick={onClose} className="flex-1 rounded-full bg-white/10 py-2.5 text-sm font-black text-white">
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
