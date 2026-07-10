import { useTheme } from "@/contexts/ThemeContext";
import { getFlagById, flagBackgroundCss } from "@/lib/flag-themes";

interface Props {
  className?: string;
}

/** Renders the user's chosen flag as a full-bleed background. Falls back to black. */
export default function FlagBackground({ className = "" }: Props) {
  const { countryFlag } = useTheme();
  const flag = getFlagById(countryFlag);

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{
        background: flag ? flagBackgroundCss(flag) : "#000",
      }}
      aria-hidden
    />
  );
}
