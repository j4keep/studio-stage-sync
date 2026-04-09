import { Outlet } from "react-router-dom";
import { SessionProvider } from "./session/SessionContext";
import { BookingTimerProvider } from "./booking/BookingTimerContext";

/** Full-viewport shell for remote session flows (no DAW). */
export function WStudioLayout() {
  return (
    <SessionProvider>
      <BookingTimerProvider>
        <div className="flex min-h-screen min-h-0 flex-col bg-zinc-950 text-zinc-100">
          <div className="flex min-h-0 flex-1 flex-col">
            <Outlet />
          </div>
        </div>
      </BookingTimerProvider>
    </SessionProvider>
  );
}
