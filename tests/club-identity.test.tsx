import { renderToStaticMarkup } from "react-dom/server";
import { describe,expect,it } from "vitest";
import { ClubIdentity } from "../src/ui/club-identity";
import { clubStyle } from "../src/presentation/club-style";
import { ScoreHero,ScoreboardRow } from "../src/ui/design-system";
import { MemoryRouter } from "react-router-dom";
describe("app-owned club identification",()=>{
  it("assigns only presentation color from the explicit ID, never from a name",()=>{
    expect(clubStyle("npb:team:giants")).toEqual(clubStyle("npb:team:giants"));
    expect(clubStyle(undefined)).toEqual({});
    expect(renderToStaticMarkup(<ClubIdentity>巨人</ClubIdentity>)).not.toContain('club-identity--known');
    expect(renderToStaticMarkup(<ClubIdentity teamId="npb:team:giants">読売ジャイアンツ</ClubIdentity>)).toContain('読売ジャイアンツ');
  });
  it("keeps null versus zero, visitor/home and full team names when logos are unavailable",()=>{
    const props={away:"長いビジター球団名",home:"長いホーム球団名",awayId:"a",homeId:"b",awayScore:0,homeScore:null,status:"未確認"};
    const row=renderToStaticMarkup(<MemoryRouter><ScoreboardRow {...props} to="/NPB/games/known" /></MemoryRouter>);
    expect(row).toContain('長いビジター球団名 0');expect(row).toContain('長いホーム球団名 得点未確認');
    expect(row).toContain('>—</strong>');expect(row).not.toContain('scoreboard-winner');
    expect(renderToStaticMarkup(<ScoreHero {...props} />)).not.toContain('<img');
  });
});
