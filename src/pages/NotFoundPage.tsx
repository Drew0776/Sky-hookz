import React from 'react';
import { Link, useLocation } from 'wouter';

/** Shown for any address that isn't a console screen, instead of a blank page or a silent redirect. */
export default function NotFoundPage() {
  const [location] = useLocation();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center font-mono">
      <span className="mb-3 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-xs font-bold uppercase tracking-widest text-rose-300">404</span>
      <h1 className="text-sm font-bold uppercase tracking-wider text-white">Page not found</h1>
      <p className="mb-4 mt-1 max-w-sm text-xs tracking-wide text-slate-400">
        There's no console screen at <span className="text-slate-200">{location}</span>.
      </p>
      <Link href="/" className="rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-400">
        Go to the overview
      </Link>
    </div>
  );
}
