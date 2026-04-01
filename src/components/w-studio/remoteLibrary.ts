/**
 * Remote samples — CC0 / permissive teaching demos. Fetch may fail if CORS or network blocks;
 * UI shows status when decode fails.
 */
export type RemoteLibraryItemRow = {
  id: string;
  name: string;
  /** Human-readable origin for attribution */
  source: string;
  url: string;
};

export type RemoteLibraryItem = RemoteLibraryItemRow & { category: string };

export const REMOTE_LIBRARY_BY_CATEGORY: { category: string; items: RemoteLibraryItemRow[] }[] = [
  {
    category: 'MDN / Mozilla (CC0 teaching)',
    items: [
      {
        id: 'mdn_trex',
        name: 'T-Rex roar (CC0)',
        source: 'MDN interactive-examples',
        url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
      },
      {
        id: 'mdn_outfoxing',
        name: 'Outfoxing (CC0 demo)',
        source: 'MDN interactive-examples',
        url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/AudioContext_outfoxing.mp3',
      },
    ],
  },
  {
    category: 'MDN learning-area (GitHub raw)',
    items: [
      {
        id: 'mdn_viper',
        name: 'Viper (demo loop)',
        source: 'mdn/learning-area',
        url: 'https://raw.githubusercontent.com/mdn/learning-area/main/html/multimedia-and-embedding/video-and-audio-content/viper.mp3',
      },
    ],
  },
  {
    category: 'Wikimedia Commons (libre media)',
    items: [
      {
        id: 'wiki_guitar',
        name: 'Guitar chord C (OGG transcode)',
        source: 'Wikimedia Commons',
        url: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/c/cf/C_major_chord.ogg/C_major_chord.ogg.mp3',
      },
    ],
  },
];

export const REMOTE_LIBRARY_FLAT: RemoteLibraryItem[] = REMOTE_LIBRARY_BY_CATEGORY.flatMap((g) =>
  g.items.map((i) => ({ ...i, category: g.category })),
);
