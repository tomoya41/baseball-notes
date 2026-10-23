import type { ReactNode } from "react";
import postseason from "../assets/editorial/postseason-v1.webp";
import draft from "../assets/editorial/draft-v1.webp";
import archive from "../assets/editorial/archive-v1.webp";

const pictures = { postseason, draft, archive };
/** Atmosphere only. All event context and results remain selectable HTML. */
export function EditorialCover({ kind, eyebrow, title, children, level = 1 }: {
  kind: keyof typeof pictures; eyebrow: string; title: string; children?: ReactNode; level?: 1 | 2;
}) {
  return <header className={`editorial-cover editorial-cover--${kind}`}>
    <img src={pictures[kind]} width="960" height="640" alt="" loading="lazy" decoding="async" />
    <div className="editorial-cover-copy"><p>{eyebrow}</p>{level === 1 ? <h1>{title}</h1> : <h2>{title}</h2>}{children}</div>
  </header>;
}
