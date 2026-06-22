import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Ensure direct links like /feed resolve correctly with HashRouter.
if (!window.location.hash) {
  const directPath = window.location.pathname === "/" ? "/" : window.location.pathname;
  history.replaceState(null, "", `${window.location.search}#${directPath}`);
}

createRoot(document.getElementById("root")!).render(<App />);
