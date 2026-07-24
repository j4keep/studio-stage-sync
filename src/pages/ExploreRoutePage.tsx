import ExplorePage from "./ExplorePage";
import ProfilePage from "./ProfilePage";
import { useIsDesktop } from "@/hooks/use-is-desktop";

/** Phone keeps Explore; desktop Explore tab shows Profile. */
export default function ExploreRoutePage() {
  const isDesktop = useIsDesktop();
  return isDesktop ? <ProfilePage /> : <ExplorePage />;
}
