import type { NpbDirectoryPlayer } from "../domain/npb-player-directory";
import { formatDate } from "../presentation/formatters";

const hand = { right: "右", left: "左", switch: "両" } as const;

export function NpbPlayerProfileFacts({ player }: { player: NpbDirectoryPlayer }) {
  const facts = [
    player.throws || player.bats ? `${player.throws ? `${hand[player.throws]}投` : ""}${player.throws && player.bats ? " / " : ""}${player.bats ? `${hand[player.bats]}打` : ""}` : null,
    player.birthDate ? `生年月日 ${formatDate(player.birthDate)}` : null,
    player.birthPlace ? `出身 ${player.birthPlace}` : null,
  ].filter((item): item is string => !!item);
  return facts.length ? <div className="profile-facts npb-profile-facts" aria-label="基本プロフィール">
    {facts.map((fact) => <span key={fact}>{fact}</span>)}
  </div> : null;
}
