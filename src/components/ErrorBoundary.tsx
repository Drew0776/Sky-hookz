import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in SkyHook Exception Boundary:', error, errorInfo);
  }

  private handleReset = () => {
    (this as any).setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if ((this as any).state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-slate-100" id="error-boundary-screen">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/20 bg-slate-900 p-6 shadow-2xl shadow-rose-950/20 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-500 mb-4">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h1 className="font-mono text-base font-bold tracking-tight text-white mb-2">FABRICATION LINE HALT</h1>
            <p className="text-xs text-slate-400 font-mono tracking-wide leading-relaxed mb-6">
              A critical software failure has halted the terminal interface: {((this as any).state.error)?.message || 'Unknown Context Offset Error'}
            </p>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-mono font-bold text-slate-950 hover:bg-amber-400 focus:outline-hidden transition-colors cursor-pointer w-full justify-center"
            >
              <RefreshCw className="h-4 w-4" />
              <span>RESTART CONSOLE TERMINAL</span>
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
