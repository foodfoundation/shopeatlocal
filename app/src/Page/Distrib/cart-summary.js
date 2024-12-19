// cart-summary.js
// ---------------
// Cart Summary page controllers

import { Conn } from "../../Db.js";
import { Struct, Add_CkExcludeConsumerFee, TtlsCart } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  // Structure by member
  // -------------------

  const oMembsIts = await wMembsIts();
  const oSpecs = [
    {
      NameKey: "IDMemb",
      Props: [
        "IDMemb",
        "Name1First",
        "Name1Last",
        "Phone1",
        "Email1",
        "DistDeliv",
        "CdRegEBT",
        "IDCart",
        "CdLoc",
        "NameLoc",
      ],
      NameChild: "Its",
    },
    {
      Props: [
        "IDProduct",
        "NameProduct",
        "IDVty",
        "Size",
        "Kind",
        "WgtMin",
        "WgtMax",
        "PriceNomWeb",
        "CkPriceVar",
        "CkTaxSale",
        "CkEBT",
        "QtyOrd",
        "QtyProm",
        "QtyWithdr",
      ],
    },
  ];
  aResp.locals.Membs = Struct(oMembsIts, oSpecs);

  for (const oMemb of aResp.locals.Membs) {
    oMemb.QtyOrd = 0;
    oMemb.QtyProm = 0;
    oMemb.QtyWithdr = 0;

    const oCkEligEBT = oMemb.CdRegEBT === "Approv";
    const oCkWholesale = oMemb.CdRegWholesale === "Approv";
    oMemb.Its = await Add_CkExcludeConsumerFee(oMemb.Its);
    oMemb.Cart = TtlsCart(
      oMemb.Its,
      "QtyProm",
      "PriceNomWeb",
      oCkEligEBT,
      oMemb.CdLoc,
      oMemb.DistDeliv,
      oCkWholesale,
    );
    // To avoid confusion later. TtlsCart copies the items into its result:
    delete oMemb.Its;

    oMemb.QtyOrd += oMemb.Cart.QtyOrd;
    oMemb.QtyProm += oMemb.Cart.QtyProm;
    oMemb.QtyWithdr += oMemb.Cart.QtyWithdr;
  }

  // Render page
  // -----------

  aResp.locals.Title = `${CoopParams.CoopNameShort} cart summary`;
  aResp.render("Distrib/cart-summary");
}

async function wMembsIts() {
  const oSQL = `SELECT ItCart.QtyOrd, ItCart.QtyProm, ItCart.QtyWithdr,
			Vty.IDVty, Vty.Size, Vty.Kind, Vty.WgtMin, Vty.WgtMax, Vty.PriceNomWeb, Vty.CdVtyType,
			IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
			Product.IDProduct, Product.NameProduct,
			Subcat.CkTaxSale, Subcat.CkEBT,
			Cart.IDCart,
			Memb.IDMemb, Memb.Name1First, Memb.Name1Last, Memb.Phone1, Memb.Email1,
			Memb.DistDeliv, Memb.CdRegEBT,
			Loc.CdLoc, Loc.NameLoc,
			IFNULL(FeeCoopVty.FracFeeCoopWholesaleMemb, (SELECT FracFeeCoopWholesaleMemb FROM Site)) AS FracFeeCoopWholesaleMemb
		FROM ItCart
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		JOIN Subcat USING (IDSubcat)
		JOIN Cart USING (IDCart)
		JOIN Memb USING (IDMemb)
		JOIN Loc USING (CdLoc)
		JOIN StApp USING (IDCyc)
		LEFT JOIN FeeCoopVty USING (IDVty)
		ORDER BY Memb.Name1Last, Memb.Name1First, Memb.IDMemb,
			Product.NameProduct, Product.IDProduct,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  return oRows;
}
