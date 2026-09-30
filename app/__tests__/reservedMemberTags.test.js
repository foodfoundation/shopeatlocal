import { FracFeeCoopShopMemb, TagFullCoopFee, TagNoCoopFee } from "../src/ReservedMemberTags.js";

describe("FracFeeCoopShopMemb", () => {
  const aFracFeeCoopShopSite = 0.15;
  const aMembershipTags = [{ tagId: 1, fracFeeCoopShop: 0.05 }];

  const Frac = (aTags, aTagIDs) =>
    FracFeeCoopShopMemb({ aTags, aTagIDs, aMembershipTags, aFracFeeCoopShopSite });

  it("returns zero for 'no coop fee'", () => {
    expect(Frac([TagNoCoopFee], [])).toBe(0);
  });

  it("returns the site fee for 'full coop fee', ignoring configured overrides", () => {
    expect(Frac([TagFullCoopFee], [1])).toBe(aFracFeeCoopShopSite);
  });

  it("gives 'no coop fee' precedence over 'full coop fee'", () => {
    expect(Frac([TagFullCoopFee, TagNoCoopFee], [1])).toBe(0);
  });

  it("matches reserved tags case-insensitively", () => {
    expect(Frac(["  No Coop Fee "], [])).toBe(0);
  });

  it("uses the configured MembershipTags override", () => {
    expect(Frac(["farmers friend"], [1])).toBe(0.05);
  });

  it("falls back to the site fee", () => {
    expect(Frac([], [])).toBe(aFracFeeCoopShopSite);
    expect(Frac(undefined, undefined)).toBe(aFracFeeCoopShopSite);
  });
});
