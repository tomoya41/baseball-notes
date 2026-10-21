import {it,expect} from "vitest";
import {assertImmutableReleaseTag,assertReleasePredecessor} from "../src/data/immutable-release-tag";
const asset=(tag:string)=>({assetUrl:`https://github.com/example/repo/releases/download/${tag}/data.json.gz`,bodySha256:"a".repeat(64),sha256:"b".repeat(64)});
it("protects current and retained tags against either changed body or changed compressed bytes",()=>{
  for(const tag of ["current-v2","retained-v1"]){const known=[asset("retained-v1"),asset("current-v2")];expect(()=>assertImmutableReleaseTag(tag,"c".repeat(64),"b".repeat(64),known)).toThrow("reserved");expect(()=>assertImmutableReleaseTag(tag,"a".repeat(64),"c".repeat(64),known)).toThrow("reserved");}
});
it("allows a new immutable version and deterministic byte-identical replay",()=>{
  const known=[asset("retained-v1"),asset("current-v2")];expect(()=>assertImmutableReleaseTag("new-v3","c".repeat(64),"d".repeat(64),known)).not.toThrow();expect(()=>assertImmutableReleaseTag("retained-v1","a".repeat(64),"b".repeat(64),known)).not.toThrow();
});
it("requires a verified active predecessor for every changed tagged publication, including schedule-only proposals",()=>{
  expect(()=>assertReleasePredecessor("new-v3","changed","active",false)).toThrow("previous snapshot");
  expect(()=>assertReleasePredecessor("new-v3","changed","active",true)).not.toThrow();expect(()=>assertReleasePredecessor("replay","active","active",false)).not.toThrow();
  expect(()=>assertReleasePredecessor(undefined,"private candidate","active",false)).not.toThrow();
});
