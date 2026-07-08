import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  resetKey: string;
}

interface State {
  failedKey: string | null;
}

export default class FeedCardErrorBoundary extends Component<Props, State> {
  state: State = { failedKey: null };

  static getDerivedStateFromError(_: Error): State {
    return { failedKey: "failed" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Feed card crashed", error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.failedKey) {
      this.setState({ failedKey: null });
    }
  }

  render() {
    if (this.state.failedKey) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black px-6 text-center text-sm text-white/70">
          This post couldn&apos;t load. Swipe for the next one.
        </div>
      );
    }

    return this.props.children;
  }
}