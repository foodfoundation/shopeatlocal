// cart-detail.js
// --------------
// Cart Detail page controllers

import { Conn } from "../../Db.js";
import { Struct, Add_CkExcludeConsumerFee, TtlsCart } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  const oIDCart = parseInt(aReq.params.IDCart);
  if (!oIDCart) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  // Structure by member
  // -------------------

  const oMembsIts = await wMembIts(oIDCart);
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
        "CdLoc",
        "NameLoc",
        "WhenStartPickup",
        "TagIDs",
        "Tags",
      ],
      NameChild: "Its",
    },
    {
      Props: [
        "IDProduct",
        "NameProduct",
        "IDVty",
        "Kind",
        "Size",
        "WgtMin",
        "WgtMax",
        "PriceNomWeb",
        "CkPriceVar",
        "CkTaxSale",
        "CkEBT",
        "NoteShop",
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
      oMemb.TagIDs,
    );
    // To avoid confusion later. TtlsCart copies the items into its result:
    delete oMemb.Its;

    oMemb.QtyOrd += oMemb.Cart.QtyOrd;
    oMemb.QtyProm += oMemb.Cart.QtyProm;
    oMemb.QtyWithdr += oMemb.Cart.QtyWithdr;
  }

  // Render page
  // -----------

  aResp.locals.Title = `${CoopParams.CoopNameShort} cart detail`;
  aResp.render("Distrib/cart-detail");
}

async function wMembIts(aIDCart) {
  const oSQL = `SELECT ItCart.NoteShop,
			ItCart.QtyOrd, ItCart.QtyProm, ItCart.QtyWithdr,
			Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.PriceNomWeb, Vty.CdVtyType,
			IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
			Product.IDProduct, Product.NameProduct,
			Subcat.CkTaxSale, Subcat.CkEBT,
			Memb.IDMemb, Memb.Name1First, Memb.Name1Last, Memb.Phone1, Memb.Email1,
			Memb.DistDeliv, Memb.CdRegEBT,
			Loc.CdLoc, Loc.NameLoc,
			Cyc.WhenStartPickup,
			IFNULL(FeeCoopVty.FracFeeCoopWholesaleMemb, (SELECT FracFeeCoopWholesaleMemb FROM Site)) AS FracFeeCoopWholesaleMemb,
      IFNULL(zMembTags.TagIDs, CAST('[]' AS JSON)) AS TagIDs,
		  IFNULL(zMembTags.Tags, CAST('[]' AS JSON)) AS Tags
		FROM ItCart
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		JOIN Subcat USING (IDSubcat)
		JOIN Cart USING (IDCart)
		JOIN Memb USING (IDMemb)
		JOIN Loc USING (CdLoc)
		JOIN Cyc USING (IDCyc)
		LEFT JOIN FeeCoopVty USING (IDVty)
    LEFT JOIN (
            SELECT
                MTA.IDMemb,
				CAST(CONCAT('[', GROUP_CONCAT(DISTINCT MTA.IDMemberTag ORDER BY MTA.IDMemberTag SEPARATOR ','), ']') AS JSON) AS TagIDs,
				CAST(CONCAT('[', GROUP_CONCAT(DISTINCT JSON_QUOTE(MT.Tag) ORDER BY MT.Tag SEPARATOR ','), ']') AS JSON) AS Tags
            FROM MemberTagAssignments AS MTA
            LEFT JOIN MemberTags AS MT ON (MT.IDMemberTag = MTA.IDMemberTag)
            GROUP BY MTA.IDMemb
    ) AS zMembTags ON (zMembTags.IDMemb = Memb.IDMemb)
		WHERE Cart.IDCart = :IDCart
		ORDER BY Memb.Name1Last, Memb.Name1First, Memb.IDMemb,
			Product.NameProduct, Product.IDProduct,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty`;
  const oParams = {
    IDCart: aIDCart,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}
