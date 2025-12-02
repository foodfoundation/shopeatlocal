// order-fulfillment.js
// --------------------
// Order Fulfillment page controllers

import { Locs, CoopParams } from "../../Site.js";
import { wCartFromIDMemb, wMembFromID, Conn } from "../../Db.js";
import { PageAfterCheckoutShop, Struct } from "../../Util.js";

export async function wHandGet(aReq, aResp) {
  // Check pickup window
  // -------------------

  if (!aResp.locals.FlagPickup) {
    const oMsg = aResp.PhaseCycLess("StartPickup")
      ? aReq.t("common:fulfillment.cannotFulfillPickupNotStarted")
      : aReq.t("common:fulfillment.cannotFulfillPickupClosed");
    aResp.Show_Flash("danger", null, oMsg);

    const oPage = PageAfterCheckoutShop(aReq, aResp);
    aResp.redirect(303, oPage);
    return;
  }

  // Check for cart
  // --------------

  const oIDMemb = aResp.locals.CredSelImperUser.IDMemb;
  const oCart = await wCartFromIDMemb(oIDMemb);
  if (!oCart) {
    aResp.locals.Msg = aReq.t("common:fulfillment.noCartForMember");
    aResp.status(400);
    aResp.render("Misc/400");
    return;
  }

  // Render page
  // -----------

  // Why not use CredSelImperUser?:
  aResp.locals.Memb = await wMembFromID(oIDMemb);
  aResp.locals.Cart = oCart;
  aResp.locals.Loc = Locs[oCart.CdLoc];
  aResp.locals.Stors = await wStors(oIDMemb);

  aResp.locals.Title = aReq.t("common:pageTitles.orderFulfillment", { name: CoopParams.CoopNameShort });
  aResp.render("Distrib/order-fulfillment");
}

async function wStors(aIDMemb) {
  const oSQL = `SELECT ItCart.IDItCart, ItCart.QtyDeliv, ItCart.NoteShop,
			Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.CkInvtMgd,
			Product.IDProduct, Product.NameProduct, Product.CdStor,
			Producer.IDProducer, Producer.NameBus
		FROM ItCart
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		JOIN Producer USING (IDProducer)
		WHERE ItCart.QtyDeliv > 0
			AND Cart.IDMemb = :IDMemb
		ORDER BY Product.CdStor,
			Producer.NameBus, Producer.IDProducer,
			Product.NameProduct, Product.IDProduct,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty`;
  const oParams = {
    IDMemb: aIDMemb,
  };
  const [oIts] = await Conn.wExecPrep(oSQL, oParams);

  // Structure items
  // ---------------

  const oSpecs = [
    {
      Props: ["CdStor"],
      NameKey: "CdStor",
      NameChild: "Its",
    },
    {
      Props: [
        "IDProducer",
        "NameBus",
        "IDItCart",
        "QtyDeliv",
        "NoteShop",
        "IDProduct",
        "NameProduct",
        "IDVty",
        "Kind",
        "Size",
        "WgtMin",
        "WgtMax",
        "CkInvtMgd",
      ],
    },
  ];
  return Struct(oIts, oSpecs);
}
