import { useTheme } from "@/contexts/ThemeContext";
import { getFlagById } from "@/lib/flag-themes";
import Flag3D from "@/components/Flag3D";

interface Props {
  className?: string;
}

/** Renders the user's chosen flag as a full-bleed background. Falls back to transparent. */
export default function FlagBackground({ className = "" }: Props) {
  const { countryFlag } = useTheme();
  const flag = getFlagById(countryFlag);

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}>
      {flag ? <Flag3D flag={flag} variant="background" className="w-full h-full" /> : null}
    </div>
  );
}
