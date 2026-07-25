import { FEED_EMOJI_SET, EMOJI_MAP } from "@/lib/emoji-characters";

const EMOJI_LABEL_MAP: Record<string, string> = {};
FEED_EMOJI_SET.forEach((e) => {
  EMOJI_LABEL_MAP[e.label] = e.src;
});

export function renderDesktopCommentContent(content: string) {
  if (EMOJI_LABEL_MAP[content]) {
    return (
      <img
        src={EMOJI_LABEL_MAP[content]}
        alt={content}
        className="inline-block h-8 w-8 object-contain align-middle"
      />
    );
  }
  const exactMatch = content.match(/^:([a-z0-9-]+):$/);
  if (exactMatch && EMOJI_MAP[exactMatch[1]]) {
    return (
      <img
        src={EMOJI_MAP[exactMatch[1]]}
        alt={exactMatch[1]}
        className="inline-block h-8 w-8 object-contain align-middle"
      />
    );
  }
  return content;
}

type EmojiBarProps = {
  disabled?: boolean;
  onPick: (emojiId: string) => void;
};

/** Shared desktop comment emoji strip (posts + reels). */
export function DesktopCommentEmojiBar({ disabled, onPick }: EmojiBarProps) {
  return (
    <div className="border-t border-border px-3 pt-2">
      <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        React with emoji
      </p>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {FEED_EMOJI_SET.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(item.id)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary transition-transform hover:scale-110 active:scale-95 disabled:opacity-40"
            aria-label={item.label}
          >
            <img src={item.src} alt={item.label} className="h-7 w-7 object-contain" />
          </button>
        ))}
      </div>
    </div>
  );
}
