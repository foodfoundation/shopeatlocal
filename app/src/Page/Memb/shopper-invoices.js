// shopper-invoices.js
// -------------------
// Shopper Invoices page controllers

import { wMembFromID, Conn } from "../../Db.js";
import { CompWhenDesc } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  const oIDMemb = aResp.locals.CredSelImperUser.IDMemb;
  aResp.locals.Memb = await wMembFromID(oIDMemb);
  aResp.locals.Invcs = await wInvcs(oIDMemb);

  // Render page
  // -----------

  aResp.locals.Title = aReq.t("common:pageTitles.shopperInvoices", { name: CoopParams.CoopNameShort });
  aResp.render("Memb/shopper-invoices");
}

async function wInvcs(aIDMemb) {
  const oSQLWeb = `SELECT InvcShopWeb.*,
			InvcShopWeb.WhenUpd AS zWhen
		FROM InvcShopWeb
		JOIN Cart USING (IDCart)
		WHERE Cart.IDMemb = :IDMemb
		ORDER BY zWhen DESC`;

  const oSQLOnsite = `SELECT InvcShopOnsite.*,
			InvcShopOnsite.WhenCreate AS zWhen
		FROM InvcShopOnsite
		JOIN CartOnsite USING (IDCartOnsite)
		WHERE CartOnsite.IDMembShop = :IDMemb
		ORDER BY zWhen DESC`;

  const oParams = {
    IDMemb: aIDMemb,
  };
  const [oRowsWeb] = await Conn.wExecPrep(oSQLWeb, oParams);
  const [oRowsOnsite] = await Conn.wExecPrep(oSQLOnsite, oParams);
  const oRows = oRowsWeb.concat(oRowsOnsite);

  const oComp = (aL, aR) => CompWhenDesc(aL, aR, "zWhen");
  oRows.sort(oComp);

  return oRows;
}
