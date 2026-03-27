import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Ensure a hash fragment exists so HashRouter resolves to "/"
if (!window.location.hash) {
  history.replaceState(null, "", window.location.pathname + window.location.search + "#/");
}

createRoot(document.getElementById("root")!).render(<App />);
