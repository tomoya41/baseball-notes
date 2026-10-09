import { Link, useLocation, useParams } from "react-router-dom";
import type { League } from "../domain/models";
import { CalendarDays, ArrowLeftRight, GraduationCap, Trophy, ScanLine, ChevronRight } from "lucide-react";
import { PageHeading } from "./components";

import { futureSections } from "../presentation/future-features";
import type { FutureSection } from "../presentation/future-features";
import { hasHistoricalPostseason, usePostseasonAvailability } from "./postseason-availability";
export function FutureFeatureScreen({ feature, league }: { feature: FutureSection; league: League }) {
  const value = futureSections[feature], { playerId } = useParams(), location = useLocation();
  const base = playerId && ["career", "advanced"].includes(feature) ? `/${league}/players/${encodeURIComponent(playerId)}/${feature}` : `/${league}/${feature}`;
  const params = new URLSearchParams(location.search), requestedTab = Number(params.get("tab") ?? 0);
  const tab = Number.isInteger(requestedTab) && requestedTab >= 0 && requestedTab < value.tabs.length ? requestedTab : 0;
  return <div className="screen"><Link className="back-link" to={playerId ? `/${league}/players/${encodeURIComponent(playerId)}` : `/${league}/explore`}>← {playerId ? "選手ページ" : "野球をもっと知る"}</Link>
    <PageHeading eyebrow={`${league} · 今後の機能`} title={value.title} detail={value.detail} />
    <nav className="profile-tabs" aria-label={`${value.title}の表示切替`}>{value.tabs.map((label,index) => <Link key={label} to={`${base}?tab=${index}`} aria-current={tab === index ? "page" : undefined}>{label}</Link>)}</nav>
    <section className="coming-soon" aria-labelledby="future-title"><span className="coming-label">COMING SOON</span><h2 id="future-title">準備ができたら、ここに。</h2><p>{feature === "matchup" && league === "MLB" ? "選手をまたいで対戦を探せる画面を準備中です。収録済みのDirect BvPは各選手の分析から利用できます。" : value.requirement}</p><p className="inline-note">現在、この機能のデータは表示していません。</p>
      {feature === "matchup" && league === "MLB" && <Link className="button button--secondary" to="/MLB/search">選手の対戦分析を見る</Link>}
      <Link className="button button--secondary" to={playerId ? `/${league}/players/${encodeURIComponent(playerId)}/analysis` : `/${league}/home`}>{playerId ? "現在使える分析を見る" : "ホームへ戻る"}</Link>
    </section></div>;
}
export function ExploreScreen({ league }: { league: League }) {
  const availability = usePostseasonAvailability();
  return <div className="screen"><PageHeading eyebrow={`${league} · EXPLORE`} title="野球をもっと知る" detail="試合、記録、選手の歩み。気になることから。" />
    <div className="explore-groups">{[
      { title: "試合を楽しむ", icon: CalendarDays, rows: [{ to: "schedule", label: "日程・結果", detail: league === "MLB" ? "収録済みの歴史を振り返る" : "保存済みの試合を振り返る", soon: false }, { to: "preseason", label: "オープン戦", detail: "公式戦とは別のシーズン前データ", soon: true }, { to: "watch", label: "WATCH", detail: "観戦のおともに", soon: true }] },
      { title: "記録を知る", icon: Trophy, rows: [{ to: "postseason", label: "Postseason", detail: league === "MLB" ? "勝ち上がり・シリーズ・選手成績" : "CS・日本シリーズの利用状況", soon: false }, { to: "records", label: "シーズン記録", detail: "成績と集計状態を確認", soon: false }, { to: "milestones", label: "達成記録", detail: league === "NPB" ? "保存済みシーズン成績の節目" : "シーズン・キャリアの節目", soon: league !== "NPB" }] },
      { title: "選手の歩み", icon: ArrowLeftRight, rows: [{ to: "moves", label: "選手移動・FA・Posting", detail: "所属と登録の変化をたどる", soon: true }, { to: "talent", label: "ドラフト・プロスペクト", detail: "次の世代を探す", soon: true }] },
      { title: "球団・選手を比べる", icon: ArrowLeftRight, rows: [{ to: "teams", label: "球団ページ", detail: league === "MLB" ? "収録年度の球団・出場選手" : "球団の成績・試合・保存済み選手", soon: false }, { to: "compare", label: "選手比較", detail: "同じ条件で2〜4選手を比較", soon: false }] },
      { title: "データを探す", icon: ScanLine, rows: [{ to: "data", label: "データ探索", detail: "保存済み成績を条件で絞り込む", soon: false }, { to: "history", label: "シーズン履歴", detail: "収録年と選手の年度別成績", soon: false }, { to: "glossary", label: "指標ガイド", detail: "計算式・サンプル・読み方", soon: false }] },
      { title: "対戦を深く見る", icon: ScanLine, rows: [{ to: "matchup", label: "MATCHUP", detail: "選手をまたいで対戦を探す", soon: true }] },
    ].map(group => <section className="surface-card" key={group.title}><h2 className="icon-heading"><group.icon size={19} aria-hidden="true" />{group.title}</h2><div className="explore-list">{group.rows.filter(row => row.to !== "postseason" || league !== "MLB" || hasHistoricalPostseason(availability)).map(row => <Link key={row.to} to={`/${league}/${row.to}`}><span><strong>{row.label}</strong><small>{row.detail}</small></span>{row.soon && <span className="soon-badge">Coming Soon</span>}<ChevronRight size={17} aria-hidden="true" /></Link>)}</div></section>)}</div>
    <p className="inline-note">キャリアや高度分析は、各選手ページから利用します。</p></div>;
}
export function PlayerFutureLinks({ base, historical = false }: { base: string; historical?: boolean }) {
  return <details className="future-player-tools"><summary><GraduationCap size={17} aria-hidden="true" />選手の歩み・これからの分析</summary><div className="explore-list">
    {!historical && <Link to={`${base}/career`}><span><strong>キャリア・過去シーズン</strong><small>年ごとの成績と収録期間合計</small></span><span className="soon-badge">Coming Soon</span></Link>}
    {!historical && <Link to={`${base}/advanced`}><span><strong>対戦・高度分析</strong><small>Direct BvPと状況別の成績</small></span><span className="soon-badge">Coming Soon</span></Link>}
    <Link to={`/${historical ? "MLB" : "NPB"}/milestones`}><span><strong>達成記録</strong><small>{historical ? "確認済み記録の節目をたどる" : "保存済みシーズン成績の節目"}</small></span>{historical && <span className="soon-badge">Coming Soon</span>}</Link>
  </div></details>;
}
