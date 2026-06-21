/** Real podcast background library + user uploads (local persistence).
 *  - Built-in: curated high-quality Unsplash photos (direct CDN URLs, no key required).
 *  - Search: Unsplash Source endpoint (returns random matching photo per signature).
 *  - Upload: stored as data URLs in localStorage (per-device).
 */

export type PodcastBg =
  | { kind: "none" }
  | { kind: "blur" }
  | { kind: "image"; id: string; url: string; label?: string };

export type BuiltInBg = { id: string; label: string; category: BgCategory; url: string };
export type BgCategory = "studio" | "office" | "city" | "room" | "nature" | "abstract";

const U = (id: string, w = 1280) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

export const BUILTIN_BACKGROUNDS: BuiltInBg[] = [
  // Podcast / studio
  { id: "studio-1", label: "Podcast Booth", category: "studio", url: U("1590602847861-f357a9332bbc") },
  { id: "studio-2", label: "Mic & Headphones", category: "studio", url: U("1598488035139-bdbb2231ce04") },
  { id: "studio-3", label: "Neon Studio", category: "studio", url: U("1581368135153-a506cf13b1e1") },
  { id: "studio-4", label: "Broadcast Desk", category: "studio", url: U("1607435097405-db48f377bff6") },
  // Office
  { id: "office-1", label: "Modern Office", category: "office", url: U("1497366216548-37526070297c") },
  { id: "office-2", label: "Creative Studio", category: "office", url: U("1497366811353-6870744d04b2") },
  { id: "office-3", label: "Wood Workspace", category: "office", url: U("1524758631624-e2822e304c36") },
  // City
  { id: "city-1", label: "New York Skyline", category: "city", url: U("1496442226666-8d4d0e62e6e9") },
  { id: "city-2", label: "Tokyo Night", category: "city", url: U("1542051841857-5f90071e7989") },
  { id: "city-3", label: "Paris Rooftops", category: "city", url: U("1502602898657-3e91760cbb34") },
  { id: "city-4", label: "London Bridge", category: "city", url: U("1513635269975-59663e0ac1ad") },
  { id: "city-5", label: "LA Sunset", category: "city", url: U("1444723121867-7a241cacace9") },
  // Room
  { id: "room-1", label: "Modern Living Room", category: "room", url: U("1505691938895-1758d7feb511") },
  { id: "room-2", label: "Library", category: "room", url: U("1521587760476-6c12a4b040da") },
  { id: "room-3", label: "Cozy Den", category: "room", url: U("1493809842364-78817add7ffb") },
  { id: "room-4", label: "Brick Loft", category: "room", url: U("1554995207-c18c203602cb") },
  // Nature
  { id: "nature-1", label: "Mountain Lake", category: "nature", url: U("1506905925346-21bda4d32df4") },
  { id: "nature-2", label: "Beach", category: "nature", url: U("1507525428034-b723cf961d3e") },
  { id: "nature-3", label: "Forest", category: "nature", url: U("1448375240586-882707db888b") },
  { id: "nature-4", label: "Sunset Sky", category: "nature", url: U("1495616811223-4d98c6e9c869") },
  // Abstract
  { id: "abs-1", label: "Purple Gradient", category: "abstract", url: U("1557682250-33bd709cbe85") },
  { id: "abs-2", label: "Neon Lights", category: "abstract", url: U("1550745165-9bc0b252726f") },
  { id: "abs-3", label: "Soft Bokeh", category: "abstract", url: U("1492724441997-5dc865305da7") },
  { id: "abs-4", label: "Dark Texture", category: "abstract", url: U("1451187580459-43490279c0fa") },
];

const KEY_UPLOADS = "wheuat.podcast.bg.uploads";
const KEY_SEL = (sessionId: string) => `wheuat.podcast.bg.sel:${sessionId}`;

export type UploadedBg = { id: string; label: string; dataUrl: string; createdAt: number };

export const PodcastBackgrounds = {
  listUploads(): UploadedBg[] {
    try { return JSON.parse(localStorage.getItem(KEY_UPLOADS) || "[]"); } catch { return []; }
  },
  saveUpload(file: File): Promise<UploadedBg> {
    return new Promise((resolve, reject) => {
      if (file.size > 6 * 1024 * 1024) return reject(new Error("Image must be under 6MB"));
      const reader = new FileReader();
      reader.onload = () => {
        const item: UploadedBg = {
          id: `up-${Date.now()}`,
          label: file.name.replace(/\.[^.]+$/, "").slice(0, 24) || "Upload",
          dataUrl: String(reader.result || ""),
          createdAt: Date.now(),
        };
        const list = PodcastBackgrounds.listUploads();
        list.unshift(item);
        try { localStorage.setItem(KEY_UPLOADS, JSON.stringify(list.slice(0, 24))); } catch {}
        resolve(item);
      };
      reader.onerror = () => reject(reader.error || new Error("Read failed"));
      reader.readAsDataURL(file);
    });
  },
  deleteUpload(id: string) {
    const list = PodcastBackgrounds.listUploads().filter(u => u.id !== id);
    try { localStorage.setItem(KEY_UPLOADS, JSON.stringify(list)); } catch {}
  },
  getSelection(sessionId: string): PodcastBg {
    try {
      const raw = localStorage.getItem(KEY_SEL(sessionId));
      if (raw) return JSON.parse(raw) as PodcastBg;
    } catch {}
    return { kind: "none" };
  },
  setSelection(sessionId: string, bg: PodcastBg) {
    try { localStorage.setItem(KEY_SEL(sessionId), JSON.stringify(bg)); } catch {}
  },
  /** Search the public Unsplash Source endpoint. Returns N distinct URLs
   *  (different `sig` values) for the given query. No API key required. */
  searchUrls(query: string, count = 8): string[] {
    const q = encodeURIComponent(query.trim() || "studio");
    return Array.from({ length: count }, (_, i) =>
      `https://source.unsplash.com/featured/1280x720/?${q}&sig=${Date.now() % 100000 + i}`
    );
  },
};
