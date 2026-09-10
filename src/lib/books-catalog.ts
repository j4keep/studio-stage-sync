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

import harborLightsCover from "@/assets/books/harbor-lights-cover.svg";
import stageLeftCover from "@/assets/books/stage-left-cover.svg";
import { HARBOR_LIGHTS_PAGES } from "@/lib/books/harbor-lights";
import { STAGE_LEFT_PAGES } from "@/lib/books/stage-left";

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
    blurb: "A pier community faces a storm that forces old secrets ashore. A short novella told in full reading pages.",
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
    blurb: "An understudy gets one night to rewrite a career—and a family. A theater novella in full reading pages.",
    pages: STAGE_LEFT_PAGES,
  },
  {
    id: "drama-quiet-room",
    title: "The Quiet Room",
    author: "S. Vale",
    audience: "regular",
    category: "drama",
    listingType: "donation",
    coverFrom: "#334155",
    coverTo: "#94a3b8",
    blurb: "A mediator returns to her hometown courthouse for one last case.",
    pages: pages(
      "The quiet room smelled of lemon polish and old paper. Nora arranged three chairs in a triangle and waited for the families who would not look at each other.",
      "The dispute was about a bakery lease. Beneath it lived grief neither side had named.",
      "Nora asked only one question: “What do you want the town to remember about this week?” Silence stretched, then broke into honest talk.",
      "By afternoon they had a plan that saved the lease and a memorial shelf for the missing partner.",
      "Nora locked the quiet room and walked into rain that felt like applause for work no audience would ever see.",
    ),
  },
  {
    id: "drama-after-the-bell",
    title: "After the Bell",
    author: "Priya Nair",
    audience: "regular",
    category: "drama",
    listingType: "sale",
    price: 4.99,
    coverFrom: "#14532d",
    coverTo: "#86efac",
    blurb: "A high-school counselor and a student rebuild trust one lunch period at a time.",
    pages: pages(
      "The lunch bell emptied the halls. Ms. Cole kept her door open anyway — habit, hope, and leftover granola bars.",
      "Devon sat without speaking for eleven minutes. On the twelfth, he asked if a person could restart mid-semester.",
      "They made a chart of small wins: one class, one friend, one honest conversation with home.",
      "By spring, Devon ran the peer circle. Ms. Cole still kept granola bars. Some tools never go out of style.",
      "Graduation day, Devon left a note: “You held the quiet until I could fill it.” She taped it inside her desk drawer.",
    ),
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
    pages: pages(
      "The elevator stalled between 14 and 15. Ava checked her phone — no signal. The man across from her straightened his tie like it could restart the cables.",
      "“Worst timing,” he said. Ava almost laughed. Her interview was in twelve minutes; his was a goodbye he had postponed for years.",
      "They traded stories to kill the dark. She wanted a chance. He wanted forgiveness from a sister who worked on 15.",
      "When the car lurched upward, Ava offered to walk him to the door. He offered to vouch for her if anyone asked why she was late.",
      "They stepped out into light. Some journeys only need one shared floor to change the destination.",
    ),
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
    pages: pages(
      "Hydroponic vines climbed the curved glass as Station Helix turned toward the sun. Dr. Sol patched a drip line and whispered to the tomato seedlings like old friends.",
      "An alert flashed: unauthorized drone approaching the vault hatch. Sol sealed the greenhouse and floated to the airlock with a toolkit and a stubborn hope.",
      "The drone carried a cracked memory chip from Earthside — maps of soil that might still grow.",
      "Sol planted the first experimental tray that night under artificial dawn. Green returned like a promise.",
      "In the log she wrote: “Orbit is temporary. Roots are the mission.”",
    ),
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
    pages: pages(
      "Night watch on Relay Nine was supposed to be quiet. Then the receiver sang a nine-beat pattern from empty coordinates.",
      "Captain Rhee ordered silence protocol. Junior tech Lin kept a private copy of the waveform anyway.",
      "Decoded, the pattern mapped to a childhood lullaby — Lin’s. Someone out there knew her name.",
      "The crew voted to answer with one soft pulse. The reply arrived as starlight bent around a shape that looked almost like a door.",
      "They did not open it yet. Some signals are invitations you answer with patience.",
    ),
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
    pages: pages(
      "Chrome rain hissed on the transit glass. Kai’s satchel held three licensed storm tokens and one contraband sun-disk.",
      "District 4 paid well for warmth. The Weather Guild paid better for silence.",
      "Kai ducked through a market of umbrellas and handed the disk to a clinic roof. Light spilled like medicine.",
      "Guild drones arrived late. Patients were already smiling under a manufactured noon.",
      "Kai vanished into the wet neon, already planning the next illegal dawn.",
    ),
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
    pages: pages(
      "The booth sold first kisses and last vacations by the gram. Jules bought a quiet afternoon that felt almost like home.",
      "That night a gap opened: three hours missing from Tuesday. The receipt listed a seller ID Jules recognized — her own.",
      "She traced the stall to a warehouse of humming drives. Her stolen Tuesdays powered someone else’s comfort.",
      "Jules deleted the black-market index and kept one memory: learning to say no.",
      "The market lights dimmed. For the first time, her mind felt like it belonged to her again.",
    ),
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
    pages: pages(
      "At breakfast the sky held two moons. Newsfeeds screamed. In the schoolyard, children pointed at numbers floating in the air that adults could not see.",
      "Teacher Amira believed her students. Together they charted the countdown etched on the pale new stone.",
      "Day zero was not an ending. It was a handshake from a civilization that spoke in games.",
      "The children answered with chalk drawings on the playground. The second moon brightened once, like a nod.",
      "Amira filed the report as “First Contact, recess edition.” History would need a new chapter title.",
    ),
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
    pages: pages(
      "The 8:12 became the 9:03. Nora recognized the man with the worn paperback — the one who never made her wedding years ago.",
      "He looked up. “Nora?” Rain streaked the window between them like a soft curtain.",
      "They talked until the conductor cleared his throat. Numbers were exchanged on a napkin that smelled faintly of coffee.",
      "Their first real date was another late train, chosen on purpose.",
      "Some love stories, Nora decided, run on delay — and arrive exactly when they should.",
    ),
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
    pages: pages(
      "The festival map put taco and dumpling trucks side by side. Steam and rivalry rose together.",
      "Judge scoring tied them. The only fair rematch was a private cook-off at midnight.",
      "They borrowed a shared kitchen and burned the first pan laughing.",
      "By plate three, rivalry tasted like partnership.",
      "They merged menus in spring. The signature dish was called “Almost Tied.”",
    ),
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
    pages: pages(
      "Mae found the first note in a mystery paperback: “Page 212 made me brave.” No signature.",
      "More notes arrived with returns — always kind, always curious.",
      "She answered in the margins of a poetry display copy. The stranger answered back.",
      "They met under the store awning during a soft storm, both holding the same dog-eared volume.",
      "Mae kept the notes in a cigar box labeled “Inventory of Hope.”",
    ),
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
    pages: pages(
      "Leo’s balcony faced June’s. Her basil thrived; his playlists leaked through open doors.",
      "They traded cuttings in a hanging basket on a rope. Then recipes. Then evenings.",
      "When the building sold, they feared the end of balcony season.",
      "Instead they rented a place with one shared railing and twice the light.",
      "Love, June wrote in her journal, grows best with a little distance — and a good rope.",
    ),
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
    pages: pages(
      "Assignment: three days, one coastal town, one witty article. Sam planned to stay detached.",
      "The lighthouse keeper ruined that plan with coffee and bad jokes that somehow worked.",
      "Sam’s draft softened. So did her departure ticket.",
      "She mailed the editor a postcard instead of a resignation: “Extending research indefinitely.”",
      "Home, it turned out, could be a place you review until you stop leaving.",
    ),
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
    pages: pages(
      "Clara balanced the nonprofit’s accounts until a red ledger appeared in the safe with no keycard log.",
      "Names inside matched donors who had never existed. Transfers pointed offshore.",
      "She followed the ink to a storage unit and a camera that had filmed its own thief.",
      "The board chair resigned by sunrise. Clara kept a photocopy labeled “Truth, reconciled.”",
      "Some mysteries close with a stamp, not a confession.",
    ),
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
    pages: pages(
      "Platform 7 should have been empty. The fog train hissed in anyway, doors inviting.",
      "Detective Ruiz stepped on with a cold case file and a return ticket she did not buy.",
      "Each car held a witness from a different year of the unsolved fire.",
      "At the last stop the conductor handed her a matchbook from the burned hotel — unused.",
      "Ruiz stepped into morning with the answer warming her pocket.",
    ),
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
    pages: pages(
      "The gallery alarm never tripped. The masterpiece was gone; the frame remained, whispering a riddle in scratched brass.",
      "Curator Lin decoded it as a map of shadow angles at 3:17 p.m.",
      "At that minute, sunlight revealed a false panel behind “Untitled Storm.”",
      "Inside: the painting, and a note from a thief who only wanted it protected from a forged sale.",
      "Lin hung it again under better locks — and a better story.",
    ),
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
    pages: pages(
      "The night shift key was heavier than it looked. Mara’s first solo evening, it hummed.",
      "Shelves rearranged themselves into a corridor she had never catalogued.",
      "At the end: a reading room of unfinished books waiting for honest endings.",
      "Mara returned a stolen manuscript to its rightful shelf. The key cooled in her palm.",
      "Some libraries keep more than paper — they keep second chances.",
    ),
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
    pages: pages(
      "Pencil to paper, June drew the defendant. In the gallery, another pencil moved in mirror.",
      "The stranger’s page showed June’s face with a date tomorrow.",
      "She left a decoy sketch on the courthouse steps and followed the real artist into rain.",
      "Confrontation in an alley: a copycat chasing fame, not blood. Police took the confession.",
      "June’s next sketch was blank on purpose. Peace, she decided, needed white space.",
    ),
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
    pages: pages(
      "The crown arrived in ash. When Ryn placed it on the anvil, it flared at every false word in the workshop.",
      "The duke’s messenger lied about tribute. The crown scorched the air between them.",
      "Ryn marched to court with truth ringing like struck iron.",
      "The duke knelt. The realm exhaled.",
      "Ryn returned to the forge. Power, she learned, is hottest when you set it down.",
    ),
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
    pages: pages(
      "Names drifted on the black water like lanterns. Without them, people forgot who they loved.",
      "Ilya waded in with a net woven from grandmother’s stories.",
      "Each caught name glowed and returned to a waiting chest.",
      "By sunrise the village remembered itself — including Ilya’s own middle name, long missing.",
      "She left the net by the bank for the next forgetful tide.",
    ),
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
    pages: pages(
      "The sparrow ticked on Pip’s windowsill, then flew into the storm drain.",
      "Pip followed into a marketplace of gears and quiet magic.",
      "The bird’s key wound a gate that only honest thieves could open — irony intended.",
      "Pip returned a stolen heirloom and gained a brass feather of passage.",
      "Above ground, dawn looked newly engineered.",
    ),
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
    pages: pages(
      "Captain Ade poured salt into the sea and named a star. The mast leaned toward answer.",
      "The constellation asked for a story instead of gold.",
      "Ade told the truth of a mutiny forgiven. Stars brightened the reef path.",
      "The crew slept under a sky that felt like a signed treaty.",
      "By morning the salt circle was gone — payment accepted.",
    ),
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
    pages: pages(
      "Archivist Wren found a wyrmling chewing the unfinished chapter of a cursed epic.",
      "Fed properly on contradictions, the dragon glowed and whispered repairs.",
      "Together they stitched endings that respected every character.",
      "The wyrm curled asleep on the returns desk, full and kind.",
      "Wren posted a sign: “Please do not feed the plot holes.”",
    ),
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
