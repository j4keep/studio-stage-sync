/**
 * Kept as a pass-through: the shared <LocationGate /> in App.tsx now handles the
 * location prompt for every "near me" section, so item pages don't wrap anything.
 */
export default function MarketplaceLocationGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
