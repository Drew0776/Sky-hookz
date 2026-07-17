import React from 'react';
import { Loader2 } from 'lucide-react';

interface PageLoaderProps {
  message?: string;
  variant?: 'full' | 'inline' | 'skeleton';
}

export default function PageLoader({ message = 'Loading layout data...', variant = 'full' }: PageLoaderProps) {
  if (variant === 'skeleton') {
    return (
      <div className="space-y-4 w-full animate-pulse p-4" aria-busy="true" aria-live="polite">
        <div className="h-8 bg-slate-900 rounded-lg w-1/4"></div>
        <div className="h-32 bg-slate-900 rounded-xl w-full"></div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-20 bg-slate-900 rounded-lg"></div>
          <div className="h-20 bg-slate-900 rounded-lg"></div>
          <div className="h-20 bg-slate-900 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-slate-500 font-mono text-xs" aria-busy="true" aria-live="polite">
        <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div 
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center"
      aria-busy="true" 
      aria-live="polite"
      id="page-loader-root"
    >
      <div className="rounded-full bg-slate-900 p-4 border border-slate-800">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
      <div>
        <p className="text-sm font-mono tracking-wide text-slate-300">{message}</p>
        <p className="text-xxs font-mono text-slate-600 mt-1 uppercase tracking-widest">SkyHook Logistics</p>
      </div>
    </div>
  );
}
