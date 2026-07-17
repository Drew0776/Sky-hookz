import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-red-950 text-white p-4">
          <div className="max-w-md text-center">
            <div className="font-mono text-xs text-red-400 bg-red-950/50 border border-red-700 rounded px-3 py-2 mb-4 font-bold uppercase tracking-wider">⚠️ SYSTEM ERROR</div>
            <h1 className="text-2xl font-bold mb-4 font-mono">CRITICAL FAILURE</h1>
            <p className="text-sm text-red-200 font-mono mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 px-4 rounded font-mono text-xs uppercase"
            >
              Restart System
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
