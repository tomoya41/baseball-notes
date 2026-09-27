import { gameDateIndexSchema,gameManifestSchema,recentGamesSchema } from "../../domain/npb-game-index";
import { recordsSchema } from "../../domain/npb-records";
export class StaticGameSurfaceRepository {
  constructor(private readonly baseUrl:string,private readonly request:typeof fetch=(u,i)=>fetch(u,i)){}
  private async read(path:string){const r=await this.request(`${this.baseUrl.replace(/\/?$/,"/")}data/npb/${path}`,{cache:"no-cache"});
    if(!r.ok)throw Error(`Game surface HTTP ${r.status}`);return r.json() as Promise<unknown>;}
  async manifest(){return gameManifestSchema.parse(await this.read("games/manifest.json"));}
  async date(date:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error("Invalid Game date");
    const p=gameDateIndexSchema.parse(await this.read(`games/dates/${date}.json`));if(p.date!==date)throw Error("Game date mismatch");return p;}
  async recent(){return recentGamesSchema.parse(await this.read("games/recent.json"));}
  async records(){return recordsSchema.parse(await this.read("records/2026/latest.json"));}
}
