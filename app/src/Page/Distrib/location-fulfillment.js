// location-fulfillment.js
// -----------------------
// Location Fulfillment page controllers

import { Locs, CoopParams } from "../../Site.js";
import { Conn } from "../../Db.js";
import { Struct } from "../../Util.js";

export async function wHandGet(aReq, aResp) {
  if (aResp.PhaseCycLess("StartDeliv")) {
    aResp.Show_Flash("danger", null, aReq.t("common:locationFulfillment.cannotFulfillDeliveryNotStarted"));

    aResp.redirect(303, "/distribution");
    return;
  }

  // Check for location
  // ------------------

  const oCdLoc = aReq.params.CdLoc;
  const oLoc = Locs[oCdLoc];
  if (!oLoc) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }
  aResp.locals.Loc = oLoc;

  // Render page
  // -----------

  aResp.locals.Stors = await wStors(oCdLoc);
  aResp.locals.Title = aReq.t("common:pageTitles.locationFulfillment", { name: CoopParams.CoopNameShort });
  aResp.render("Distrib/location-fulfillment");
}

async function wStors(aCdLoc) {
  const oSQL = `SELECT ItCart.NoteShop, SUM(ItCart.QtyDeliv) AS QtyDeliv,
			Memb.IDMemb, Memb.Name1First, Memb.Name1Last,
			Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.CkInvtMgd,
			Product.IDProduct, Product.NameProduct, Product.CdStor,
			Producer.IDProducer, Producer.NameBus
		FROM ItCart
		JOIN Cart USING (IDCart)
		LEFT JOIN Memb ON ((ItCart.NoteShop IS NOT NULL) AND (Memb.IDMemb = Cart.IDMemb))
		JOIN StApp USING (IDCyc)
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		JOIN Producer USING (IDProducer)
		WHERE Cart.CdLoc = :CdLoc
		GROUP BY Vty.IDVty, ItCart.NoteShop, Memb.IDMemb, Memb.Name1First,
			Memb.Name1Last
		HAVING (QtyDeliv IS NULL) OR (QtyDeliv > 0)
		ORDER BY Product.CdStor,
			Producer.NameBus, Producer.IDProducer,
			Product.NameProduct, Product.IDProduct,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty`;
  const oParams = {
    CdLoc: aCdLoc,
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
        "QtyDeliv",
        "IDMemb",
        "Name1First",
        "Name1Last",
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
