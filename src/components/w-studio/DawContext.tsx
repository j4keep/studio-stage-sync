// Paste your new DawContext code here
import { createContext, useContext, type ReactNode } from "react";
const DawCtx = createContext<any>(null);
export const useDaw = () => useContext(DawCtx);
export const INPUT_SOURCE_OPTIONS: string[] = [];
export function DawProvider({ children }: { children: ReactNode }) { return <DawCtx.Provider value={{}}>{children}</DawCtx.Provider>; }