import { mkdtemp, readFile, writeFile, mkdir, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { expect, it } from "vitest";
import { stageNpbAiInputs } from "../scripts/stage-npb-ai-inputs";

it("prepares a cold filesystem and satisfies the CS → series → Japan snapshot dependency",async()=>{
  const base=resolve(tmpdir()),root=await mkdtemp(join(base,"baseball-ai-stage-")),cache=join(root,"archive"),output=join(root,"output");
  try {
    await stageNpbAiInputs(output,cache,{
      cs:async p=>{await access(cache);await mkdir(p,{recursive:true});await writeFile(join(p,"cs.json"),'["reviewed-cs-fixture"]');},
      series:async p=>{const cs=JSON.parse(await readFile(join(p,"cs.json"),"utf8"));await writeFile(join(p,"series.json"),JSON.stringify([...cs,"series-fixture"]));},
      japan:async p=>{const series=JSON.parse(await readFile(join(p,"series.json"),"utf8"));await writeFile(join(p,"japan.json"),JSON.stringify([...series,"japan-fixture"]));},
    });
    expect(JSON.parse(await readFile(join(output,"japan.json"),"utf8"))).toEqual(["reviewed-cs-fixture","series-fixture","japan-fixture"]);
  } finally {
    if(!resolve(root).startsWith(base+sep))throw Error("Unexpected temporary staging path");
    await rm(root,{recursive:true,force:true});
  }
});
