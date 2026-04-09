import { useState, useEffect, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
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
import BattlesPage from "./pages/BattlesPage";
import MusicBattlePlayerPage from "./pages/MusicBattlePlayerPage";
import ArtistProfilePage from "./pages/ArtistProfilePage";
import RadioPage from "./pages/RadioPage";
import StudiosPage from "./pages/StudiosPage";

import ProfilePage from "./pages/ProfilePage";
import TermsPage from "./pages/TermsPage";
import HelpPage from "./pages/HelpPage";
import LegalVaultPage from "./pages/LegalVaultPage";
import PlaylistsPage from "./pages/PlaylistsPage";
import SettingsPage from "./pages/SettingsPage";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";
import MySongsPage from "./pages/MySongsPage";
import MyVideosPage from "./pages/MyVideosPage";

import MyProjectsPage from "./pages/MyProjectsPage";
import MyStorePage from "./pages/MyStorePage";
import EarningsPage from "./pages/EarningsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import MyStudiosPage from "./pages/MyStudiosPage";
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
import AdminTicketsPage from "./pages/AdminTicketsPage";
import AskJhiPage from "./pages/AskJhiPage";
import FeedPage from "./pages/FeedPage";
import { WStudioLayout } from "./wstudio/WStudioLayout";
import SessionJoinScreen from "./wstudio/session/SessionJoinScreen";
import ArtistSessionScreen from "./wstudio/session/ArtistSessionScreen";
import EngineerSessionScreen from "./wstudio/session/EngineerSessionScreen";

import TermsAgreementGate from "./components/TermsAgreementGate";
import ThemePickerSheet from "./components/ThemePickerSheet";

const queryClient = new QueryClient();
const STARTUP_TIMEOUT_MS = 2500;

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
    <AppLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/radio" element={<RadioPage />} />
        <Route path="/studios" element={<StudiosPage />} />
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
        <Route path="/my-studios" element={<MyStudiosPage />} />
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
        <Route path="/ask-jhi" element={<AskJhiPage />} />
        <Route path="/wstudio" element={<WStudioLayout />}>
          <Route index element={<Navigate to="session/join" replace />} />
          <Route path="session/join" element={<SessionJoinScreen />} />
          <Route path="session/artist" element={<ArtistSessionScreen />} />
          <Route path="session/engineer" element={<EngineerSessionScreen />} />
          <Route path="session" element={<Navigate to="/wstudio/session/join" replace />} />
          <Route path="artist" element={<Navigate to="/wstudio/session/artist" replace />} />
          <Route path="engineer" element={<Navigate to="/wstudio/session/engineer" replace />} />
        </Route>
        <Route path="/ai-studio" element={<Navigate to="/wstudio/session/join" replace />} />
        <Route path="/admin/tickets" element={<AdminTicketsPage />} />
        <Route path="/battles" element={<BattlesPage />} />
        <Route path="/battle/:battleId" element={<MusicBattlePlayerPage />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/artist/:userId" element={<ArtistProfilePage />} />
        <Route path="/dollar-club" element={<div className="px-4 pt-4 pb-4 text-center"><h1 className="text-lg font-display font-bold text-foreground mb-2">Dollar Club</h1><p className="text-sm text-muted-foreground">Sell your products for $1 and build your fanbase. Coming soon!</p></div>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
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
