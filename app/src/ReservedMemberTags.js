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

/** Returns the shopper co-op fee fraction for a member. Precedence:
 *  'no coop fee', 'full coop fee', configured MembershipTags override, then
 *  the site default.
 *  @param {Object} aOpts
 *  @param {Array<string>} aOpts.aTags - Member tag names
 *  @param {Array<number>} aOpts.aTagIDs - Member tag IDs
 *  @param {Array<Object>} aOpts.aMembershipTags - Configured MembershipTags
 *  @param {number} aOpts.aFracFeeCoopShopSite - Site.FracFeeCoopShop
 */
export function FracFeeCoopShopMemb({ aTags, aTagIDs, aMembershipTags, aFracFeeCoopShopSite }) {
  const oTags = (aTags ?? []).map(NormalizeTag);
  if (oTags.includes(TagNoCoopFee)) return 0;
  if (oTags.includes(TagFullCoopFee)) return aFracFeeCoopShopSite;

  const oTagIDs = aTagIDs ?? [];
  const oConfigured = (aMembershipTags ?? []).find(
    oMemberTag => oTagIDs.includes(oMemberTag.tagId) && oMemberTag.fracFeeCoopShop != null,
  );
  return oConfigured ? oConfigured.fracFeeCoopShop : aFracFeeCoopShopSite;
}
