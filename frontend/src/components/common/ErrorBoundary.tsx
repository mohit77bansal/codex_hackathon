import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", this.props.label || "", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="m-6 rounded-2xl ring-1 ring-rose-400/30 bg-rose-500/10 p-5 text-sm text-rose-100">
        <div className="font-semibold mb-1">Something broke while rendering this view.</div>
        <div className="text-xs opacity-80 mb-2">{this.state.error.message}</div>
        <pre className="text-[10px] opacity-60 whitespace-pre-wrap max-h-40 overflow-auto">
          {this.state.error.stack}
        </pre>
        <button
          onClick={this.reset}
          className="mt-3 px-3 py-1.5 rounded-lg bg-white/10 ring-1 ring-white/20 text-xs"
        >
          Try again
        </button>
      </div>
    );
  }
}
