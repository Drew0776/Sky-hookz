import { useEffect, useRef, useState } from 'react';

/** Fired on window when the yard server answers again after being unreachable, so screens reload their data. */
export const RECONNECTED_EVENT = 'skyhook:reconnected';

const CHECK_MS = 10_000;
const RETRY_MS = 3_000;

/**
 * Says so plainly when the yard server can't be reached, instead of letting screens look live. Checks
 * /api/health every 10 s (every 3 s while it's down) and tells the screens to reload once it's back.
 */
export default function ConnectionBanner() {
  const [down, setDown] = useState(false);
  const wasDown = useRef(false);

  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;
    const check = async () => {
      let ok = false;
      try {
        ok = (await fetch('/api/health', { cache: 'no-store' })).ok;
      } catch {
        ok = false;
      }
      if (stopped) return;
      if (ok && wasDown.current) window.dispatchEvent(new Event(RECONNECTED_EVENT));
      wasDown.current = !ok;
      setDown(!ok);
      timer = window.setTimeout(check, ok ? CHECK_MS : RETRY_MS);
    };
    check();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (!down) return null;
  return (
    <div role="alert" id="connection-banner" className="mx-auto mt-3 w-full max-w-7xl px-4">
      <div className="rounded-xl border border-rose-500/40 bg-rose-950/60 px-4 py-3 font-mono text-xs text-rose-200">
        <strong className="text-rose-100">Can't reach the yard server.</strong> What you see may be out of date, and moves won't go
        through until it's back. Retrying every few seconds…
      </div>
    </div>
  );
}
