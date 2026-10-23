import { useId, useRef, useState, type ReactNode } from "react";

type Side = "away" | "home";
export function GameJumpNav() {
  const jump = (button: HTMLButtonElement, section: string) => {
    const target = button.closest(".game-detail")?.querySelector<HTMLElement>(`[data-game-section="${section}"]`);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start", behavior: "instant" });
  };
  return <nav className="game-jump-nav" aria-label="試合内の移動">
    <button onClick={e => jump(e.currentTarget, "recap")}>試合概要</button>
    <button onClick={e => jump(e.currentTarget, "box")}>選手成績</button>
  </nav>;
}

/** Changing sides only reveals already loaded rows, never another data fetch. */
export function GameBoxScore({ away, home, selectedSide, onSideChange }: {
  away: { name: string; content: ReactNode }; home: { name: string; content: ReactNode };
  selectedSide?: Side; onSideChange?: (side: Side) => void;
}) {
  const id = useId(), [local, setLocal] = useState<Side>("away");
  const side = selectedSide ?? local;
  const buttons = useRef<Partial<Record<Side, HTMLButtonElement | null>>>({});
  const select = (next: Side) => { setLocal(next); onSideChange?.(next); };
  return <section className="game-box-score" data-game-section="box" tabIndex={-1} aria-label="ボックススコア">
    <h2>選手成績</h2><div className="game-box-switch" role="tablist" aria-label="成績を表示する球団">
      {(["away", "home"] as const).map((key, index) => <button key={key} ref={el => { buttons.current[key] = el; }}
        id={`${id}-${key}-tab`} role="tab" aria-selected={side === key} aria-controls={`${id}-${key}-panel`} tabIndex={side === key ? 0 : -1}
        onClick={() => select(key)} onKeyDown={e => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
          e.preventDefault();
          const next = e.key === "Home" ? "away" : e.key === "End" ? "home" : key === "away" ? "home" : "away";
          select(next); buttons.current[next]?.focus();
        }}><small>{index === 0 ? "ビジター" : "ホーム"}</small><strong>{key === "away" ? away.name : home.name}</strong></button>)}
    </div>
    {(["away", "home"] as const).map(key => <div key={key} id={`${id}-${key}-panel`} role="tabpanel"
      aria-labelledby={`${id}-${key}-tab`} hidden={side !== key}>{key === "away" ? away.content : home.content}</div>)}
  </section>;
}
