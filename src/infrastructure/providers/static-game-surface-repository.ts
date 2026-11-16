import { publicDataFetch, rememberPublicResponse } from "../public-response-cache";
import { gameDateIndexSchema,gameManifestSchema,recentGamesSchema } from "../../domain/npb-game-index";
import { recordsSchema } from "../../domain/npb-records";
export class StaticGameSurfaceRepository {
  constructor(private readonly baseUrl:string,private readonly request:typeof fetch=publicDataFetch){}
  private async read(path:string){const r=await this.request(`${this.baseUrl.replace(/\/?$/,"/")}data/npb/${path}`,{cache:"no-cache"});
    if(!r.ok)throw Error(`Game surface HTTP ${r.status}`);return { value: await r.json() as unknown, response: r };}
  async manifest(){const r=await this.read("games/manifest.json");const p=gameManifestSchema.parse(r.value);await rememberPublicResponse(r.response);return p;}
  async date(date: string, expectedGeneratedAt?: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error("Invalid Game date");
    const { value, response } = await this.read(`games/dates/${date}.json`);
    const day = gameDateIndexSchema.parse(value);
    if (day.date !== date) throw Error("Game date mismatch");
    if (expectedGeneratedAt !== undefined && day.generatedAt !== expectedGeneratedAt)
      throw Error("Game date publication generation differs");
    await rememberPublicResponse(response);
    return day;
  }
  async recent(){const r=await this.read("games/recent.json");const p=recentGamesSchema.parse(r.value);await rememberPublicResponse(r.response);return p;}
  async records(){const r=await this.read("records/2026/latest.json");const p=recordsSchema.parse(r.value);await rememberPublicResponse(r.response);return p;}
}
