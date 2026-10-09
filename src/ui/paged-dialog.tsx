import { useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ViewportPages } from "./viewport-pages";

/** Mounted only while open, so closed metric help does not observe layout. */
export function PagedDialog({ children, label, labelledBy, onClose }: {
  children: ReactNode; label?: string; labelledBy?: string; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => { ref.current?.showModal(); }, []);
  const dialog = <dialog ref={ref} className="metric-dialog paged-dialog" aria-label={label} aria-labelledby={labelledBy} onClose={onClose}>
    <ViewportPages>{children}</ViewportPages>
    <form method="dialog"><button className="button">閉じる</button></form>
  </dialog>;
  return typeof document === "undefined" ? dialog : createPortal(dialog, document.body);
}
