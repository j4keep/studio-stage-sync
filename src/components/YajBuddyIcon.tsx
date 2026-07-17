import yajBuddyWaveImg from "@/assets/emojis/yaj-buddy-wave.png";

type YajBuddyIconProps = {
  className?: string;
  active?: boolean;
};

const YajBuddyIcon = ({ className = "w-5 h-5", active = false }: YajBuddyIconProps) => {
  return (
    <img
      src={yajBuddyWaveImg}
      alt=""
      aria-hidden="true"
      className={`${className} object-contain ${active ? "drop-shadow-[0_0_8px_rgba(168,85,247,0.7)]" : ""}`}
    />
  );
};

export default YajBuddyIcon;
