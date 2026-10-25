import type { NpbCsDataset } from '../domain/npb-cs-observations';
import type { NpbSeasonPayload } from '../application/npb-season-payload';

// Authored readings, not a leaderboard; photo availability is deliberately absent.
export const postseasonSubjects = [
  { playerId:'2b2a8d97-2a6e-441c-9a33-0d79d2a7d147', teamId:'npb:team:hawks', role:'batting', stage:'npb_cs_final', reading:'run_production', kind:'observed' },
  { playerId:'21a327b4-3924-422a-a1fc-d853e236a201', teamId:'npb:team:baystars', role:'pitching', stage:'npb_cs_first', reading:'long_start', kind:'observed' },
  { playerId:'852bed28-a3f1-4b60-8a1f-950cc2947686', teamId:'npb:team:baystars', role:'batting', stage:'npb_cs_first', reading:'power', kind:'outlook' },
  { playerId:'304e870e-71ba-4df7-8682-99ad852ee751', teamId:'npb:team:hawks', role:'pitching', stage:'npb_cs_final', reading:'strikeouts', kind:'outlook' },
] as const;
export type PostseasonSubject = typeof postseasonSubjects[number];
export type SpotlightKind = PostseasonSubject['kind'];
export type SpotlightScope = { teamIds:readonly string[]; gameIds?:readonly string[]; stage?:string };
export function spotlightEvidence(data:NpbCsDataset, subject:PostseasonSubject, scope:SpotlightScope) {
  if(!scope.teamIds.includes(subject.teamId)||scope.stage&&scope.stage!==subject.stage)return null;
  const player=data.players.find(p=>p.playerId===subject.playerId);
  const row=data.rows.find(r=>r.aggregate.playerId===subject.playerId&&r.aggregate.teamId===subject.teamId&&r.aggregate.role===subject.role&&r.aggregate.scope.stage===subject.stage);
  if(!player||!row||!data.observations||scope.gameIds&&row.gameIds.some(id=>!scope.gameIds!.includes(id)))return null;
  const games=data.games.filter(g=>row.gameIds.includes(g.id)).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const observations=data.observations.filter(o=>row.gameIds.includes(o.gameId)&&o.aggregate.playerId===subject.playerId&&o.aggregate.teamId===subject.teamId&&o.aggregate.role===subject.role&&o.aggregate.scope.stage===subject.stage);
  if(games.length!==row.gameIds.length||observations.length!==games.length||row.aggregate.metrics.G!==games.length)return null;
  const m=row.aggregate.metrics;
  if(subject.reading==='run_production'&&!(m.AB!=null&&m.AB>0&&m.H!=null&&m.RBI!=null&&m.RBI>=2&&games.length>=2))return null;
  if(subject.reading==='long_start'&&!(m.outsRecorded!=null&&m.outsRecorded>=18&&m.H!=null&&m.R!=null&&m.ER!=null&&m.SO!=null&&m.ER<=2))return null;
  return {player,row,games,metrics:m};
}
export type SpotlightEvidence=NonNullable<ReturnType<typeof spotlightEvidence>>;
export function spotlightRegular(data:NpbSeasonPayload, subject:PostseasonSubject) {
  if(data.season!==2026||data.period.from!=='2026-03-27'||['unavailable','unknown'].includes(data.coverage.status))return null;
  const player=data.players.find(p=>p.playerId===subject.playerId&&p.teamId===subject.teamId),stats=player?.[subject.role];
  if(!player||!stats)return null;
  const value=(key:string)=>{const m=stats.metrics[key];return m?.status==='complete'&&m.observedFacts===stats.factCount&&m.factCount===stats.factCount?m.value:null;};
  const G=value('G');if(G===null||G<=0||G!==stats.factCount)return null;
  const keys=subject.role==='batting'?['G','PA','H','HR','RBI','AVG','OPS']:['G','GS','outsRecorded','SO','ER','ERA'];
  const metrics=Object.fromEntries(keys.map(k=>[k,value(k)]));
  if(subject.reading==='power'&&!(metrics.PA!=null&&metrics.PA>=200&&metrics.HR!=null&&metrics.HR>=10&&metrics.RBI!=null))return null;
  if(subject.reading==='strikeouts'&&!(metrics.GS===0&&metrics.G!=null&&metrics.G>=20&&metrics.outsRecorded!=null&&metrics.outsRecorded>=60&&metrics.SO!=null&&metrics.SO*3>metrics.outsRecorded))return null;
  return {metrics,period:data.period,effectiveDate:data.effectiveDate,coverage:data.coverage.status};
}
export type SpotlightRegular=NonNullable<ReturnType<typeof spotlightRegular>>;
export const spotlightStatsUrl=(s:PostseasonSubject)=>`/NPB/players/${s.playerId}/seasons?season=2026&competition=postseason&stage=${s.stage}&role=${s.role}`;
export const spotlightRegularUrl=(s:PostseasonSubject)=>`/NPB/players/${s.playerId}/seasons?season=2026&competition=regular&role=${s.role}`;
export function spotlightStory(s:PostseasonSubject,cs:SpotlightEvidence,regular:SpotlightRegular|null){
  const m=cs.metrics,r=regular?.metrics;
  switch(s.reading){
    case 'run_production':return {title:'打率だけでは見えない、得点への働き',text:`収録${m.G}試合で${m.AB}打数${m.H}安打、${m.RBI}打点。安打数と打点を並べて、その働きを読みたい。`,caution:'少ない打数の結果。次の打席でも続くとは限らない。'};
    case 'long_start':return {title:'長く投げて、失点を抑える',text:`収録${m.G}登板で${m.H}被安打、${m.R}失点・${m.ER}自責点。投球回と失点を合わせて、その登板を振り返る。`,caution:`収録${m.G}登板から今後の安定感までは断定しない。`};
    case 'power':return r?{title:'長打が試合を動かすか',text:`公式戦の収録${r.G}試合・${r.PA}打席で${r.HR}本塁打、${r.RBI}打点。CSの収録分と見比べ、出場するなら長打に注目したい。`,caution:'独自の注目。出場・打順・次戦の活躍は未確認。'}:null;
    case 'strikeouts':return r?{title:'登板があれば、三振を奪う力に注目',text:`公式戦の収録${r.G}登板で${r.SO}奪三振。短い登板でアウトを取る力に注目したい。${m.ER===null?"CSの自責点は未収録部分があり、無失点とは判断しない。":`CS収録分の自責点は${m.ER}。少ない登板での比較には注意したい。`}`,caution:'独自の注目。登板予定・起用場面は未確認。'}:null;
  }
}
