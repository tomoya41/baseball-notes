import type { DraftEvent } from "../domain/npb-draft-event";
import { draftForecastAdmission, draftEligibilityReview } from "../domain/npb-draft-eligibility";

export function DraftEligibilityCorrection() {
  const date = new Intl.DateTimeFormat("ja-JP", {month:"numeric", day:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Tokyo"}).format(new Date(draftEligibilityReview.checkedAt));
  return <details><summary>訂正：志望届を照合しました</summary>
    <p>山田凜虎・石田雄星・福島陽奈汰など、NPB対象者名簿に掲載のない選手を予想へ含めていました。確認不足を訂正し、対象から外しています。{date}（日本時間）に高校・大学の公式名簿を照合しました。</p>
    <p>提出を確認できた学生だけを予想に表示します。社会人・独立リーグは学生と制度が異なり、志望届の未提出とは判断しません。今回、指名対象の確認を終えていないため予想は保留します。過去の保存案は訂正表示を付けて残し、保留した案の答え合わせは行いません。</p>
    <p><a href="https://www.jhbf.or.jp/pro-aspiring/2026.html">日本高野連：2026年NPBドラフト対象者</a> · <a href="https://www.jubf.net/system/prog/procandidate.php?kind=all&year=2026">全日本大学野球連盟：2026年NPBドラフト対象者</a></p>
  </details>;
}

export function DraftHeldPrediction({candidate,group,round}:{candidate:DraftEvent["candidates"][number];group:string|undefined;round:number}) {
  const review=draftForecastAdmission(candidate,group);
  return <article className="player-row"><div className="player-row__body"><small>{round}位 · {review.status==="not_listed"?"対象外":"確認待ち"}</small><strong>予想を保留</strong>
    <details><summary>訂正理由・以前の保存案</summary><p>{candidate.name} · {candidate.affiliation}</p><p>{review.note}</p>{review.url&&<a href={review.url}>照合した公式名簿</a>}<p>以前の案は記録として保持します。現在の予想・答え合わせには使いません。</p></details>
  </div></article>;
}
