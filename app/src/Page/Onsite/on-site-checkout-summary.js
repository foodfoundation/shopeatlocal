// on-site-checkout-summary.js
// ---------------------------
// On-site Checkout Summary page controller

import { Conn } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  const oIDInvc = parseInt(aReq.params.IDInvcShopOnsite);
  const oInvc = await wInvcMembFromIDInvc(oIDInvc);
  if (!oInvc) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  aResp.locals.InvcMemb = oInvc;

  aResp.locals.Title = aReq.t("common:pageTitles.onSiteCheckoutSummary", {
    name: CoopParams.CoopNameShort,
  });
  aResp.render("Onsite/on-site-checkout-summary");
}

async function wInvcMembFromIDInvc(aIDInvc) {
  const oSQL = `SELECT InvcShopOnsite.*,
			Memb.IDMemb, Memb.NameBus, Memb.Name1First, Memb.Name1Last,
			Memb.Name2First, Memb.Name2Last, Memb.Addr1, Memb.Addr2,
			Memb.City, Memb.St, Memb.Zip, Memb.Phone1, Memb.Email1,
			Producer.IDProducer,
			IFNULL(zTransact.BalMoney, 0) AS BalMoney,
			IFNULL(zTransact.BalEBT, 0) AS BalEBT
		FROM InvcShopOnsite
		JOIN CartOnsite USING (IDCartOnsite)
		LEFT JOIN Memb ON (Memb.IDMemb = CartOnsite.IDMembShop)
		LEFT JOIN Producer USING (IDMemb)
		LEFT JOIN (
			SELECT Transact.IDMemb, SUM(AmtMoney) AS BalMoney, SUM(AmtEBT) AS BalEBT
			FROM Transact
			GROUP BY Transact.IDMemb
		) AS zTransact USING (IDMemb)
		WHERE IDInvcShopOnsite = :IDInvc`;
  const oParams = {
    IDInvc: aIDInvc,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows.length === 1 ? oRows[0] : null;
}
