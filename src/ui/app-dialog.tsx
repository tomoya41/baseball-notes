import { useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Mounted only while open, so closed metric help does not observe layout. */
export function AppDialog({ children, label, labelledBy, onClose }: {
  children: ReactNode; label?: string; labelledBy?: string; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const root = document.documentElement, previous = root.style.overflow;
    root.style.overflow = "hidden";
    ref.current?.showModal();
    return () => { root.style.overflow = previous; };
  }, []);
  const dialog = <dialog ref={ref} className="metric-dialog app-dialog" aria-label={label} aria-labelledby={labelledBy} onClose={onClose}>
    <div className="app-dialog-content">{children}</div>
    <form method="dialog"><button className="button">閉じる</button></form>
  </dialog>;
  return typeof document === "undefined" ? dialog : createPortal(dialog, document.body);
}
