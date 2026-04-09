import { Component, type ErrorInfo, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { SessionProvider } from "./session/SessionContext";
import { BookingTimerProvider } from "./booking/BookingTimerContext";
import { StudioMediaProvider } from "./media/StudioMediaContext";

type EBState = { error: Error | null };

class WStudioErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { error: null };

  static getDerivedStateFromError(error: Error): EBState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("W.Studio render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col bg-zinc-950 px-4 py-8 text-zinc-100">
          <h1 className="text-lg font-bold text-white">W.Studio couldn&apos;t load this screen</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Open the browser console (⌥⌘J) for details, or go back to session join and try again.
          </p>
          <pre className="mt-4 max-h-[40vh] overflow-auto rounded-lg border border-zinc-800 bg-black/50 p-3 text-xs text-red-300">
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Shell for remote session flows. Nav is handled by AppLayout. */
export function WStudioLayout() {
  return (
    <SessionProvider>
      <BookingTimerProvider>
        <StudioMediaProvider>
          <div className="flex min-h-screen w-full flex-col bg-zinc-950 text-zinc-100">
            <WStudioErrorBoundary>
              <div className="flex min-h-screen w-full min-w-0 flex-1 flex-col">
                <Outlet />
              </div>
            </WStudioErrorBoundary>
          </div>
        </StudioMediaProvider>
      </BookingTimerProvider>
    </SessionProvider>
  );
}
