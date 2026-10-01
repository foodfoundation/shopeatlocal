// ReservedMemberTags.js
// =====================
// Member tags with built-in behavior. They must exist in the MemberTags table
// with exactly these names, and they have no public display heading.

export const TagKeepAnonymous = "keep anonymous";
export const TagNoCoopFee = "no coop fee";
export const TagFullCoopFee = "full coop fee";

export const ReservedMemberTags = [TagKeepAnonymous, TagNoCoopFee, TagFullCoopFee];

export function NormalizeTag(aTag) {
  return String(aTag ?? "")
    .trim()
    .toLowerCase();
}

/** Resolves the shopper co-op fee fraction and whether a reserved fee tag set
 *  it. Reserved fee tags also take precedence over wholesale fees. Precedence:
 *  'no coop fee', 'full coop fee', configured MembershipTags override, then
 *  the site default.
 *  @param {Object} aOpts
 *  @param {Array<string>} aOpts.aTags - Member tag names
 *  @param {Array<number>} aOpts.aTagIDs - Member tag IDs
 *  @param {Array<Object>} aOpts.aMembershipTags - Configured MembershipTags
 *  @param {number} aOpts.aFracFeeCoopShopSite - Site.FracFeeCoopShop
 */
export function ResolveFeeCoopShopMemb({ aTags, aTagIDs, aMembershipTags, aFracFeeCoopShopSite }) {
  const oTags = (aTags ?? []).map(NormalizeTag);
  if (oTags.includes(TagNoCoopFee)) {
    return { fracFeeCoopShop: 0, hasReservedFeeTag: true };
  }
  if (oTags.includes(TagFullCoopFee)) {
    return { fracFeeCoopShop: aFracFeeCoopShopSite, hasReservedFeeTag: true };
  }

  const oTagIDs = aTagIDs ?? [];
  const oConfigured = (aMembershipTags ?? []).find(
    oMemberTag => oTagIDs.includes(oMemberTag.tagId) && oMemberTag.fracFeeCoopShop != null,
  );
  return {
    fracFeeCoopShop: oConfigured ? oConfigured.fracFeeCoopShop : aFracFeeCoopShopSite,
    hasReservedFeeTag: false,
  };
}

/** Returns only the resolved shopper co-op fee fraction. */
export function FracFeeCoopShopMemb(aOpts) {
  return ResolveFeeCoopShopMemb(aOpts).fracFeeCoopShop;
}
