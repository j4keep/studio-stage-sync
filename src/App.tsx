import { useState, useEffect, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { CartProvider } from "@/contexts/CartContext";
import { RadioProvider } from "@/contexts/RadioContext";
import AppLayout from "./components/AppLayout";
import HomePage from "./pages/HomePage";
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
import MyPodcastsPage from "./pages/MyPodcastsPage";
import MyProjectsPage from "./pages/MyProjectsPage";
import MyStorePage from "./pages/MyStorePage";
import EarningsPage from "./pages/EarningsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import MyStudiosPage from "./pages/MyStudiosPage";
import StorePage from "./pages/StorePage";
import TermsAgreementGate from "./components/TermsAgreementGate";

const queryClient = new QueryClient();

const ProtectedRoutes = () => {
  const { user, loading } = useAuth();
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  const [termsLoading, setTermsLoading] = useState(true);

  // Initialize theme on mount
  useEffect(() => {
    const theme = localStorage.getItem("wheuat_theme");
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.remove("dark");
      root.classList.add("light");
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
    }
  }, []);

  // Check terms acceptance from database
  useEffect(() => {
    if (!user) {
      setTermsLoading(false);
      return;
    }
    const checkTerms = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("terms_accepted_at")
        .eq("user_id", user.id)
        .single();
      setTermsAccepted(!!data?.terms_accepted_at);
      setTermsLoading(false);
    };
    checkTerms();
  }, [user]);

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
    return <Navigate to="/auth" replace />;
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
        <Route path="/my-podcasts" element={<MyPodcastsPage />} />
        <Route path="/my-projects" element={<MyProjectsPage />} />
        <Route path="/my-store" element={<MyStorePage />} />
        <Route path="/earnings" element={<EarningsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/my-studios" element={<MyStudiosPage />} />
        <Route path="/store" element={<StorePage />} />
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
        <BrowserRouter>
          <AuthProvider>
            <CartProvider>
              <RadioProvider>
                <Routes>
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/*" element={<ProtectedRoutes />} />
                </Routes>
              </RadioProvider>
            </CartProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
