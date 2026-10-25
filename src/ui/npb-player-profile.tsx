import { formatThrowBat } from "../presentation/baseball-language";
import type { NpbDirectoryPlayer } from "../domain/npb-player-directory";
import { formatDate } from "../presentation/formatters";



export function NpbPlayerProfileFacts({ player }: { player: NpbDirectoryPlayer }) {
  const facts = [
    player.throws || player.bats ? `投打 ${formatThrowBat(player.throws, player.bats)}` : null,
    player.birthDate ? `生年月日 ${formatDate(player.birthDate)}` : null,
    player.birthPlace ? `出身 ${player.birthPlace}` : null,
  ].filter((item): item is string => !!item);
  return facts.length ? <div className="profile-facts npb-profile-facts" aria-label="基本プロフィール">
    {facts.map((fact) => <span key={fact}>{fact}</span>)}
  </div> : null;
}
