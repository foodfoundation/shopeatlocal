// shelving-prep.js
// ----------------
// Shelving Prep page controllers

import { Conn } from "../../Db.js";
import { Struct } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  if (aResp.PhaseCycLess("EndShop")) {
    const oMsg =
      "<strong>Cannot prepare shelves!</strong> The shopping window " + "has not closed.";
    aResp.Show_Flash("danger", null, oMsg);

    aResp.redirect(303, "/distribution");
    return;
  }

  // Structure by storage code, producer, and product
  // ------------------------------------------------

  const oProducts = await wIts();

  const oSpecs = [
    {
      Props: ["CdStor"],
      NameKey: "CdStor",
      NameChild: "Producers",
    },
    {
      Props: ["IDProducer", "NameBus"],
      NameKey: "IDProducer",
      NameChild: "Products",
    },
    {
      Props: ["IDProduct", "NameProduct"],
      NameKey: "IDProduct",
      NameChild: "Vtys",
    },
    {
      Props: ["IDVty", "Kind", "Size", "WgtMin", "WgtMax", "CkInvtMgd", "QtyProm"],
    },
  ];
  aResp.locals.Stors = Struct(oProducts, oSpecs);

  for (const oStor of aResp.locals.Stors) {
    oStor.QtyProm = 0;
    for (const oProducer of oStor.Producers) {
      oProducer.QtyProm = 0;
      for (const oProduct of oProducer.Products) {
        oProduct.QtyProm = 0;
        for (const oVty of oProduct.Vtys) oProduct.QtyProm += oVty.QtyProm;
        oProducer.QtyProm += oProduct.QtyProm;
      }
      oStor.QtyProm += oProducer.QtyProm;
    }
  }

  // Render page
  // -----------

  aResp.locals.Title = `${CoopParams.CoopNameShort} shelving prep`;
  aResp.render("Distrib/shelving-prep");
}

async function wIts() {
  const oSQL = `SELECT SUM(ItCart.QtyProm) AS QtyProm,
			Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.CkInvtMgd,
			Product.CdStor, Product.IDProduct, Product.NameProduct,
			Producer.IDProducer, Producer.NameBus
		FROM ItCart
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		JOIN Producer USING (IDProducer)
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		WHERE (ItCart.QtyProm > 0)
		GROUP BY Vty.IDVty
		ORDER BY Product.CdStor,
			Producer.NameBus, Producer.IDProducer,
			Product.NameProduct, Product.IDProduct,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  return oRows;
}
