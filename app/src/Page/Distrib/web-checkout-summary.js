// web-checkout-summary.js
// -----------------------
// Web Checkout Summary page controller

import { Conn } from "../../Db.js";
import { wPaymentAmtDefault, wPaymentSectionLocals } from "../../Square.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  const oIDInvc = parseInt(aReq.params.IDInvcShopWeb);
  const oInvc = await wInvcMembFromIDInvc(oIDInvc);
  if (!oInvc) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  aResp.locals.InvcMemb = oInvc;

  const oBal = oInvc.BalMoney + oInvc.BalEBT;
  aResp.locals.Pay = await wPaymentSectionLocals({
    IDMemb: oInvc.IDMemb,
    URL: `/web-checkout-summary/${oInvc.IDInvcShopWeb}`,
    Bal: oBal,
    AmtDefault: wPaymentAmtDefault({
      IDMemb: oInvc.IDMemb,
      Bal: oBal,
      AmtInvc: oInvc.Ttl,
    }),
  });

  aResp.locals.Title = `${CoopParams.CoopNameShort} web checkout summary`;
  aResp.render("Distrib/web-checkout-summary");
}

/** Prepares the payment context used by the shared Square checkout handlers,
 *  resolving the member from the invoice and linking payments to it. */
export async function wWarePayCtx(aReq, aResp, aNext) {
  const oIDInvc = parseInt(aReq.params.IDInvcShopWeb);
  const oInvc = await wInvcMembFromIDInvc(oIDInvc);
  if (!oInvc) {
    aResp.status(404).json({ error: "Invoice not found." });
    return;
  }
  aResp.locals.PayCtx = {
    IDMemb: oInvc.IDMemb,
    IDMembStaffCreate: aResp.locals.CredUser.IDMemb,
    IDInvc: oInvc.IDInvcShopWeb,
  };
  aNext();
}

async function wInvcMembFromIDInvc(aIDInvc) {
  const oSQL = `SELECT InvcShopWeb.*,
			Memb.IDMemb, Memb.NameBus, Memb.Name1First, Memb.Name1Last,
			Memb.Name2First, Memb.Name2Last, Memb.Addr1, Memb.Addr2,
			Memb.City, Memb.St, Memb.Zip, Memb.Phone1, Memb.Email1,
			Producer.IDProducer,
			IFNULL(zTransact.BalMoney, 0) AS BalMoney,
			IFNULL(zTransact.BalEBT, 0) AS BalEBT
		FROM InvcShopWeb
		JOIN Cart USING (IDCart)
		JOIN Memb USING (IDMemb)
		LEFT JOIN Producer USING (IDMemb)
		LEFT JOIN (
			SELECT Transact.IDMemb, SUM(AmtMoney) AS BalMoney, SUM(AmtEBT) AS BalEBT
			FROM Transact
			GROUP BY Transact.IDMemb
		) AS zTransact USING (IDMemb)
		WHERE IDInvcShopWeb = :IDInvc`;
  const oParams = {
    IDInvc: aIDInvc,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows.length === 1 ? oRows[0] : null;
}
