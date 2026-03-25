import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const bootApp = () => {
  const { hash, pathname, search } = window.location;

  if (!hash && (pathname === "/index" || pathname === "/")) {
    window.location.replace(`${pathname}${search}#/`);
    return;
  }

  createRoot(document.getElementById("root")!).render(<App />);
};

bootApp();
