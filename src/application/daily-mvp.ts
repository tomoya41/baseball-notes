import {PublicResponseStore} from '../infrastructure/public-response-cache';
import {npbGameDetailSchema,type NpbGameDetail} from '../domain/npb-game-detail';
/** Cache-only. This feature must not turn browsing a date into extra Turso queries. */
export async function readCachedMvpGames(ids:readonly string[],current?:NpbGameDetail):Promise<NpbGameDetail[]>{
 if(ids.length>12||new Set(ids).size!==ids.length)throw Error('Invalid day Game set');
 const store=new PublicResponseStore(),base=import.meta.env.VITE_NPB_PLAYER_API_BASE_URL?.trim()||'https://baseball-notes-recent.vercel.app/';
 return (await Promise.all(ids.map(async id=>{
  if(current?.gameId===id)return current;
  const url=new URL('api/npb/game-detail',base.endsWith('/')?base:`${base}/`);url.searchParams.set('gameId',id);
  const cached=await store.get(url.href).catch(()=>undefined);if(!cached)return null;
  try{const game=npbGameDetailSchema.parse(JSON.parse(new TextDecoder().decode(cached.body)));return game.gameId===id?game:null;}catch{return null;}
 }))).filter((g):g is NpbGameDetail=>g!==null);
}
