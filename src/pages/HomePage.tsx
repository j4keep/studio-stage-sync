import FeedPage from "./FeedPage";
import ExplorePage from "./ExplorePage";
import { useIsDesktop } from "@/hooks/use-is-desktop";

/**
 * Phone: original full-screen video feed.
 * Desktop: Explore hub in the center (right rail stays in AppLayout).
 */
const HomePage = () => {
  const isDesktop = useIsDesktop();
  return isDesktop ? <ExplorePage /> : <FeedPage />;
};

export default HomePage;
