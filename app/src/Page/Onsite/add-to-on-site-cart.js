// add-to-on-site-cart.js
// ----------------------
// Add to On-site Cart page controllers

import {
  Valid as _Valid,
  Unroll,
  wExec,
  Roll,
  ValsFromCollect,
  CkFail,
  Retry,
} from "../../Form.js";
import {
  wProductFromID,
  wProducerFromID,
  wCartOnsitePend,
  wCartOnsitePendOrCreate,
  wAdd_ItCartOnsitePend,
} from "../../Db.js";
import { TextIDVty, NameVty } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  // VtySel was added by wWareVtySel:
  aResp.locals.Product = await wProductFromID(aResp.locals.VtySel.IDProduct);
  aResp.locals.Producer = await wProducerFromID(aResp.locals.Product.IDProducer);

  if (aResp.locals.Qty === undefined) aResp.locals.Qty = 1;

  aResp.locals.CdCartType = aResp.locals.VtySel.CdVtyType ?? "Retail";
  aResp.locals.Title = aReq.t("common:pageTitles.addToOnSiteCart", { name: CoopParams.CoopNameShort });
  aResp.render("Onsite/add-to-on-site-cart");
}

export async function wHandPost(aReq, aResp) {
  const oVty = aResp.locals.VtySel;
  const oIsWholesaleVty = oVty.CdVtyType === "Wholesale";

  // Field-level validation
  // ----------------------

  const oFlds = {};

  if (oVty.CkPriceVar) {
    oFlds.WgtPer = {
      Collect: "Its",
    };
  } else {
    oFlds.Qty = {
      Valid: _Valid.Gen.QtyNonZero,
      CkRequire: true,
      Collect: false,
    };
  }

  const oFldsUnroll = Unroll(aReq.body, oFlds);
  await wExec(aReq.body, oFldsUnroll);
  const oFldsRoll = Roll(oFldsUnroll);

  // Extract weight entries
  // ----------------------

  // ValsFromCollect ignores empty collections, so we needn't check CkPriceVar:
  let {
    ValsRaw: oWgtsRaw,
    ValsCook: oWgtsCook,
    MsgFail: oMsgFailWgts,
  } = ValsFromCollect(oFldsRoll.Its, "WgtPer");

  // Empty inputs will have 'null' cooked values:
  oWgtsCook = oWgtsCook.filter(o => o !== null);

  if (oVty.CkPriceVar && !oWgtsCook.length) oMsgFailWgts = aReq.t("common:onSiteCart.mustEnterWeights");

  // Handle validation failure
  // -------------------------
  // It might be nice to reject weight values that are well outside the
  // expected range, but I don't think that is MVP.

  if (CkFail(oFldsUnroll) || oMsgFailWgts) {
    Retry(aResp, oFldsUnroll);

    if (oVty.CkPriceVar) {
      aResp.locals.WgtsFulf = oWgtsRaw;
      aResp.locals.MsgFailWgts = oMsgFailWgts;
    } else aResp.locals.Qty = oFlds.Qty.ValCook;

    wHandGet(aReq, aResp);
    return;
  }

  // Update cart items
  // -----------------
  // Use a transaction here? If the update fails, the quantity or one or more
  // weights will not be added. The user could fix that, but it might be easier
  // to start from scratch?

  const oIDSess = aReq.session.id;
  const oCart = await wCartOnsitePend(oIDSess);
  if (!!oCart) {
    if (oIsWholesaleVty && oCart.CdCartType !== "Wholesale") {
      aResp.Show_Flash("danger", null, aReq.t("common:onSiteCart.cannotMixWholesale"));
      aResp.redirect(303, "/on-site-catalog");
      return;
    }

    if (!oIsWholesaleVty && oCart.CdCartType === "Wholesale") {
      aResp.Show_Flash("danger", null, aReq.t("common:onSiteCart.cannotMixWholesale"));
      aResp.redirect(303, "/wholesale-catalog");
      return;
    }
  }
  const oCdCartType = oIsWholesaleVty ? "Wholesale" : "Retail";

  await wCartOnsitePendOrCreate(oIDSess, aReq.user.IDMemb, oCdCartType);

  if (oVty.CkPriceVar) {
    for (const oWgt of oWgtsCook) await wAdd_ItCartOnsitePend(oIDSess, oVty.IDVty, oWgt, 1);
  } else await wAdd_ItCartOnsitePend(oIDSess, oVty.IDVty, 0, oFlds.Qty.ValCook);

  aResp.Show_Flash("success", null, aReq.t("common:onSiteCart.addedToCart", {
    varietyId: TextIDVty(oVty.IDVty),
    varietyName: NameVty(oVty),
  }));

  aResp.redirect(303, "/on-site-cart");
}
