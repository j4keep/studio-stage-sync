import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const bootApp = () => {
  const { pathname, search, hash } = window.location;
  const normalizedPath = pathname.endsWith("/index") ? pathname.slice(0, -6) || "/" : pathname;
  const normalizedHash = hash || "#/";

  if (pathname !== normalizedPath || hash !== normalizedHash) {
    history.replaceState(null, "", `${normalizedPath}${search}${normalizedHash}`);
  }

  createRoot(document.getElementById("root")!).render(<App />);
};

bootApp();
