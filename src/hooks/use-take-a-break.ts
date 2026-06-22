import { useEffect, useState } from "react";

const KEY = "wheuat_take_a_break";

const read = () => {
  try { return localStorage.getItem(KEY) === "true"; } catch { return false; }
};

export const useTakeABreak = () => {
  const [onBreak, setOnBreakState] = useState<boolean>(read);

  useEffect(() => {
    const sync = () => setOnBreakState(read());
    window.addEventListener("storage", sync);
    window.addEventListener("wheuat-take-a-break-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("wheuat-take-a-break-changed", sync);
    };
  }, []);

  const setOnBreak = (val: boolean) => {
    try { localStorage.setItem(KEY, String(val)); } catch {}
    setOnBreakState(val);
    window.dispatchEvent(new Event("wheuat-take-a-break-changed"));
  };

  return { onBreak, setOnBreak };
};

export const isOnBreak = read;
