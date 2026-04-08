import { Outlet } from "react-router-dom";
import { SessionProvider } from "./session/SessionContext";
import { BookingTimerProvider } from "./booking/BookingTimerContext";

/** Full-viewport shell for remote session flows (no DAW). */
export function WStudioLayout() {
  return (
    <SessionProvider>
      <BookingTimerProvider>
        <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
          <Outlet />
        </div>
      </BookingTimerProvider>
    </SessionProvider>
  );
}
