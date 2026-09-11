/** YAJ Books — catalog types, seed books, and local user uploads. */

export type BookListingType = "sale" | "donation" | "free";
export type BookAudience = "regular" | "kids";

export type RegularCategoryId =
  | "drama"
  | "sci-fi"
  | "romance"
  | "mystery"
  | "fantasy";

export type BookCategoryId = RegularCategoryId | "kids";

export type BookPage = {
  /** Full reading-page text (adult pages should be substantial paragraphs). */
  text: string;
  /** Optional chapter label shown in the slim adult reader header. */
  chapter?: string;
};

export type BookItem = {
  id: string;
  title: string;
  author: string;
  audience: BookAudience;
  category: BookCategoryId;
  listingType: BookListingType;
  price?: number | null;
  /** CSS gradient stops for cover art */
  coverFrom: string;
  coverTo: string;
  coverAccent?: string;
  /** Optional real cover image (SVG/PNG URL). */
  coverImage?: string;
  blurb: string;
  pages: BookPage[];
  /** true when created by a user upload */
  userUploaded?: boolean;
};

export const REGULAR_CATEGORIES: {
  id: RegularCategoryId;
  label: string;
  hint: string;
}[] = [
  { id: "drama", label: "Drama", hint: "Human stories & stage" },
  { id: "sci-fi", label: "Science Fiction", hint: "Future & wonder" },
  { id: "romance", label: "Romance", hint: "Love & hearts" },
  { id: "mystery", label: "Mystery", hint: "Clues & suspense" },
  { id: "fantasy", label: "Fantasy", hint: "Magic & quests" },
];

import harborLightsCover from "@/assets/books/harbor-lights-cover.jpg";
import stageLeftCover from "@/assets/books/stage-left-cover.jpg";
import quietRoomCover from "@/assets/books/quiet-room-cover.jpg";
import afterTheBellCover from "@/assets/books/after-the-bell-cover.jpg";
import { HARBOR_LIGHTS_PAGES } from "@/lib/books/harbor-lights";
import { STAGE_LEFT_PAGES } from "@/lib/books/stage-left";
import { QUIET_ROOM_PAGES } from "@/lib/books/quiet-room";
import { AFTER_THE_BELL_PAGES } from "@/lib/books/after-the-bell";
import { GLASS_ELEVATOR_PAGES } from "@/lib/books/glass-elevator";
import { ORBIT_GARDEN_PAGES } from "@/lib/books/orbit-garden";
import { SIGNAL_NINE_PAGES } from "@/lib/books/signal-nine";
import { CHROME_RAIN_PAGES } from "@/lib/books/chrome-rain";
import { MEMORY_MARKET_PAGES } from "@/lib/books/memory-market";
import { SECOND_MOON_PAGES } from "@/lib/books/second-moon";
import { LATE_TRAIN_PAGES } from "@/lib/books/late-train";
import { RECIPE_FOR_US_PAGES } from "@/lib/books/recipe-for-us";
import { INK_PROMISE_PAGES } from "@/lib/books/ink-promise";
import { BALCONY_SEASON_PAGES } from "@/lib/books/balcony-season";
import { POSTCARD_HOME_PAGES } from "@/lib/books/postcard-home";
import { RED_LEDGER_PAGES } from "@/lib/books/red-ledger";
import { FOG_STATION_PAGES } from "@/lib/books/fog-station";
import { LOCKED_GALLERY_PAGES } from "@/lib/books/locked-gallery";
import { MIDNIGHT_LIBRARY_KEY_PAGES } from "@/lib/books/midnight-library-key";
import { SILENT_WITNESS_PAGES } from "@/lib/books/silent-witness";
import { EMBER_CROWN_PAGES } from "@/lib/books/ember-crown";
import { RIVER_OF_NAMES_PAGES } from "@/lib/books/river-of-names";
import { CLOCKWORK_SPARROW_PAGES } from "@/lib/books/clockwork-sparrow";
import { SALT_AND_STARLIGHT_PAGES } from "@/lib/books/salt-and-starlight";
import { LIBRARY_WYRM_PAGES } from "@/lib/books/library-wyrm";

const UPLOADS_KEY = "yaj.books.user-uploads.v1";
const INTRO_SEEN_KEY = "yaj.books.intro-seen.v1";
const KIDS_INTRO_SEEN_KEY = "yaj.books.kids-intro-seen.v1";

function pages(...chunks: string[]): BookPage[] {
  return chunks.map((text) => ({ text }));
}

/** Five original titles per regular category + ten kids titles. */
export const SEED_BOOKS: BookItem[] = [
  // Drama
  {
    id: "drama-harbor-lights",
    title: "Harbor Lights",
    author: "Amara Quinn",
    audience: "regular",
    category: "drama",
    listingType: "free",
    coverFrom: "#0B1C2C",
    coverTo: "#0ea5e9",
    coverImage: harborLightsCover,
    blurb: "Some people find their way home in the darkest places. A coastal novella told in full reading pages.",
    pages: HARBOR_LIGHTS_PAGES,
  },
  {
    id: "drama-stage-left",
    title: "Stage Left",
    author: "Jonah Reed",
    audience: "regular",
    category: "drama",
    listingType: "free",
    coverFrom: "#7F1D1D",
    coverTo: "#FBBF24",
    coverImage: stageLeftCover,
    blurb: "Sometimes the biggest role is the one you weren't supposed to get. A theater novella in full reading pages.",
    pages: STAGE_LEFT_PAGES,
  },
  {
    id: "drama-quiet-room",
    title: "The Quiet Room",
    author: "S. Vale",
    audience: "regular",
    category: "drama",
    listingType: "donation",
    coverFrom: "#0F172A",
    coverTo: "#94A3B8",
    coverImage: quietRoomCover,
    blurb: "Healing doesn't always make noise. A mediation novella in full reading pages.",
    pages: QUIET_ROOM_PAGES,
  },
  {
    id: "drama-after-the-bell",
    title: "After the Bell",
    author: "Priya Nair",
    audience: "regular",
    category: "drama",
    listingType: "sale",
    price: 4.99,
    coverFrom: "#065F46",
    coverTo: "#A7F3D0",
    coverImage: afterTheBellCover,
    blurb: "Same hallways. New beginnings. A warmer school novella in full reading pages.",
    pages: AFTER_THE_BELL_PAGES,
  },
  {
    id: "drama-glass-elevator",
    title: "Glass Elevator",
    author: "Marc Ellison",
    audience: "regular",
    category: "drama",
    listingType: "free",
    coverFrom: "#0f172a",
    coverTo: "#64748b",
    blurb: "Two strangers stuck between floors learn what they each left unsaid.",
    pages: GLASS_ELEVATOR_PAGES,
  },

  // Sci-fi
  {
    id: "scifi-orbit-garden",
    title: "Orbit Garden",
    author: "Nia Okonkwo",
    audience: "regular",
    category: "sci-fi",
    listingType: "free",
    coverFrom: "#042f2e",
    coverTo: "#22d3ee",
    blurb: "A botanist tends Earth’s last seed vault on a spinning station.",
    pages: ORBIT_GARDEN_PAGES,
  },
  {
    id: "scifi-signal-nine",
    title: "Signal Nine",
    author: "Theo Marsh",
    audience: "regular",
    category: "sci-fi",
    listingType: "sale",
    price: 6.99,
    coverFrom: "#1e1b4b",
    coverTo: "#818cf8",
    blurb: "A deep-space listener hears a pattern that should not exist.",
    pages: SIGNAL_NINE_PAGES,
  },
  {
    id: "scifi-chrome-rain",
    title: "Chrome Rain",
    author: "L. Park",
    audience: "regular",
    category: "sci-fi",
    listingType: "free",
    coverFrom: "#111827",
    coverTo: "#38bdf8",
    blurb: "In a city of weather machines, a courier delivers illegal sunshine.",
    pages: CHROME_RAIN_PAGES,
  },
  {
    id: "scifi-memory-market",
    title: "Memory Market",
    author: "Imani Brooks",
    audience: "regular",
    category: "sci-fi",
    listingType: "donation",
    coverFrom: "#3b0764",
    coverTo: "#e879f9",
    blurb: "Bought memories come with receipts — and missing hours.",
    pages: MEMORY_MARKET_PAGES,
  },
  {
    id: "scifi-second-moon",
    title: "Second Moon",
    author: "Ravi Desai",
    audience: "regular",
    category: "sci-fi",
    listingType: "free",
    coverFrom: "#0c4a6e",
    coverTo: "#a5f3fc",
    blurb: "Earth wakes to a new moon — and a countdown only kids can see.",
    pages: SECOND_MOON_PAGES,
  },

  // Romance
  {
    id: "romance-late-train",
    title: "The Late Train",
    author: "Elena Soto",
    audience: "regular",
    category: "romance",
    listingType: "free",
    coverFrom: "#9f1239",
    coverTo: "#fb7185",
    blurb: "Two commuters share a delayed car and a second chance.",
    pages: LATE_TRAIN_PAGES,
  },
  {
    id: "romance-recipe-for-us",
    title: "Recipe for Us",
    author: "Camille Orth",
    audience: "regular",
    category: "romance",
    listingType: "sale",
    price: 3.99,
    coverFrom: "#9a3412",
    coverTo: "#fdba74",
    blurb: "Rival food-truck chefs compete — then cook for each other.",
    pages: RECIPE_FOR_US_PAGES,
  },
  {
    id: "romance-ink-promise",
    title: "Ink Promise",
    author: "H. Lowell",
    audience: "regular",
    category: "romance",
    listingType: "free",
    coverFrom: "#1e3a8a",
    coverTo: "#93c5fd",
    blurb: "A bookstore owner finds love notes hidden in returned novels.",
    pages: INK_PROMISE_PAGES,
  },
  {
    id: "romance-balcony-season",
    title: "Balcony Season",
    author: "Yara Bennet",
    audience: "regular",
    category: "romance",
    listingType: "donation",
    coverFrom: "#831843",
    coverTo: "#f9a8d4",
    blurb: "Neighbors share plants, playlists, and carefully timed glances.",
    pages: BALCONY_SEASON_PAGES,
  },
  {
    id: "romance-postcard-home",
    title: "Postcard Home",
    author: "D. Nguyen",
    audience: "regular",
    category: "romance",
    listingType: "free",
    coverFrom: "#be123c",
    coverTo: "#fecdd3",
    blurb: "A travel writer falls for the town she meant only to review.",
    pages: POSTCARD_HOME_PAGES,
  },

  // Mystery
  {
    id: "mystery-red-ledger",
    title: "The Red Ledger",
    author: "G. Hart",
    audience: "regular",
    category: "mystery",
    listingType: "free",
    coverFrom: "#450a0a",
    coverTo: "#ef4444",
    blurb: "An accountant finds a second set of books — in blood-red ink.",
    pages: RED_LEDGER_PAGES,
  },
  {
    id: "mystery-fog-station",
    title: "Fog Station",
    author: "Bea Morin",
    audience: "regular",
    category: "mystery",
    listingType: "sale",
    price: 5.49,
    coverFrom: "#1f2937",
    coverTo: "#9ca3af",
    blurb: "A detective boards a train that was never on the timetable.",
    pages: FOG_STATION_PAGES,
  },
  {
    id: "mystery-locked-gallery",
    title: "Locked Gallery",
    author: "Owen Price",
    audience: "regular",
    category: "mystery",
    listingType: "free",
    coverFrom: "#312e81",
    coverTo: "#c4b5fd",
    blurb: "A missing painting leaves only a frame and a riddle.",
    pages: LOCKED_GALLERY_PAGES,
  },
  {
    id: "mystery-midnight-library-key",
    title: "Midnight Library Key",
    author: "Tess Hollow",
    audience: "regular",
    category: "mystery",
    listingType: "donation",
    coverFrom: "#0f172a",
    coverTo: "#6366f1",
    blurb: "Night librarians guard a key that opens more than doors.",
    pages: MIDNIGHT_LIBRARY_KEY_PAGES,
  },
  {
    id: "mystery-silent-witness",
    title: "Silent Witness",
    author: "Kade Monroe",
    audience: "regular",
    category: "mystery",
    listingType: "free",
    coverFrom: "#18181b",
    coverTo: "#a1a1aa",
    blurb: "A courtroom sketch artist sees the killer in the crowd — sketching her.",
    pages: SILENT_WITNESS_PAGES,
  },

  // Fantasy
  {
    id: "fantasy-ember-crown",
    title: "Ember Crown",
    author: "Faye Alden",
    audience: "regular",
    category: "fantasy",
    listingType: "free",
    coverFrom: "#7c2d12",
    coverTo: "#fbbf24",
    blurb: "A forge apprentice inherits a crown that burns only liars.",
    pages: EMBER_CROWN_PAGES,
  },
  {
    id: "fantasy-river-of-names",
    title: "River of Names",
    author: "Soren Vale",
    audience: "regular",
    category: "fantasy",
    listingType: "sale",
    price: 7.99,
    coverFrom: "#064e3b",
    coverTo: "#34d399",
    blurb: "To save her village, a girl must reclaim the names the river stole.",
    pages: RIVER_OF_NAMES_PAGES,
  },
  {
    id: "fantasy-clockwork-sparrow",
    title: "Clockwork Sparrow",
    author: "Mina Rost",
    audience: "regular",
    category: "fantasy",
    listingType: "free",
    coverFrom: "#1e293b",
    coverTo: "#f59e0b",
    blurb: "A brass bird leads a thief to a city under the city.",
    pages: CLOCKWORK_SPARROW_PAGES,
  },
  {
    id: "fantasy-salt-and-starlight",
    title: "Salt & Starlight",
    author: "Noor Hale",
    audience: "regular",
    category: "fantasy",
    listingType: "donation",
    coverFrom: "#1e3a8a",
    coverTo: "#fde68a",
    blurb: "Sailors bargain with constellations for safe passage.",
    pages: SALT_AND_STARLIGHT_PAGES,
  },
  {
    id: "fantasy-library-wyrm",
    title: "The Library Wyrm",
    author: "Cole Bright",
    audience: "regular",
    category: "fantasy",
    listingType: "free",
    coverFrom: "#365314",
    coverTo: "#a3e635",
    blurb: "A tiny dragon eats plot holes — and grows wise.",
    pages: LIBRARY_WYRM_PAGES,
  },

  // Kids (10)
  {
    id: "kids-apple-adventure",
    title: "Apple’s Big Adventure",
    author: "YAJ Kids",
    audience: "kids",
    category: "kids",
    listingType: "free",
    coverFrom: "#dc2626",
    coverTo: "#86efac",
    coverAccent: "#fef08a",
    blurb: "A smiling apple finds a book and learns to share stories.",
    pages: pages(
      "Once there was a round red apple with the biggest smile in the orchard.",
      "One windy day a little book landed right on Apple’s face — plop!",
      "Apple peeked through the pages and saw dragons, trains, and friendly stars.",
      "“I will share these stories!” Apple giggled, rolling down the hill to the playground.",
      "All the kids took turns reading. Apple’s smile grew even wider. The end — for now!",
    ),
  },
  {
    id: "kids-moon-pajamas",
    title: "Moonbeam Pajamas",
    author: "Lulu Sparks",
    audience: "kids",
    category: "kids",
    listingType: "free",
    coverFrom: "#1d4ed8",
    coverTo: "#c4b5fd",
    blurb: "Soft pajamas that glow when you tell the truth at bedtime.",
    pages: pages(
      "Mia’s new pajamas twinkled like tiny moons.",
      "When she said “I brushed my teeth,” they glowed. When she fibbed, they went dim.",
      "Mia told the truth about the cookie crumb. Glow!",
      "She fell asleep in a constellation of honesty.",
      "Sweet dreams, little truth-teller.",
    ),
  },
  {
    id: "kids-bus-that-giggled",
    title: "The Bus That Giggled",
    author: "Tommy Toot",
    audience: "kids",
    category: "kids",
    listingType: "free",
    coverFrom: "#ea580c",
    coverTo: "#fde047",
    blurb: "A school bus that only starts when everyone laughs together.",
    pages: pages(
      "Beep-beep! The yellow bus would not budge.",
      "The driver winked. “It needs a giggle key.”",
      "One joke, then two, then a whole bus of belly laughs.",
      "Vroom! Off they went to school, still smiling.",
      "Best. Morning. Ever.",
    ),
  },
  {
    id: "kids-sock-detective",
    title: "Sock Detective",
    author: "Pippa Pair",
    audience: "kids",
    category: "kids",
    listingType: "donation",
    coverFrom: "#7c3aed",
    coverTo: "#f9a8d4",
    blurb: "A brave sock searches the laundry for its missing match.",
    pages: pages(
      "Left Sock peeked out of the basket. “Where is Right?”",
      "Clues: glitter, a crayon, and a tiny trail of crumbs.",
      "Under the bed — a fort! Right Sock was reading comics.",
      "“Next time, invite me,” Left said. They high-fived (sort of).",
      "Case closed. Laundry wins!",
    ),
  },
  {
    id: "kids-rainbow-toast",
    title: "Rainbow Toast",
    author: "Chef Bean",
    audience: "kids",
    category: "kids",
    listingType: "free",
    coverFrom: "#db2777",
    coverTo: "#fbbf24",
    blurb: "Breakfast becomes a parade of colors and kindness.",
    pages: pages(
      "Sam wanted boring toast. The toaster had other plans.",
      "Pop! Out came stripes of red, orange, yellow, green, blue.",
      "Sam shared slices with neighbors on the stairs.",
      "The whole building smelled like happy mornings.",
      "Toast tastes better when it’s shared.",
    ),
  },
  {
    id: "kids-tiny-captain",
    title: "Tiny Captain",
    author: "River Wave",
    audience: "kids",
    category: "kids",
    listingType: "free",
    coverFrom: "#0e7490",
    coverTo: "#67e8f9",
    blurb: "A paper-boat captain sails a puddle ocean.",
    pages: pages(
      "After the rain, Cap’n Dot launched a paper boat.",
      "Worms waved. Puddle fish (imaginary) cheered.",
      "A leaf storm! Dot steered with a twig rudder.",
      "Safe harbor: the front step. Mission complete.",
      "Tomorrow’s forecast: more adventures.",
    ),
  },
  {
    id: "kids-bear-who-counted",
    title: "The Bear Who Counted",
    author: "Numbers McNuzzle",
    audience: "kids",
    category: "kids",
    listingType: "sale",
    price: 1.99,
    coverFrom: "#92400e",
    coverTo: "#fcd34d",
    blurb: "A cozy bear counts stars until sleep arrives.",
    pages: pages(
      "Bear counted one soft star… two… three…",
      "At twelve, the sky winked back.",
      "At twenty, Bear’s eyes felt heavy as honey.",
      "At twenty-one, snores. The stars kept watch.",
      "Goodnight, little counter.",
    ),
  },
  {
    id: "kids-robot-recess",
    title: "Robot Recess",
    author: "Beep Boop",
    audience: "kids",
    category: "kids",
    listingType: "free",
    coverFrom: "#4f46e5",
    coverTo: "#a5b4fc",
    blurb: "A classroom robot learns hopscotch and friendship.",
    pages: pages(
      "Clank loved math. Recess? Unknown territory.",
      "Kids taught hopscotch. Clank counted squares perfectly.",
      "Then Clank taught them a beep-beep dance.",
      "Friendship firmware: updated!",
      "When the bell rang, everyone rolled back inside — giggling.",
    ),
  },
  {
    id: "kids-whispering-crayon",
    title: "The Whispering Crayon",
    author: "Color Kit",
    audience: "kids",
    category: "kids",
    listingType: "free",
    coverFrom: "#15803d",
    coverTo: "#86efac",
    blurb: "A crayon that only draws what you feel.",
    pages: pages(
      "Maya’s crayon whispered, “Draw your brave.”",
      "She sketched a tall tree and a small climbing self.",
      "Next: “Draw your kind.” A shared umbrella appeared.",
      "The page glowed softly, like a hug.",
      "Art, Maya learned, can speak without shouting.",
    ),
  },
  {
    id: "kids-picnic-on-a-cloud",
    title: "Picnic on a Cloud",
    author: "Sky Snack",
    audience: "kids",
    category: "kids",
    listingType: "donation",
    coverFrom: "#0284c7",
    coverTo: "#fef9c3",
    blurb: "Friends pack snacks and float up for the fluffiest lunch.",
    pages: pages(
      "Balloons lifted the picnic blanket — slowly, safely, silly.",
      "Sandwiches tasted extra cloudy.",
      "A bird joined for crumbs and conversation.",
      "They floated down before nap time.",
      "Best picnic. Zero ants. Ten giggles.",
    ),
  },
];

export function formatBookPrice(book: BookItem): string {
  if (book.listingType === "free") return "Free";
  if (book.listingType === "donation") return "Donation";
  if (book.price != null) return `$${book.price.toFixed(2)}`;
  return "For sale";
}

export function loadUserBooks(): BookItem[] {
  try {
    const raw = localStorage.getItem(UPLOADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BookItem[]) : [];
  } catch {
    return [];
  }
}

export function saveUserBook(book: BookItem) {
  const next = [book, ...loadUserBooks().filter((b) => b.id !== book.id)];
  localStorage.setItem(UPLOADS_KEY, JSON.stringify(next));
}

export function allBooks(): BookItem[] {
  return [...loadUserBooks(), ...SEED_BOOKS];
}

export function getBookById(id: string): BookItem | undefined {
  return allBooks().find((b) => b.id === id);
}

export function booksForCategory(category: BookCategoryId): BookItem[] {
  return allBooks().filter((b) => b.category === category);
}

export function regularBooks(): BookItem[] {
  return allBooks().filter((b) => b.audience === "regular");
}

export function kidsBooks(): BookItem[] {
  return allBooks().filter((b) => b.audience === "kids");
}

export function hasSeenBooksIntro(): boolean {
  try {
    return localStorage.getItem(INTRO_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markBooksIntroSeen() {
  try {
    localStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function hasSeenKidsIntro(): boolean {
  try {
    return localStorage.getItem(KIDS_INTRO_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markKidsIntroSeen() {
  try {
    localStorage.setItem(KIDS_INTRO_SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}
