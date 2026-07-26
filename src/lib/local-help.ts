/** Find Local Help — Explore discovery taxonomy (YAJ design, Nextdoor workflow). */

export type LocalHelpCategory = {
  id: string;
  label: string;
  emoji: string;
  gradient: string;
  searchHint: string;
};

export type ServiceOption = { id: string; label: string };

export const LOCAL_HELP_CATEGORIES: LocalHelpCategory[] = [
  { id: "handyman", label: "Handyman", emoji: "🏠", gradient: "from-amber-400 to-orange-500", searchHint: "handyman repairs" },
  { id: "electrician", label: "Electrician", emoji: "⚡", gradient: "from-yellow-300 to-amber-500", searchHint: "electrical wiring" },
  { id: "plumbing", label: "Plumbing", emoji: "🚿", gradient: "from-sky-400 to-blue-600", searchHint: "plumber" },
  { id: "painting", label: "Painting", emoji: "🎨", gradient: "from-violet-400 to-fuchsia-500", searchHint: "interior painting" },
  { id: "cleaning", label: "House Cleaning", emoji: "🧹", gradient: "from-teal-300 to-emerald-500", searchHint: "house cleaning" },
  { id: "lawn", label: "Lawn Care", emoji: "🌳", gradient: "from-green-400 to-lime-600", searchHint: "lawn care" },
  { id: "moving", label: "Moving", emoji: "🚛", gradient: "from-slate-400 to-slate-600", searchHint: "local movers" },
  { id: "photography", label: "Photography", emoji: "📷", gradient: "from-pink-400 to-rose-500", searchHint: "photographer" },
  { id: "dj", label: "DJ & Music", emoji: "🎵", gradient: "from-indigo-400 to-violet-600", searchHint: "DJ music" },
  { id: "tech", label: "Tech Support", emoji: "💻", gradient: "from-cyan-400 to-blue-500", searchHint: "tech support" },
  { id: "pets", label: "Pet Services", emoji: "🐶", gradient: "from-orange-300 to-amber-400", searchHint: "pet care" },
  { id: "catering", label: "Catering", emoji: "🍽", gradient: "from-rose-300 to-red-500", searchHint: "catering" },
  { id: "auto", label: "Auto Repair", emoji: "🚗", gradient: "from-zinc-400 to-neutral-600", searchHint: "mobile mechanic" },
  { id: "contractor", label: "General Contractor", emoji: "🏗", gradient: "from-stone-400 to-stone-600", searchHint: "general contractor" },
];

export const TRENDING_SERVICES = [
  "Handyman",
  "House cleaning",
  "Electrician",
  "Photographer",
  "DJ this weekend",
  "Lawn care",
  "Plumbing",
];

export const PROJECT_TYPES: ServiceOption[] = [
  { id: "repairs", label: "Repairs" },
  { id: "installation", label: "Installation" },
  { id: "maintenance", label: "Maintenance" },
  { id: "assembly", label: "Assembly" },
  { id: "painting", label: "Painting" },
  { id: "cleaning", label: "Cleaning" },
];

export const WORK_FOCUS: ServiceOption[] = [
  { id: "walls-inside", label: "Walls (inside)" },
  { id: "walls-outside", label: "Walls (outside)" },
  { id: "cabinets", label: "Cabinets" },
  { id: "shelving", label: "Shelving" },
  { id: "molding", label: "Molding or baseboards" },
  { id: "electrical", label: "Electrical" },
  { id: "lighting", label: "Lighting" },
  { id: "wall-hangings", label: "Wall hangings" },
  { id: "doors", label: "Doors" },
  { id: "tiling", label: "Tiling" },
  { id: "appliances", label: "Appliances" },
  { id: "plumbing", label: "Plumbing" },
  { id: "furniture", label: "Furniture" },
];

export const TIMELINE_OPTIONS = ["Within 48 hours", "This week", "Within 2 weeks", "Flexible"];
export const HOURS_OPTIONS = ["Less than 2 hours", "2–4 hours", "Half day", "Full day", "Multi-day"];

export function getLocalHelpCategory(id: string | undefined) {
  return LOCAL_HELP_CATEGORIES.find((c) => c.id === id) || null;
}

export function defaultServiceMap(options: ServiceOption[], enabled = true): Record<string, boolean> {
  return Object.fromEntries(options.map((o) => [o.id, enabled]));
}

export function formatHourly(rate: number | null | undefined) {
  if (rate == null || !Number.isFinite(Number(rate))) return null;
  return `$${Number(rate)}/hr`;
}

export function formatResponseTime(minutes: number | null | undefined) {
  const m = minutes ?? 60;
  if (m < 60) return `Usually replies in ~${m} min`;
  const h = Math.round(m / 60);
  return h <= 1 ? "Usually replies in ~1 hour" : `Usually replies in ~${h} hours`;
}

/** Lightweight YAJ Buddy estimate (client heuristic until full AI wiring). */
export function estimateLocalHelpNeed(text: string) {
  const t = text.toLowerCase();
  let categoryId = "handyman";
  let title = "Local help request";
  let duration = "2–4 hours";
  let budgetLow = 100;
  let budgetHigh = 250;
  const skills: string[] = [];

  if (/plumb|leak|pipe|faucet|drain/.test(t)) {
    categoryId = "plumbing";
    title = "Plumbing repair";
    skills.push("Plumbing", "Repairs");
    budgetLow = 120;
    budgetHigh = 350;
  } else if (/electr|outlet|wiring|light|breaker/.test(t)) {
    categoryId = "electrician";
    title = "Electrical repair";
    skills.push("Electrical", "Lighting");
    budgetLow = 150;
    budgetHigh = 400;
  } else if (/clean|mess|deep clean/.test(t)) {
    categoryId = "cleaning";
    title = "House cleaning";
    skills.push("Cleaning");
    duration = "2–4 hours";
    budgetLow = 80;
    budgetHigh = 200;
  } else if (/paint|wall/.test(t)) {
    categoryId = "painting";
    title = "Painting help";
    skills.push("Painting", "Finishing");
    budgetLow = 150;
    budgetHigh = 500;
  } else if (/drywall|hole|patch/.test(t)) {
    categoryId = "handyman";
    title = "Drywall repair";
    skills.push("Drywall", "Painting", "Finishing");
    duration = "2–4 hours";
    budgetLow = 150;
    budgetHigh = 250;
  } else if (/dj|music|party/.test(t)) {
    categoryId = "dj";
    title = "DJ / music for event";
    skills.push("DJ", "Music");
    budgetLow = 200;
    budgetHigh = 800;
  } else if (/photo|camera|shoot/.test(t)) {
    categoryId = "photography";
    title = "Photography session";
    skills.push("Photography");
    budgetLow = 150;
    budgetHigh = 600;
  } else if (/lawn|mow|yard/.test(t)) {
    categoryId = "lawn";
    title = "Lawn care";
    skills.push("Lawn care");
    budgetLow = 40;
    budgetHigh = 120;
  } else if (/mov(e|ing)|truck|boxes/.test(t)) {
    categoryId = "moving";
    title = "Local moving help";
    skills.push("Moving");
    budgetLow = 100;
    budgetHigh = 400;
  }

  const description =
    text.trim() ||
    `Need help with ${title.toLowerCase()}. Looking for a reliable local helper on YAJ.`;

  return {
    categoryId,
    title,
    description,
    duration,
    budgetLow,
    budgetHigh,
    skills: skills.length ? skills : ["General help"],
    summary: `Detected need: ${title}. Suggested category: ${getLocalHelpCategory(categoryId)?.label || categoryId}. Estimated ${duration} · $${budgetLow}–$${budgetHigh}.`,
  };
}
