import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import HomePage from "./pages/HomePage";
import RadioPage from "./pages/RadioPage";
import StudiosPage from "./pages/StudiosPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProfilePage from "./pages/ProfilePage";
import TermsPage from "./pages/TermsPage";
import HelpPage from "./pages/HelpPage";
import LegalVaultPage from "./pages/LegalVaultPage";
import NotFound from "./pages/NotFound";
import TermsAgreementGate from "./components/TermsAgreementGate";

const queryClient = new QueryClient();

const App = () => {
  const [termsAccepted, setTermsAccepted] = useState(() => {
    return localStorage.getItem("wheuat_terms_accepted") === "true";
  });

  const handleAcceptTerms = () => {
    localStorage.setItem("wheuat_terms_accepted", "true");
    setTermsAccepted(true);
  };

  if (!termsAccepted) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-background text-foreground max-w-lg mx-auto relative">
              <Routes>
                <Route path="/terms" element={<TermsPage />} />
                <Route path="*" element={<TermsAgreementGate onAccept={handleAcceptTerms} />} />
              </Routes>
            </div>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/radio" element={<RadioPage />} />
              <Route path="/studios" element={<StudiosPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/legal-vault" element={<LegalVaultPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
