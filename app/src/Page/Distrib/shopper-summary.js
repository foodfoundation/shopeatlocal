// shopper-summary.js
// ------------------
// Shopper Summary page controllers

import { Conn } from "../../Db.js";
import { Struct, Add_CkExcludeConsumerFee, TtlsCart } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  // It would be nice to allow this to be displayed early, with some kind of
  // warning telling the user the data is incomplete, but the report uses
  // delivered quantities, which aren't set at all the relevant producers have
  // checked-in:
  if (aResp.PhaseCycLess("EndDeliv")) {
    aResp.Show_Flash("danger", null, aReq.t("common:shopperSummary.cannotViewDeliveryNotClosed"));

    aResp.redirect(303, "/distribution");
    return;
  }

  // Structure by location
  // ---------------------

  const oLocsMembsIts = await wLocsMembsIts();
  // The items won't be listed in the view, but they will be used to calculate
  // cart totals:
  const oSpecs = [
    {
      NameKey: "CdLoc",
      Props: ["CdLoc", "NameLoc"],
      NameChild: "Membs",
    },
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
        "TagIDs",
        "Tags",
      ],
      NameChild: "Its",
    },
    {
      Props: [
        "QtyDeliv",
        "WgtMin",
        "WgtMax",
        "PriceNomWeb",
        "CkPriceVar",
        "CkTaxSale",
        "CkEBT",
        "IDProduct",
      ],
    },
  ];
  aResp.locals.Locs = Struct(oLocsMembsIts, oSpecs);

  for (const oLoc of aResp.locals.Locs) {
    oLoc.QtyDeliv = 0;
    for (const oMemb of oLoc.Membs) {
      const oCkEligEBT = oMemb.CdRegEBT === "Approv";
      const oCkWohlesale = oMemb.CdRegWholesale === "Approv";
      oMemb.Its = await Add_CkExcludeConsumerFee(oMemb.Its);
      oMemb.Cart = TtlsCart(
        oMemb.Its,
        "QtyDeliv",
        "PriceNomWeb",
        oCkEligEBT,
        oLoc.CdLoc,
        oMemb.DistDeliv,
        oCkWohlesale,
        oMemb.TagIDs,
      );
      // To avoid confusion later. TtlsCart copies the items into its result:
      delete oMemb.Its;

      oLoc.QtyDeliv += oMemb.Cart.QtyDeliv;
    }
  }

  // Render page
  // -----------

  aResp.locals.Title = aReq.t("common:pageTitles.shopperSummary", { name: CoopParams.CoopNameShort });
  aResp.render("Distrib/shopper-summary");
}

async function wLocsMembsIts() {
  const oSQL = `SELECT IDProduct, ItCart.QtyOrd, ItCart.QtyProm, ItCart.QtyDeliv,
			Vty.WgtMin, Vty.WgtMax, Vty.PriceNomWeb, Vty.CdVtyType,
			IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
			Subcat.CkTaxSale, Subcat.CkEBT,
			Memb.IDMemb, Memb.Name1First, Memb.Name1Last, Memb.Phone1, Memb.Email1,
			Memb.DistDeliv, Memb.CdRegEBT,
			Loc.CdLoc, Loc.NameLoc,
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
		JOIN StApp USING (IDCyc)
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
		WHERE (ItCart.QtyDeliv > 0)
		ORDER BY Loc.CdLoc, Memb.IDMemb`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  return oRows;
}
