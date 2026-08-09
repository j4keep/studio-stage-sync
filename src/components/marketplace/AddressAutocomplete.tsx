import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { suggestAddresses, type AddressSuggestion } from "@/lib/marketplace-delivery";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onPick: (s: AddressSuggestion) => void;
  placeholder?: string;
  className?: string;
};

/** Address box with a Google-style dropdown — start typing, tap the match. */
export default function AddressAutocomplete({ value, onChange, onPick, placeholder, className }: Props) {
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const skip = useRef(false);

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setItems([]);
      setOpen(false);
      return;
    }
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await suggestAddresses(q);
      if (!alive) return;
      setItems(res);
      setOpen(res.length > 0);
      setLoading(false);
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
      setLoading(false);
    };
  }, [value]);

  return (
    <div className="relative min-w-0 flex-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={className || "h-11 w-full min-w-0 rounded-xl border border-border bg-muted px-3 text-sm"}
      />
      {loading && (
        <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {open && items.length > 0 && (
        <ul className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover shadow-lg">
          {items.map((s) => (
            <li key={`${s.lat}-${s.lng}-${s.label}`}>
              <button
                type="button"
                onClick={() => {
                  skip.current = true;
                  onChange(s.label);
                  setOpen(false);
                  setItems([]);
                  onPick(s);
                }}
                className="block w-full px-3 py-2.5 text-left text-[12.5px] leading-snug hover:bg-muted"
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
