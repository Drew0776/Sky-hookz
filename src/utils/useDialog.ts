import { useEffect, useRef } from 'react';

// Open dialogs, innermost last, so only the top one answers Escape and Tab when dialogs stack
const openDialogs: symbol[] = [];

/** Whether any dialog using this hook is open (for older modals that handle Escape themselves). */
export const hasOpenDialog = (): boolean => openDialogs.length > 0;

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog behaviour for the element the returned ref is attached to: focus moves into it when
 * it opens, Tab and Shift+Tab stay inside it, Escape calls `onClose`, and focus returns to whatever
 * opened it when it closes.
 */
export function useDialog<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const id = Symbol('dialog');
    openDialogs.push(id);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const box = ref.current;
    const focusable = (): HTMLElement[] =>
      box ? Array.from<HTMLElement>(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => !el.hasAttribute('disabled') && el.getClientRects().length > 0) : [];
    (focusable()[0] ?? box)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== id) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !box?.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !box?.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      openDialogs.splice(openDialogs.indexOf(id), 1);
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return ref;
}
