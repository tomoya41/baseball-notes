import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Paged document flow, never a vertical scrolling pane. React retains ownership
 * of the contents, forms and data; columns only determine presentation pages. */
export function ViewportPages({ children, resetKey = "" }: { children: ReactNode; resetKey?: string }) {
  const windowRef = useRef<HTMLDivElement>(null), flowRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(0), sizeRef = useRef(1);
  const [page, setPage] = useState(0), [count, setCount] = useState(1);
  const move = (next: number) => {
    pageRef.current = next; setPage(next);
    const viewport = windowRef.current;
    if (viewport) viewport.scrollLeft = next * sizeRef.current;
  };
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => move(0));
    return () => cancelAnimationFrame(frame);
  }, [resetKey]);
  useLayoutEffect(() => {
    const viewport = windowRef.current!, flow = flowRef.current!;
    let frame = 0;
    const focusedPage = () => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !flow.contains(active)) return null;
      const target = active.getBoundingClientRect(), bounds = viewport.getBoundingClientRect();
      return Math.max(0, Math.floor((target.left - bounds.left + viewport.scrollLeft + 1) / sizeRef.current));
    };
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = viewport.clientHeight;
        flow.style.setProperty("--page-height", `${height}px`);
        // Reset before reflow: a row that needed splitting with the keyboard open
        // can return to its compact layout once the viewport grows again.
        for (const node of flow.querySelectorAll("[data-page-split],[data-page-table]")) {
          node.removeAttribute("data-page-split"); node.removeAttribute("data-page-table");
        }
        if (height > 0) {
          const oversized = [...flow.querySelectorAll<HTMLElement>("*")].filter(node =>
            node instanceof HTMLElement && !node.closest("details:not([open])") &&
            node.getBoundingClientRect().height > height + 1);
          for (const node of oversized) {
            node.setAttribute("data-page-split", "");
            if (node.matches("tr,th,td")) node.closest("table")?.setAttribute("data-page-table", "");
          }
        }
        sizeRef.current = (viewport.getBoundingClientRect().width || viewport.clientWidth) + 24;
        const pages = Math.max(1, Math.ceil((flow.scrollWidth + 23) / sizeRef.current));
        setCount(pages);
        const bounded = Math.min(focusedPage() ?? pageRef.current, pages - 1);
        pageRef.current = bounded; setPage(bounded);
        viewport.scrollLeft = bounded * sizeRef.current;
      });
    };
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    resize?.observe(viewport);
    window.addEventListener("resize", measure);
    const mutation = new MutationObserver(measure);
    mutation.observe(flow, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["open", "hidden"] });
    const focus = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      const target = event.target.getBoundingClientRect(), bounds = viewport.getBoundingClientRect();
      const next = Math.max(0, Math.floor((target.left - bounds.left + viewport.scrollLeft + 1) / sizeRef.current));
      move(next);
    };
    flow.addEventListener("focusin", focus);
    measure();
    return () => { cancelAnimationFrame(frame); resize?.disconnect(); window.removeEventListener("resize", measure); mutation.disconnect(); flow.removeEventListener("focusin", focus); };
  }, []);
  return <div className="viewport-pages"><div className="viewport-pages-window" ref={windowRef}><div className="viewport-pages-flow" ref={flowRef}>{children}</div></div>
    <nav className="viewport-pages-controls" aria-label="画面のページ切替"><button type="button" aria-label="前のページ" disabled={page === 0} onClick={() => move(Math.max(0, page - 1))}><ChevronLeft size={18} aria-hidden="true" /><span>前へ</span></button><span className="viewport-page-number"><span role="status" aria-live="polite">{page + 1}<small> / {count}</small></span><select aria-label="ページを選択" value={page} onChange={e => move(Number(e.target.value))}>{Array.from({ length: count }, (_, index) => <option key={index} value={index}>{index + 1} / {count}</option>)}</select></span><button type="button" aria-label="次のページ" disabled={page + 1 >= count} onClick={() => move(Math.min(count - 1, page + 1))}><span>次へ</span><ChevronRight size={18} aria-hidden="true" /></button></nav>
  </div>;
}
