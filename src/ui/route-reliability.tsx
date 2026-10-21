import { Component, useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { DataState } from "./components";

// Query-only edits keep input focus/scroll; new screens announce the main landmark.
export function RouteFocus() {
  const { pathname } = useLocation(), previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    window.scrollTo(0, 0);
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}
export class RouteErrorBoundary extends Component<{ children: ReactNode; reload?:()=>void }, { failed: boolean; moduleFailed:boolean }> {
  state = { failed: false, moduleFailed:false };
  static getDerivedStateFromError(error:unknown) { return { failed:true,moduleFailed:error instanceof Error&&/Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [^\n]+ failed/.test(error.message) }; }
  render() {
    return this.state.failed ? <section className="screen"><h1>画面を表示できません</h1>
      <DataState kind="source-unavailable" detail="保存データは変更していません。別の画面へ移動するか、再表示してください。" />
      <button className="button" onClick={() => this.state.moduleFailed?(this.props.reload??(()=>window.location.reload()))():this.setState({ failed: false })}>{this.state.moduleFailed?"最新版を読み込む":"再表示"}</button>
    </section> : this.props.children;
  }
}
