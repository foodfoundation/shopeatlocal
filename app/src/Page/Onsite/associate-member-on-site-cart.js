// associate-member-on-site-cart.js
// --------------------------------
// Associate Member with On-site Cart page controller

import {
  wMembFromID,
  wCartOnsitePend,
  wCartOnsitePendOrCreate,
  wAssoc_MembOnsitePend,
  wItsCartOnsitePend,
} from "../../Db.js";

/** Associates the 'viewed' member with the pending on-site cart, or removes the
 *  associated member, if IDMembView is not set. Sets the non-member EBT flag in
 *  the cart if the CkEBTNonMemb query parameter is one. */
export async function wHandGet(aReq, aResp) {
  const oCkEBTNonMemb = aReq.query.CkEBTNonMemb || false;
  let oMembShop = null;

  const oIDMembShop = aReq.params.IDMembView || null;
  if (oIDMembShop) {
    oMembShop = await wMembFromID(oIDMembShop);
    if (!oMembShop) {
      aResp.status(404);
      aResp.render("Misc/404");
      return;
    }
  }

  const oIDSess = aReq.session.id;
  const cart = await wCartOnsitePend(oIDSess);
  if (
    !!cart &&
    !!oMembShop &&
    cart.CdCartType === "Wholesale" &&
    oMembShop.CdRegWholesale !== "Approv"
  ) {
    const oMsg = "Only approved wholesale members can be associated with a wholesale cart.";
    aResp.Show_Flash("danger", null, oMsg);
    aResp.redirect(303, "/on-site-checkout");
    return;
  }
  await wCartOnsitePendOrCreate(oIDSess, aReq.user.IDMemb);
  await wAssoc_MembOnsitePend(oIDSess, oIDMembShop, oCkEBTNonMemb);

  const oIts = await wItsCartOnsitePend(aReq.session.id);
  const oPage = oIts.length ? "/on-site-checkout" : "/on-site-cart";
  aResp.redirect(303, oPage);
}
