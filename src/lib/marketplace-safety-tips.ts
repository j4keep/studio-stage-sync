/** Shared buyer/seller exchange safety tips for Marketplace + Privacy/Security. */

export type MarketplaceSafetyTip = {
  id: string;
  title: string;
  body: string;
};

export const MARKETPLACE_SAFETY_TIPS: MarketplaceSafetyTip[] = [
  {
    id: "public-meet",
    title: "Meet in public",
    body: "Choose a busy public place—cafés, store lobbies, or a police precinct safe-exchange zone. Avoid private homes for first meetings.",
  },
  {
    id: "personal-info",
    title: "Protect personal information",
    body: "Don’t share your home address, full legal name on ID, bank details, Social Security number, or passwords. Keep chat on YAJ.",
  },
  {
    id: "bring-someone",
    title: "Bring someone with you",
    body: "When meeting a buyer or seller you don’t know, tell a friend where you’re going—or bring them along.",
  },
  {
    id: "inspect-first",
    title: "Inspect before you pay",
    body: "Check the item in person before handing over cash. Never wire money, send gift cards, or pay deposits to strangers in advance.",
  },
  {
    id: "payment-scams",
    title: "Watch for payment scams",
    body: "Fake “payment sent” screenshots and overpayment checks are common. Prefer cash for local pickup and confirm funds yourself.",
  },
  {
    id: "trust-instincts",
    title: "Trust your instincts",
    body: "If a deal feels rushed, secretive, or off—walk away. Report suspicious listings or users from Help & Support.",
  },
];

export const MARKETPLACE_SAFETY_INTRO =
  "Stay safe when buying, selling, or exchanging locally. These tips apply to both buyers and sellers.";
