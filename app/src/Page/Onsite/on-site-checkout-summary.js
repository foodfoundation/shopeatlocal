// on-site-checkout-summary.js
// ---------------------------
// On-site Checkout Summary page controller

import { Conn } from "../../Db.js";
import { wPaymentAmtDefault, wPaymentSectionLocals } from "../../Square.js";
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

  const oBal = oInvc.IDMemb ? oInvc.BalMoney + oInvc.BalEBT : null;
  aResp.locals.Pay = await wPaymentSectionLocals({
    IDMemb: oInvc.IDMemb ?? null,
    URL: `/on-site-checkout-summary/${oInvc.IDInvcShopOnsite}`,
    Bal: oBal,
    AmtDefault: wPaymentAmtDefault({
      IDMemb: oInvc.IDMemb,
      Bal: oBal,
      AmtInvc: oInvc.Ttl,
    }),
  });

  aResp.locals.Title = `${CoopParams.CoopNameShort} on-site checkout summary`;
  aResp.render("Onsite/on-site-checkout-summary");
}

/** Prepares the payment context used by the shared Square checkout handlers.
 *  On-site invoices may have no member (non-member cart); auto charge is not
 *  offered in that case, but terminal and cash payments still work. */
export async function wWarePayCtx(aReq, aResp, aNext) {
  const oIDInvc = parseInt(aReq.params.IDInvcShopOnsite);
  const oInvc = await wInvcMembFromIDInvc(oIDInvc);
  if (!oInvc) {
    aResp.status(404).json({ error: "Invoice not found." });
    return;
  }
  aResp.locals.PayCtx = {
    IDMemb: oInvc.IDMemb ?? null,
    IDMembStaffCreate: aResp.locals.CredUser.IDMemb,
    IDInvc: oInvc.IDInvcShopOnsite,
  };
  aNext();
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
