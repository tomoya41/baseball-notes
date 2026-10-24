import { expect, it } from "vitest";
import { rosterCatalog, rosterSeason } from "./fixtures/npb-team-players";


import { currentTeamPlayers, historicalTeamPlayers, sortTeamPlayers, teamPlayerReturnPath, type TeamPlayer } from "../src/presentation/team-player-list";
import { historicalBattingKeys, npbHistoricalRowSchema } from "../src/domain/npb-historical";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const teamId = "npb:team:tigers";
it("uses dated exact canonical membership and keeps zero, partial and absent numbers distinct",()=>{
  const rows=currentTeamPlayers(rosterCatalog,rosterSeason,teamId);
  expect(rows.map(p=>p.number)).toEqual(["0","12",null]);
  expect(rows[0]?.battingGames).toBe(0);expect(rows.every(p=>p.partial)).toBe(true);
  expect(currentTeamPlayers(rosterCatalog,null,teamId)[0]?.battingGames).toBeNull();
  expect(()=>currentTeamPlayers(rosterCatalog,{...rosterSeason,effectiveDate:"2026-10-11"},teamId)).toThrow("dates differ");
  expect(currentTeamPlayers(rosterCatalog,rosterSeason,"npb:team:giants")).toEqual([]);
});

it("sorts games and integer pitching outs descending, and numbers numerically with unknowns last",()=>{
  const rows=currentTeamPlayers(rosterCatalog,rosterSeason,teamId);
  expect(sortTeamPlayers(rows,"batting","games").map(p=>p.id)).toEqual([id(3),id(2),id(1)]);
  expect(sortTeamPlayers(rows,"pitching","innings").map(p=>p.outs)).toEqual([32,31,0]);
  const numbered=[{...rows[0]!,number:"10"},{...rows[1]!,number:"2"},rows[2]!,{...rows[0]!,id:id(4),number:"00"}];
  expect(sortTeamPlayers(numbered,"all","number").map(p=>p.number)).toEqual(["00","2","10",null]);
  expect(rows.map(p=>p.id)).toEqual([id(1),id(2),id(3)]);
  const unknown:TeamPlayer={...rows[0]!,id:id(5),battingGames:null,outs:null,batting:false};
  expect(sortTeamPlayers([...rows,unknown],"all","innings").at(-1)?.outs).toBeNull();
  expect(sortTeamPlayers([...rows,unknown],"batting","games")).toHaveLength(3);
});

it("keeps past-year club rows separate from the latest roster and never lends a present number",()=>{
  const data={players:[{playerId:id(1),name:"過去の選手"}],rows:[
    {playerId:id(1),season:2025,teamId,role:"batting",metrics:{G:22}},
    {playerId:id(1),season:2025,teamId:"npb:team:giants",role:"batting",metrics:{G:33}},
    {playerId:id(1),season:2024,teamId,role:"batting",metrics:{G:44}},
  ].map(r=>npbHistoricalRowSchema.parse({...r,metrics:{...Object.fromEntries(historicalBattingKeys.map(k=>[k,null])),...r.metrics}}))};
  expect(historicalTeamPlayers(data,teamId,2025)).toEqual([{id:id(1),name:"過去の選手",number:null,numberDate:null,position:null,batting:true,pitching:false,battingGames:22,pitchingGames:null,outs:null,partial:false}]);
  expect(historicalTeamPlayers(data,teamId,2023)).toEqual([]);
});

it("preserves the team's year, role, sort and search on the profile return path without external redirects",()=>{
  expect(teamPlayerReturnPath({teamPlayers:{teamId,year:"2025",role:"pitching",sort:"innings",query:"山"}})).toBe("/NPB/teams/npb%3Ateam%3Atigers/players?season=2025&role=pitching&sort=innings&q=%E5%B1%B1");
  expect(teamPlayerReturnPath({teamPlayers:{teamId:"https://evil.test/"}})).toBeNull();expect(teamPlayerReturnPath(null)).toBeNull();
});
