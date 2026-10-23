import { useState } from "react";
import { Link } from "react-router-dom";
import { findLicensedPlayerPhoto, licensedPlayerPhotos } from "../presentation/licensed-player-photos";

export function LicensedPlayerPhoto({ playerId, season }: { playerId: string; season: number }) {
  const photo = findLicensedPlayerPhoto(playerId, season);
  const [failedSrc, setFailedSrc] = useState("");
  if (!photo || failedSrc === photo.src) return null;
  return <figure className="licensed-player-photo"><img src={photo.src} alt={`${photo.name}、2024年撮影`} width={photo.width} height={photo.height} loading="lazy" decoding="async" onError={() => setFailedSrc(photo.src)} />
    <figcaption><Link to="/MLB/sources" aria-label={`${photo.name}の2024年撮影写真の出典`}>2024年撮影 · 出典</Link></figcaption></figure>;
}

export function PlayerPhotoCredits() {
  return <section className="surface-card"><h2>選手写真</h2><p>2024年撮影の写真を、2024〜2025年の過去成績とともに表示しています。写真は撮影当時の姿で、選択年度や現在の所属・背番号を示すものではありません。選手・球団による公認や推奨を意味しません。</p>
    {licensedPlayerPhotos.map(p => <p key={p.playerId}><a href={p.source}>{p.name}の原写真・履歴</a> · {p.author} · <a href={p.licenseUrl}>{p.license}</a><br />{p.edits} 写真の派生ファイルにも同じライセンスが適用されます。</p>)}
  </section>;
}
