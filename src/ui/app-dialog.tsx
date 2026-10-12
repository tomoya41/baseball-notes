import { useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

// A picker can open from an action sheet. Restore document scrolling only
// after the last dialog leaves, including a route change that unmounts both.
let scrollLocks = 0;
let previousOverflow = "";

/** Mounted only while open, so closed metric help does not observe layout. */
export function AppDialog({ children, label, labelledBy, onClose }: {
  children: ReactNode; label?: string; labelledBy?: string; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const trigger = document.activeElement;
    if (scrollLocks === 0) previousOverflow = root.style.overflow;
    scrollLocks++;
    root.style.overflow = "hidden";
    ref.current?.showModal();
    return () => {
      if (--scrollLocks === 0) root.style.overflow = previousOverflow;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  const dialog = <dialog ref={ref} className="metric-dialog app-dialog" aria-label={label} aria-labelledby={labelledBy} onClose={onClose}>
    <div className="app-dialog-content">{children}</div>
    <form method="dialog"><button className="button">閉じる</button></form>
  </dialog>;
  return typeof document === "undefined" ? dialog : createPortal(dialog, document.body);
}
