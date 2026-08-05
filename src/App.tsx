import { useState, useEffect, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import ImageLightbox from "@/components/ImageLightbox";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { CartProvider } from "@/contexts/CartContext";
import { RadioProvider } from "@/contexts/RadioContext";
import { PlaylistProvider } from "@/contexts/PlaylistContext";
import AppLayout from "./components/AppLayout";
import HomePage from "./pages/HomePage";
import FeedPage from "./pages/FeedPage";
import ExplorePage from "./pages/ExplorePage";
import BattlesPage from "./pages/BattlesPage";
import MusicBattlePlayerPage from "./pages/MusicBattlePlayerPage";
import ArtistProfilePage from "./pages/ArtistProfilePage";
import RadioPage from "./pages/RadioPage";
import StudiosPage from "./pages/StudiosPage";
import MyStudiosPage from "./pages/MyStudiosPage";
import MyBookingsPage from "./pages/MyBookingsPage";
import MyCirclePage from "./pages/MyCirclePage";

import ProfilePage from "./pages/ProfilePage";
import TermsPage from "./pages/TermsPage";
import HelpPage from "./pages/HelpPage";
import LegalVaultPage from "./pages/LegalVaultPage";
import PlaylistsPage from "./pages/PlaylistsPage";
import SettingsPage from "./pages/SettingsPage";
import AuthPage from "./pages/AuthPage";
import OAuthConsent from "./pages/OAuthConsent";
import NotFound from "./pages/NotFound";
import MySongsPage from "./pages/MySongsPage";
import MyVideosPage from "./pages/MyVideosPage";

import MyProjectsPage from "./pages/MyProjectsPage";
import MyStorePage from "./pages/MyStorePage";
import EarningsPage from "./pages/EarningsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import StorePage from "./pages/StorePage";
import MessagesPage from "./pages/MessagesPage";
import BrowseSongsPage from "./pages/BrowseSongsPage";
import BrowseVideosPage from "./pages/BrowseVideosPage";
import PurchasesPage from "./pages/PurchasesPage";
import NewsFeedPage from "./pages/NewsFeedPage";
import ArticlePage from "./pages/ArticlePage";
import NewsCategoryPage from "./pages/NewsCategoryPage";
import MyBoostsPage from "./pages/MyBoostsPage";
import HelpDeskPage from "./pages/HelpDeskPage";
import AdminCustomerRelationsPage from "./pages/AdminCustomerRelationsPage";
import AdminSoundLibraryPage from "./pages/AdminSoundLibraryPage";
import AskYajPage from "./pages/AskYajPage";
import YajAiSettingsPage from "./pages/YajAiSettingsPage";
import YajAiConversationSettingsPage from "./pages/YajAiConversationSettingsPage";
import YajAiAvatarPage from "./pages/YajAiAvatarPage";
import JobsPage from "./pages/JobsPage";
import JobDetailPage from "./pages/JobDetailPage";
import GigDetailPage from "./pages/GigDetailPage";
import MyJobsPage from "./pages/MyJobsPage";
import MyGigsPage from "./pages/MyGigsPage";
import LocalHelpHomePage from "./pages/local-help/LocalHelpHomePage";
import GigBoardPage from "./pages/local-help/GigBoardPage";
import LocalHelpCategoryPage from "./pages/local-help/LocalHelpCategoryPage";
import LocalHelpProPage from "./pages/local-help/LocalHelpProPage";
import LocalHelpBusinessPage from "./pages/local-help/LocalHelpBusinessPage";
import MarketplaceHomePage from "./pages/marketplace/MarketplaceHomePage";
import MarketplaceSearchPage from "./pages/marketplace/MarketplaceSearchPage";
import MarketplaceCategoryPage from "./pages/marketplace/MarketplaceCategoryPage";
import MarketplaceListingPage from "./pages/marketplace/MarketplaceListingPage";
import MarketplaceCreatePage from "./pages/marketplace/MarketplaceCreatePage";
import MarketplaceProfilePage from "./pages/marketplace/MarketplaceProfilePage";
import MarketplaceSavedPage from "./pages/marketplace/MarketplaceSavedPage";
import MarketplaceAccountPage from "./pages/marketplace/MarketplaceAccountPage";
import MarketplaceMessagesPage from "./pages/marketplace/MarketplaceMessagesPage";
import MarketplaceSettingsPage from "./pages/marketplace/MarketplaceSettingsPage";
import MarketplaceOffersPage from "./pages/marketplace/MarketplaceOffersPage";
import MarketplacePurchasesPage from "./pages/marketplace/MarketplacePurchasesPage";
import MarketplaceSalesPage from "./pages/marketplace/MarketplaceSalesPage";
import WellnessHomePage from "./pages/wellness/WellnessHomePage";
import WellnessSleepPage from "./pages/wellness/WellnessSleepPage";
import WellnessMovePage from "./pages/wellness/WellnessMovePage";
import WellnessRelaxPage from "./pages/wellness/WellnessRelaxPage";
import WellnessHabitsPage from "./pages/wellness/WellnessHabitsPage";
import WellnessFoodPage from "./pages/wellness/WellnessFoodPage";
import BlockingSettingsPage from "./pages/BlockingSettingsPage";
import ResumeBuilderPage from "./pages/ResumeBuilderPage";
import JobPreferencesPage from "./pages/JobPreferencesPage";
import EmployerDashboardPage from "./pages/EmployerDashboardPage";
import JobInterviewPage from "./pages/JobInterviewPage";
import WheuatTvWatchPage from "./pages/wheuat-tv/WheuatTvWatchPage";
import ServicesPage from "./pages/ServicesPage";
import ServiceDetailPage from "./pages/ServiceDetailPage";
import EventsPage from "./pages/EventsPage";
import EventDetailPage from "./pages/EventDetailPage";


import { SessionProvider } from "./wstudio/session/SessionContext";

import TermsAgreementGate from "./components/TermsAgreementGate";
import ThemePickerSheet from "./components/ThemePickerSheet";
import { unlockFeedAudioSession } from "@/lib/feed-video-playback";


const queryClient = new QueryClient();

const ComingSoonPage = ({ title }: { title: string }) => (
  <div className="px-6 pt-20 pb-24 max-w-md mx-auto text-center">
    <div className="w-14 h-14 rounded-2xl bg-primary/10 mx-auto mb-4 flex items-center justify-center text-2xl">✨</div>
    <h1 className="text-xl font-display font-bold text-foreground mb-2">{title}</h1>
    <p className="text-sm text-muted-foreground">Coming soon.</p>
  </div>
);
const STARTUP_TIMEOUT_MS = 2500;

// Take A Break guard: blocks Feed / Battles / social discovery while toggle is ON.
const BreakGuard = ({ children }: { children: JSX.Element }) => {
  const [onBreak, setOnBreak] = useState(() => localStorage.getItem("wheuat_take_a_break") === "true");
  useEffect(() => {
    const h = () => setOnBreak(localStorage.getItem("wheuat_take_a_break") === "true");
    window.addEventListener("wheuat-take-a-break-changed", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("wheuat-take-a-break-changed", h);
      window.removeEventListener("storage", h);
    };
  }, []);
  if (onBreak) {
    return (
      <div className="px-6 pt-16 pb-24 max-w-md mx-auto text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 mx-auto mb-4 flex items-center justify-center text-2xl">☕</div>
        <h2 className="text-lg font-display font-bold text-foreground mb-2">You're on a break</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Feed, Battles and social discovery are paused. Podcast, Radio, Studio and Profile are still available.
        </p>
        <a href="#/settings" className="inline-block px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
          Manage in Settings
        </a>
      </div>
    );
  }
  return children;
};

const ProtectedRoutes = () => {
  const { user, loading } = useAuth();
  const { themeSetupDone } = useTheme();
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  const [termsLoading, setTermsLoading] = useState(true);
  const [showThemePicker, setShowThemePicker] = useState(false);

  // Initialize theme – default to light mode
  useEffect(() => {
    const theme = localStorage.getItem("wheuat_theme");
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.remove("light");
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
      localStorage.setItem("wheuat_theme", "light");
    }
  }, []);

  // Check terms acceptance from database
  useEffect(() => {
    if (!user) {
      setTermsAccepted(null);
      setTermsLoading(false);
      return;
    }

    let isActive = true;

    const checkTerms = async () => {
      try {
        const result = await Promise.race([
          supabase
            .from("profiles")
            .select("terms_accepted_at")
            .eq("user_id", user.id)
            .maybeSingle(),
          new Promise<null>((resolve) => window.setTimeout(() => resolve(null), STARTUP_TIMEOUT_MS)),
        ]);

        if (!isActive) return;

        if (result && "data" in result) {
          setTermsAccepted(!!result.data?.terms_accepted_at);
        } else {
          setTermsAccepted(false);
        }
      } catch {
        if (!isActive) return;
        setTermsAccepted(false);
      } finally {
        if (isActive) {
          setTermsLoading(false);
        }
      }
    };

    checkTerms();

    return () => {
      isActive = false;
    };
  }, [user]);

  // Show theme picker after terms accepted if not set up
  useEffect(() => {
    if (termsAccepted && themeSetupDone === false) {
      setShowThemePicker(true);
    }
  }, [termsAccepted, themeSetupDone]);

  const handleAcceptTerms = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq("user_id", user.id);
    setTermsAccepted(true);
  }, [user]);

  if (loading || termsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (!termsAccepted) {
    return (
      <div className="min-h-screen bg-background text-foreground max-w-lg mx-auto relative">
        <Routes>
          <Route path="/terms" element={<TermsPage />} />
          <Route path="*" element={<TermsAgreementGate onAccept={handleAcceptTerms} />} />
        </Routes>
      </div>
    );
  }

  // Show theme picker onboarding – always dark
  if (showThemePicker) {
    return (
      <div className="min-h-screen bg-black text-white max-w-lg mx-auto relative flex items-center justify-center px-6 dark">
        <ThemePickerSheet isOnboarding onComplete={() => setShowThemePicker(false)} />
      </div>
    );
  }

  return (
    <SessionProvider>
    <AppLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/radio" element={<RadioPage />} />
        <Route path="/projects" element={<Navigate to="/my-projects" replace />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/legal-vault" element={<LegalVaultPage />} />
        <Route path="/library" element={<PlaylistsPage />} />
        <Route path="/playlists" element={<PlaylistsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/my-songs" element={<MySongsPage />} />
        <Route path="/my-videos" element={<MyVideosPage />} />

        <Route path="/my-projects" element={<MyProjectsPage />} />
        <Route path="/my-store" element={<MyStorePage />} />
        <Route path="/earnings" element={<EarningsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/store" element={<StorePage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/browse-songs" element={<BrowseSongsPage />} />
        <Route path="/browse-videos" element={<BrowseVideosPage />} />
        <Route path="/purchases" element={<PurchasesPage />} />
        <Route path="/news-feed" element={<NewsFeedPage />} />
        <Route path="/article/:id" element={<ArticlePage />} />
        <Route path="/news/:category" element={<NewsCategoryPage />} />
        <Route path="/my-boosts" element={<MyBoostsPage />} />
        <Route path="/helpdesk" element={<HelpDeskPage />} />
        <Route path="/ask-yaj" element={<AskYajPage />} />
        <Route path="/ask-yaj/settings" element={<YajAiSettingsPage />} />
        <Route path="/ask-yaj/conversation-settings" element={<YajAiConversationSettingsPage />} />
        <Route path="/ask-yaj/avatar" element={<YajAiAvatarPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/local-help" element={<LocalHelpHomePage />} />
        <Route path="/local-help/business" element={<LocalHelpBusinessPage />} />
        <Route path="/local-help/pro/:userId" element={<LocalHelpProPage />} />
        <Route path="/local-help/:categoryId" element={<LocalHelpCategoryPage />} />
        <Route path="/marketplace" element={<MarketplaceHomePage />} />
        <Route path="/marketplace/search" element={<MarketplaceSearchPage />} />
        <Route path="/marketplace/category/:slug" element={<MarketplaceCategoryPage />} />
        <Route path="/marketplace/listing/:id" element={<MarketplaceListingPage />} />
        <Route path="/marketplace/create" element={<MarketplaceCreatePage />} />
        <Route path="/marketplace/edit/:id" element={<MarketplaceCreatePage />} />
        <Route path="/marketplace/profile/:userId" element={<MarketplaceProfilePage />} />
        <Route path="/marketplace/saved" element={<MarketplaceSavedPage />} />
        <Route path="/marketplace/purchases" element={<MarketplacePurchasesPage />} />
        <Route path="/marketplace/sales" element={<MarketplaceSalesPage />} />
        <Route path="/marketplace/offers" element={<MarketplaceOffersPage />} />
        <Route path="/marketplace/messages" element={<MarketplaceMessagesPage />} />
        <Route path="/marketplace/settings" element={<MarketplaceSettingsPage />} />
        <Route path="/marketplace/account" element={<MarketplaceAccountPage />} />
        <Route path="/wellness" element={<WellnessHomePage />} />
        <Route path="/wellness/sleep" element={<WellnessSleepPage />} />
        <Route path="/wellness/move" element={<WellnessMovePage />} />
        <Route path="/wellness/relax" element={<WellnessRelaxPage />} />
        <Route path="/wellness/habits" element={<WellnessHabitsPage />} />
        <Route path="/wellness/food" element={<WellnessFoodPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/interview/:applicationId" element={<JobInterviewPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="/gigs" element={<GigBoardPage />} />
        <Route path="/gigs/:id" element={<GigDetailPage />} />
        <Route path="/my-jobs" element={<MyJobsPage />} />
        <Route path="/my-gigs" element={<MyGigsPage />} />
        <Route path="/settings/blocking" element={<BlockingSettingsPage />} />
        <Route path="/resume-builder" element={<ResumeBuilderPage />} />
        <Route path="/job-preferences" element={<JobPreferencesPage />} />
        <Route path="/employer-dashboard" element={<EmployerDashboardPage />} />
        <Route path="/communities" element={<Navigate to="/circle" replace />} />
        <Route path="/tv/watch" element={<WheuatTvWatchPage />} />
        <Route path="/tv/*" element={<Navigate to="/" replace />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/:id" element={<ServiceDetailPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
        <Route path="/podcast/*" element={<Navigate to="/" replace />} />
        <Route path="/wstudio/*" element={<Navigate to="/" replace />} />
        <Route path="/ai-studio" element={<Navigate to="/" replace />} />
        <Route path="/circle" element={<MyCirclePage />} />
        <Route path="/m/*" element={<Navigate to="/" replace />} />
        <Route path="/studios" element={<StudiosPage />} />
        <Route path="/my-studios" element={<MyStudiosPage />} />
        <Route path="/my-bookings" element={<MyBookingsPage />} />

        <Route path="/admin/tickets" element={<AdminCustomerRelationsPage />} />
        <Route path="/admin/customer-relations" element={<AdminCustomerRelationsPage />} />
        <Route path="/admin/sounds" element={<AdminSoundLibraryPage />} />
        <Route path="/battles" element={<BreakGuard><BattlesPage /></BreakGuard>} />
        <Route path="/battle/:battleId" element={<BreakGuard><MusicBattlePlayerPage /></BreakGuard>} />
        <Route path="/feed" element={<BreakGuard><FeedPage /></BreakGuard>} />
        <Route path="/artist/:userId" element={<BreakGuard><ArtistProfilePage /></BreakGuard>} />
        <Route path="/dollar-club" element={<div className="px-4 pt-4 pb-4 text-center"><h1 className="text-lg font-display font-bold text-foreground mb-2">Dollar Club</h1><p className="text-sm text-muted-foreground">Sell your products for $1 and build your fanbase. Coming soon!</p></div>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
    </SessionProvider>
  );
};

const App = () => {
  useEffect(() => {
    // Silent WAV data URI — playing this INSIDE the first user gesture
    // unlocks audible <video>/<audio> playback for the rest of the session
    // (required on iOS Safari and mobile Chrome — a flag alone won't do it).
    const SILENT_WAV =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    let primer: HTMLAudioElement | null = new Audio(SILENT_WAV);
    primer.muted = false;
    primer.volume = 1;
    primer.setAttribute("playsinline", "true");

    const unlock = () => {
      try {
        if (primer) {
          const p = primer.play();
          if (p && typeof p.then === "function") {
            p.then(() => {
              try { primer?.pause(); } catch { /* ignore */ }
              primer = null;
            }).catch(() => { primer = null; });
          }
        }
        // Also nudge an AudioContext (helps WebKit).
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AC) {
          const ctx = new AC();
          if (ctx.state === "suspended") ctx.resume().catch(() => {});
          window.setTimeout(() => ctx.close().catch(() => {}), 200);
        }
      } catch { /* ignore */ }
      unlockFeedAudioSession();
    };

    const options = { once: true, capture: true } as AddEventListenerOptions;
    window.addEventListener("pointerdown", unlock, options);
    window.addEventListener("touchstart", unlock, options);
    window.addEventListener("keydown", unlock, options);
    window.addEventListener("click", unlock, options);
    return () => {
      window.removeEventListener("pointerdown", unlock, options);
      window.removeEventListener("touchstart", unlock, options);
      window.removeEventListener("keydown", unlock, options);
      window.removeEventListener("click", unlock, options);
    };
  }, []);

  if (window.location.pathname.startsWith("/.lovable/oauth/consent")) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <OAuthConsent />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ImageLightbox />

        <HashRouter>
          <AuthProvider>
            <ThemeProvider>
              <CartProvider>
                <PlaylistProvider>
                  <RadioProvider>
                    <div id="app-bg-layer" className="min-h-screen bg-background text-foreground">
                      <Routes>
                        <Route path="/auth" element={<AuthPage />} />
                        
                        <Route path="/index" element={<Navigate to="/" replace />} />
                        <Route path="/*" element={<ProtectedRoutes />} />
                      </Routes>
                    </div>
                  </RadioProvider>
                </PlaylistProvider>
              </CartProvider>
            </ThemeProvider>
          </AuthProvider>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
