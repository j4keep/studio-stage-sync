/** Country + identity flag backgrounds. Colors are CSS-ready. */

export type FlagPattern = "horizontal" | "vertical" | "solid";

export interface FlagTheme {
  id: string;
  label: string;
  emoji: string;
  colors: string[];
  pattern: FlagPattern;
}

export const FLAG_THEMES: FlagTheme[] = [
  // Identity
  { id: "pride", label: "Pride", emoji: "🏳️‍🌈", pattern: "horizontal", colors: ["#e40303", "#ff8c00", "#ffed00", "#008026", "#004dff", "#750787"] },
  { id: "trans", label: "Trans", emoji: "🏳️‍⚧️", pattern: "horizontal", colors: ["#5bcefa", "#f5a9b8", "#ffffff", "#f5a9b8", "#5bcefa"] },
  { id: "nb", label: "Non-Binary", emoji: "🏳️", pattern: "horizontal", colors: ["#fcf434", "#ffffff", "#9c59d1", "#2c2c2c"] },
  { id: "bi", label: "Bisexual", emoji: "🏳️", pattern: "horizontal", colors: ["#d60270", "#d60270", "#9b4f96", "#0038a8", "#0038a8"] },
  { id: "lesbian", label: "Lesbian", emoji: "🏳️", pattern: "horizontal", colors: ["#d62900", "#ff9b55", "#ffffff", "#d461a6", "#a50062"] },

  // Countries (A-Z)
  { id: "ar", label: "Argentina", emoji: "🇦🇷", pattern: "horizontal", colors: ["#74acdf", "#ffffff", "#74acdf"] },
  { id: "au", label: "Australia", emoji: "🇦🇺", pattern: "solid", colors: ["#012169", "#e4002b", "#ffffff"] },
  { id: "at", label: "Austria", emoji: "🇦🇹", pattern: "horizontal", colors: ["#ed2939", "#ffffff", "#ed2939"] },
  { id: "be", label: "Belgium", emoji: "🇧🇪", pattern: "vertical", colors: ["#000000", "#fdda24", "#ef3340"] },
  { id: "br", label: "Brazil", emoji: "🇧🇷", pattern: "solid", colors: ["#009c3b", "#ffdf00", "#002776"] },
  { id: "ca", label: "Canada", emoji: "🇨🇦", pattern: "vertical", colors: ["#ff0000", "#ffffff", "#ff0000"] },
  { id: "cn", label: "China", emoji: "🇨🇳", pattern: "solid", colors: ["#de2910", "#ffde00"] },
  { id: "co", label: "Colombia", emoji: "🇨🇴", pattern: "horizontal", colors: ["#fcd116", "#fcd116", "#003893", "#ce1126"] },
  { id: "hr", label: "Croatia", emoji: "🇭🇷", pattern: "horizontal", colors: ["#ff0000", "#ffffff", "#0093dd"] },
  { id: "cu", label: "Cuba", emoji: "🇨🇺", pattern: "horizontal", colors: ["#002a8f", "#ffffff", "#002a8f", "#ffffff", "#002a8f"] },
  { id: "dk", label: "Denmark", emoji: "🇩🇰", pattern: "solid", colors: ["#c60c30", "#ffffff"] },
  { id: "do", label: "Dominican Rep.", emoji: "🇩🇴", pattern: "solid", colors: ["#002d62", "#ce1126", "#ffffff"] },
  { id: "eg", label: "Egypt", emoji: "🇪🇬", pattern: "horizontal", colors: ["#ce1126", "#ffffff", "#000000"] },
  { id: "et", label: "Ethiopia", emoji: "🇪🇹", pattern: "horizontal", colors: ["#078930", "#fcdd09", "#da121a"] },
  { id: "fr", label: "France", emoji: "🇫🇷", pattern: "vertical", colors: ["#0055a4", "#ffffff", "#ef4135"] },
  { id: "de", label: "Germany", emoji: "🇩🇪", pattern: "horizontal", colors: ["#000000", "#dd0000", "#ffce00"] },
  { id: "gh", label: "Ghana", emoji: "🇬🇭", pattern: "horizontal", colors: ["#ce1126", "#fcd116", "#006b3f"] },
  { id: "gr", label: "Greece", emoji: "🇬🇷", pattern: "horizontal", colors: ["#0d5eaf", "#ffffff", "#0d5eaf", "#ffffff", "#0d5eaf"] },
  { id: "ht", label: "Haiti", emoji: "🇭🇹", pattern: "horizontal", colors: ["#00209f", "#d21034"] },
  { id: "in", label: "India", emoji: "🇮🇳", pattern: "horizontal", colors: ["#ff9933", "#ffffff", "#138808"] },
  { id: "id", label: "Indonesia", emoji: "🇮🇩", pattern: "horizontal", colors: ["#ff0000", "#ffffff"] },
  { id: "ir", label: "Iran", emoji: "🇮🇷", pattern: "horizontal", colors: ["#239f40", "#ffffff", "#da0000"] },
  { id: "ie", label: "Ireland", emoji: "🇮🇪", pattern: "vertical", colors: ["#169b62", "#ffffff", "#ff883e"] },
  { id: "il", label: "Israel", emoji: "🇮🇱", pattern: "horizontal", colors: ["#0038b8", "#ffffff", "#0038b8"] },
  { id: "it", label: "Italy", emoji: "🇮🇹", pattern: "vertical", colors: ["#008c45", "#ffffff", "#cd212a"] },
  { id: "jm", label: "Jamaica", emoji: "🇯🇲", pattern: "solid", colors: ["#009b3a", "#fed100", "#000000"] },
  { id: "jp", label: "Japan", emoji: "🇯🇵", pattern: "solid", colors: ["#ffffff", "#bc002d"] },
  { id: "ke", label: "Kenya", emoji: "🇰🇪", pattern: "horizontal", colors: ["#000000", "#ffffff", "#bb0000", "#ffffff", "#006600"] },
  { id: "kr", label: "S. Korea", emoji: "🇰🇷", pattern: "solid", colors: ["#ffffff", "#cd2e3a", "#0047a0"] },
  { id: "mx", label: "Mexico", emoji: "🇲🇽", pattern: "vertical", colors: ["#006847", "#ffffff", "#ce1126"] },
  { id: "ma", label: "Morocco", emoji: "🇲🇦", pattern: "solid", colors: ["#c1272d", "#006233"] },
  { id: "nl", label: "Netherlands", emoji: "🇳🇱", pattern: "horizontal", colors: ["#ae1c28", "#ffffff", "#21468b"] },
  { id: "ng", label: "Nigeria", emoji: "🇳🇬", pattern: "vertical", colors: ["#008751", "#ffffff", "#008751"] },
  { id: "no", label: "Norway", emoji: "🇳🇴", pattern: "solid", colors: ["#ef2b2d", "#ffffff", "#002868"] },
  { id: "pk", label: "Pakistan", emoji: "🇵🇰", pattern: "vertical", colors: ["#ffffff", "#01411c"] },
  { id: "pe", label: "Peru", emoji: "🇵🇪", pattern: "vertical", colors: ["#d91023", "#ffffff", "#d91023"] },
  { id: "ph", label: "Philippines", emoji: "🇵🇭", pattern: "horizontal", colors: ["#0038a8", "#ce1126"] },
  { id: "pl", label: "Poland", emoji: "🇵🇱", pattern: "horizontal", colors: ["#ffffff", "#dc143c"] },
  { id: "pt", label: "Portugal", emoji: "🇵🇹", pattern: "vertical", colors: ["#046a38", "#046a38", "#da291c", "#da291c", "#da291c"] },
  { id: "pr", label: "Puerto Rico", emoji: "🇵🇷", pattern: "horizontal", colors: ["#ce1126", "#ffffff", "#ce1126", "#ffffff", "#ce1126"] },
  { id: "ro", label: "Romania", emoji: "🇷🇴", pattern: "vertical", colors: ["#002b7f", "#fcd116", "#ce1126"] },
  { id: "ru", label: "Russia", emoji: "🇷🇺", pattern: "horizontal", colors: ["#ffffff", "#0039a6", "#d52b1e"] },
  { id: "sa", label: "Saudi Arabia", emoji: "🇸🇦", pattern: "solid", colors: ["#006c35", "#ffffff"] },
  { id: "sn", label: "Senegal", emoji: "🇸🇳", pattern: "vertical", colors: ["#00853f", "#fdef42", "#e31b23"] },
  { id: "za", label: "South Africa", emoji: "🇿🇦", pattern: "solid", colors: ["#007a4d", "#ffb612", "#000000", "#de3831", "#002395", "#ffffff"] },
  { id: "es", label: "Spain", emoji: "🇪🇸", pattern: "horizontal", colors: ["#aa151b", "#f1bf00", "#f1bf00", "#aa151b"] },
  { id: "se", label: "Sweden", emoji: "🇸🇪", pattern: "solid", colors: ["#006aa7", "#fecc00"] },
  { id: "ch", label: "Switzerland", emoji: "🇨🇭", pattern: "solid", colors: ["#ff0000", "#ffffff"] },
  { id: "tr", label: "Turkey", emoji: "🇹🇷", pattern: "solid", colors: ["#e30a17", "#ffffff"] },
  { id: "ua", label: "Ukraine", emoji: "🇺🇦", pattern: "horizontal", colors: ["#005bbb", "#ffd500"] },
  { id: "gb", label: "United Kingdom", emoji: "🇬🇧", pattern: "solid", colors: ["#012169", "#ffffff", "#c8102e"] },
  { id: "us", label: "United States", emoji: "🇺🇸", pattern: "horizontal", colors: ["#b22234", "#ffffff", "#b22234", "#ffffff", "#b22234", "#ffffff", "#b22234"] },
  { id: "uy", label: "Uruguay", emoji: "🇺🇾", pattern: "horizontal", colors: ["#ffffff", "#0038a8", "#ffffff", "#0038a8", "#ffffff", "#0038a8", "#ffffff", "#0038a8", "#ffffff"] },
  { id: "ve", label: "Venezuela", emoji: "🇻🇪", pattern: "horizontal", colors: ["#fcd116", "#00247d", "#cf142b"] },
  { id: "vn", label: "Vietnam", emoji: "🇻🇳", pattern: "solid", colors: ["#da251d", "#ffff00"] },
];

export function getFlagById(id: string | null | undefined): FlagTheme | null {
  if (!id) return null;
  return FLAG_THEMES.find((f) => f.id === id) ?? null;
}

const IDENTITY_FLAG_IDS = new Set(["pride", "trans", "nb", "bi", "lesbian"]);

/** Real flag image for country codes; identity flags use waved stripe art. */
export function getFlagImageUrl(flag: FlagTheme): string | null {
  if (IDENTITY_FLAG_IDS.has(flag.id)) return null;
  if (/^[a-z]{2}$/.test(flag.id)) {
    return `https://flagcdn.com/w640/${flag.id}.png`;
  }
  return null;
}

/** CSS `background` value that renders a stripe pattern from a flag. */
export function flagBackgroundCss(flag: FlagTheme): string {
  if (flag.pattern === "solid") {
    // Diagonal split of first two colors for a decorative but still-readable field.
    const c = flag.colors;
    if (c.length === 1) return c[0];
    if (c.length === 2) return `linear-gradient(135deg, ${c[0]} 0%, ${c[0]} 50%, ${c[1]} 50%, ${c[1]} 100%)`;
    // 3+ colors: diagonal thirds
    const stops: string[] = [];
    const step = 100 / c.length;
    c.forEach((color, i) => {
      stops.push(`${color} ${i * step}%`, `${color} ${(i + 1) * step}%`);
    });
    return `linear-gradient(135deg, ${stops.join(", ")})`;
  }

  const direction = flag.pattern === "horizontal" ? "to bottom" : "to right";
  const stops: string[] = [];
  const step = 100 / flag.colors.length;
  flag.colors.forEach((color, i) => {
    stops.push(`${color} ${i * step}%`, `${color} ${(i + 1) * step}%`);
  });
  return `linear-gradient(${direction}, ${stops.join(", ")})`;
}
