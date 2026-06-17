import { useRef, useEffect, useState } from "react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile } from "lucide-react";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
}

export default function EmojiPicker({ onEmojiSelect }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  const handleEmojiSelect = (emoji: any) => {
    onEmojiSelect(emoji.native);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="p-1 hover:opacity-70 transition-opacity"
          title="Add Emoji"
          type="button"
        >
          <Smile className="w-5 h-5 text-white" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 border-none bg-transparent shadow-none"
        side="top"
        align="end"
        sideOffset={10}
      >
        <Picker
          data={data}
          onEmojiSelect={handleEmojiSelect}
          theme="dark"
          previewPosition="none"
          skinTonePosition="none"
          maxFrequentRows={2}
          perLine={8}
        />
      </PopoverContent>
    </Popover>
  );
}
