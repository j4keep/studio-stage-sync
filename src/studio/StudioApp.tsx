import { Routes, Route, Navigate } from "react-router-dom";
import { StudioProvider } from "./state/StudioContext";
import StartPage from "./pages/StartPage";
import CreateSessionPage from "./pages/CreateSessionPage";
import EngineerRoom from "./pages/EngineerRoom";
import ArtistJoinPage from "./pages/ArtistJoinPage";
import ArtistRoom from "./pages/ArtistRoom";
import DemoRoom from "./pages/DemoRoom";
import "./studio.css";

export default function StudioApp() {
  return (
    <div data-studio-app="true" className="studio-root min-h-screen text-foreground">
      <StudioProvider>
        <Routes>
          <Route index element={<StartPage />} />
          <Route path="create" element={<CreateSessionPage />} />
          <Route path="engineer/:sessionId" element={<EngineerRoom />} />
          <Route path="join/:sessionId" element={<ArtistJoinPage />} />
          <Route path="artist/:sessionId" element={<ArtistRoom />} />
          <Route path="demo" element={<DemoRoom />} />
          <Route path="*" element={<Navigate to="/studio" replace />} />
        </Routes>
      </StudioProvider>
    </div>
  );
}
