import yajAiGeneratorIcon from "@/assets/yaj-ai-generator-icon.png";

type Props = {
  className?: string;
  active?: boolean;
};

/** Nav icon for YAJ AI Generator — robot head only. */
export default function YajAiGeneratorIcon({ className = "w-5 h-5", active = false }: Props) {
  return (
    <img
      src={yajAiGeneratorIcon}
      alt=""
      aria-hidden="true"
      className={`${className} object-contain ${
        active ? "drop-shadow-[0_0_8px_rgba(168,85,247,0.7)]" : ""
      }`}
    />
  );
}
