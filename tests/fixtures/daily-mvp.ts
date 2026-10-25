import {npbGameDetailSchema} from "../../src/domain/npb-game-detail";
import {gameDateIndexSchema} from "../../src/domain/npb-game-index";
export function mvpFixture(){
 const teams=['npb:team:tigers','npb:team:baystars'];
 const bat=(side:number)=>({playerId:`00000000-0000-4000-8000-00000000000${side+1}`,name:`架空打者${side}`,teamId:teams[side],battingOrder:1,starter:true,pa:4,ab:4,runs:side?0:1,hits:side?0:3,doubles:0,triples:0,homeRuns:side?0:1,rbi:side?0:3,walks:0,hbp:0,sacrificeHits:0,sacrificeFlies:0,strikeouts:0,stolenBases:0,caughtStealing:0});
 const pitch=(side:number)=>({playerId:`00000000-0000-4000-8000-00000000000${side+3}`,name:`架空投手${side}`,teamId:teams[side],role:'starter',appearanceOrder:1,outsRecorded:side?17:18,bf:24,hits:3,homeRuns:1,strikeouts:4,runs:2,earnedRuns:2,pitchCount:90,walksAndHitByPitch:1,decision:'none'});
 const team=(side:number)=>({id:teams[side],name:'架空球団',shortName:'架空',score:side?2:3,totals:{pa:30,paSource:'battingFacts',ab:28,runs:side?2:3,hits:5,homeRuns:1}});
 const game=npbGameDetailSchema.parse({gameId:'npb:game:aaaaaaaaaaaaaaaaaaaa',date:'2026-09-25',gameNumber:1,status:'final',completeness:'complete',home:team(0),away:team(1),batting:{home:[bat(0)],away:[bat(1)]},pitching:{home:[pitch(0)],away:[pitch(1)]}});
 const index=gameDateIndexSchema.parse({schemaVersion:1,league:'NPB',date:game.date,generatedAt:'2026-09-26T00:00:00Z',coverage:'complete',games:[{...game,scheduledTime:null,home:{id:game.home.id,name:'架空',score:3},away:{id:game.away.id,name:'架空',score:2},battingAvailable:true,pitchingAvailable:true,detailAvailable:true,batting:undefined,pitching:undefined}] .map(({gameId,date,gameNumber,status,completeness,home,away,scheduledTime,battingAvailable,pitchingAvailable,detailAvailable})=>({gameId,date,gameNumber,status,completeness,home,away,scheduledTime,battingAvailable,pitchingAvailable,detailAvailable}))});
 return {game,index};
}
