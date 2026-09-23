import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

export function BaseballIcon(props: Props) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 4.1c2.6 2 3.9 4.7 3.9 7.9s-1.3 5.9-3.9 7.9M16 4.1c-2.6 2-3.9 4.7-3.9 7.9s1.3 5.9 3.9 7.9" />
    <path d="m7.7 7.1 2 1.2m-2.2 3 2.2.5m-2 4.2 2-1.1m6.6-7.8-2 1.2m2.2 3-2.2.5m2 4.2-2-1.1" />
  </svg>;
}

export function BatIcon(props: Props) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M20.5 3.5c-1-1-2.6-.9-3.5 0L9 11.5l3.5 3.5 8-8c.9-.9 1-2.5 0-3.5Z" />
    <path d="m9 11.5-4.7 4.7 3.5 3.5 4.7-4.7M3.4 20.6l1.8-1.8" />
  </svg>;
}

export function HomePlateIcon(props: Props) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M4 5h16v9l-8 7-8-7V5Z" />
    <path d="M8 9h8" />
  </svg>;
}
