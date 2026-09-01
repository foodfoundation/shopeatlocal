import { wMembFromID } from "../../Db.js";
import { wPaymentAmtDefault, wPaymentSectionLocals } from "../../Square.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  const oIDMemb = aResp.locals.CredSel.IDMemb;
  const oMemb = await wMembFromID(oIDMemb);
  const oBal = oMemb.BalMoney + oMemb.BalEBT;

  aResp.locals.Memb = oMemb;
  aResp.locals.Pay = await wPaymentSectionLocals({
    IDMemb: oIDMemb,
    URL: `/member-payment/${oIDMemb}`,
    Bal: oBal,
    AmtDefault: wPaymentAmtDefault({ IDMemb: oIDMemb, Bal: oBal }),
  });

  aResp.locals.Title = `${CoopParams.CoopNameShort} member payment`;
  aResp.render("Cashier/member-payment");
}

/** Prepares the payment context used by the shared Square checkout handlers. On
 *  this page the paying member is the selected member and the payment is not
 *  linked to a particular invoice. */
export function wWarePayCtx(aReq, aResp, aNext) {
  aResp.locals.PayCtx = {
    IDMemb: aResp.locals.CredSel.IDMemb,
    IDMembStaffCreate: aResp.locals.CredUser.IDMemb,
    IDInvc: null,
  };
  aNext();
}
