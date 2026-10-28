import { expect, it } from "vitest";
import { honorRecipientPath } from "../src/domain/honor-discovery";
import { portableRoute } from "../src/domain/product-sharing";
import { canonicalDeepLink, parentNativeRoute } from "../src/domain/native-navigation";
it("shares source-recipient links without inventing canonical player IDs or statistical years", () => {
  const path = honorRecipientPath("MLB", "lahman:bondsba01");
  expect(path).toBe("/MLB/awards?recipient=lahman%3Abondsba01");
  expect(canonicalDeepLink(`baseballnotes:/${path}`)).toBe(path);
  expect(portableRoute("/MLB/awards", "recipient=lahman:bondsba01&year=2004&secret=hidden")).toBe(`${path}&year=2004`);
  expect(parentNativeRoute(`${path}&year=2004`)).toBe(path);
  expect(parentNativeRoute(path)).toBe("/MLB/awards?view=players");
  expect(parentNativeRoute("/MLB/awards?view=players")).toBe("/MLB/records");
  for (const query of ["recipient=../raw", "recipient=npb:12345678", "recipient=lahman:bondsba01&view=years", "recipient=lahman:bondsba01&recipient=lahman:other01", "year=2026&view=players"]) expect(portableRoute("/MLB/awards", query)).toBeNull();
});
