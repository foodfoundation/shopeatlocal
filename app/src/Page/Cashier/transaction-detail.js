// transaction-detail.js
// ------------------
// Transaction detail page controllers

import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  const oTransact = { ...aResp.locals.TransactSel };

  const oIDMemb = aResp.locals.CredSelImperUser.IDMemb;
  if (!aReq.user.CkStaff() && oTransact.IDMemb !== oIDMemb) {
    aResp.status(403);
    aResp.render("Misc/403");
    return;
  }

  aResp.locals.Transact = oTransact;
  aResp.locals.Title = aReq.t("common:pageTitles.transactionDetail", { name: CoopParams.CoopNameShort });
  aResp.render("Cashier/transaction-detail");
}
