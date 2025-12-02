/** Transaction Management Controllers
 *  @module AddTransact
 *  @requires Form
 *  @requires Db
 *  @requires Site
 *  @description Controllers for member and producer transaction management.
 *  Transaction type determined by IDProducerSel or IDMembSel parameter.
 */

import { wExec, CkFail, Retry, wIns } from "../../Form.js";
import { wTransactFromID, wProducerFromID, wMembFromID } from "../../Db.js";
import { CoopParams } from "../../Site.js";

/** GET handler for transaction form
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @returns {Promise<void>} Renders transaction form view
 */
export async function wHandGet(aReq, aResp) {
  let reverse = aReq.query.reverse;
  let amt = aReq.query.amt;
  let method = aReq.query.method;
  let type = aReq.query.type;
  let typeText = "";
  let transId = aReq.query.id;

  switch (type) {
    case "RefundFeeMembInit":
      typeText = aReq.t("common:transactions.refund");
      break;
    case "PayRecv":
      typeText = aReq.t("common:transactions.paymentReceipt");
      break;
    case "PaySent":
      typeText = aReq.t("common:transactions.paymentDisbursement");
      break;
    case "Adj":
      typeText = aReq.t("common:transactions.adjustment");
      break;
  }

  if (reverse) {
    var transaction = await wTransactFromID(transId);
    aResp.locals.AmtReverse = amt;
    aResp.locals.CdMethPay = method;
    aResp.locals.CdTypeTransactVal = type;
    aResp.locals.CdTypeTransactText = typeText;
    aResp.locals.TransactionNote = transaction.Note;
  }

  if (aReq.params.IDProducerSel) {
    const oIDProducerSel = aResp.locals.CredSel.IDProducer;
    aResp.locals.Producer = await wProducerFromID(oIDProducerSel);
    aResp.locals.Memb = await wMembFromID(aResp.locals.Producer.IDMemb);
    aResp.locals.URLPost = "/add-producer-transaction/" + oIDProducerSel;
    if (reverse) {
      aResp.locals.URLPost = aResp.locals.URLPost + "?reverse=yes";
    }
    aResp.locals.Title = aReq.t("common:pageTitles.addProducerTransaction", { name: CoopParams.CoopNameShort });

    if (!aResp.locals.CdTypeTransact) aResp.locals.CdTypeTransact = "PaySent";
  }
  // Set Memb if Add Member Transaction is being displayed:
  else {
    const oIDMembSel = aResp.locals.CredSel.IDMemb;
    aResp.locals.Memb = await wMembFromID(oIDMembSel);
    aResp.locals.URLPost = "/add-member-transaction/" + oIDMembSel;
    if (reverse) {
      aResp.locals.URLPost = aResp.locals.URLPost + "?reverse=yes";
    }
    aResp.locals.Title = aReq.t("common:pageTitles.addMemberTransaction", { name: CoopParams.CoopNameShort });

    if (!aResp.locals.CdTypeTransact) aResp.locals.CdTypeTransact = "PayRecv";
  }

  // Emily prefers not to enter this every time:
  if (!aResp.locals.AmtEBT) aResp.locals.AmtEBT = 0;
  aResp.render("Cashier/AddTransact");
}

/** POST handler for transaction submission
 *  @param {Request} aReq - Express request
 *  @param {Response} aResp - Express response
 *  @returns {Promise<void>} Processes transaction and redirects
 */
export async function wHandPost(aReq, aResp) {
  // Field-level validation
  // ----------------------

  const oFlds = {
    CdTypeTransact: { CkRequire: true },
    CdMethPay: { CkRequire: true },
    AmtMoney: { CkRequire: true },
    AmtEBT: { CkRequire: true },
    Note: { Valid: false },
  };

  await wExec(aReq.body, oFlds);

  // Form-level validation
  // ---------------------
  // Deleting unwanted field specifications causes values entered in those
  // fields (before they were disabled) to be lost when the form is redisplayed
  // after a validation failure. I find that slightly annoying, but I guess it
  // is semantically correct, and there's no easy way to fix it.

  if (oFlds.CdTypeTransact.ValCook === "RefundFeeMembInit") {
    delete oFlds.CdMethPay;
    delete oFlds.AmtEBT;
  } else if (oFlds.CdTypeTransact.ValCook === "Adj") {
    delete oFlds.CdMethPay;

    if (oFlds.AmtMoney.ValCook === 0.0 && oFlds.AmtEBT.ValCook === 0.0)
      oFlds.AmtMoney.MsgFail = aReq.t("common:transactions.mustEnterNonZeroAmount");
  } else {
    switch (oFlds.CdMethPay.ValCook) {
      case "EBTElec":
      case "EBTVouch":
        delete oFlds.AmtMoney;

        if (oFlds.AmtEBT.ValCook <= 0.0)
          oFlds.AmtEBT.MsgFail = aReq.t("common:transactions.mustEnterPositiveAmount");
        break;

      case "Cash":
      case "Check":
      case "Credit":
      case "Debit":
      case "PayPal":
      case "GiftCert":
      case "Coupon":
        delete oFlds.AmtEBT;

        if (oFlds.AmtMoney.ValCook <= 0.0 && !aReq.query.reverse)
          //don't allow negatives unless it's a reversal
          oFlds.AmtMoney.MsgFail = aReq.t("common:transactions.mustEnterPositiveAmount");
        break;
    }
  }

  // Handle validation failure
  // -------------------------

  if (CkFail(oFlds)) {
    Retry(aResp, oFlds);

    wHandGet(aReq, aResp);
    return;
  }

  // Create transaction record
  // -------------------------

  // Not safe to do this until we are done with validation:
  if (
    oFlds.CdTypeTransact.ValCook === "PayRecv" ||
    oFlds.CdTypeTransact.ValCook === "RefundFeeMembInit"
  ) {
    if (oFlds.AmtMoney) oFlds.AmtMoney.ValCook *= -1;
    if (oFlds.AmtEBT) oFlds.AmtEBT.ValCook *= -1;
  }

  if (!aResp.locals.CredSel) throw Error("AddTransact wHandPost: No member or producer selected");

  const oIDMemb = aResp.locals.CredSel.IDMemb;

  let oIDProducer;
  if (aReq.params.IDProducerSel) {
    oIDProducer = aResp.locals.CredSel.IDProducer;
    if (!oIDProducer) throw Error("AddTransact wHandPost: Selected member is not a producer");
  } else oIDProducer = null;

  const oIDMembUser = aResp.locals.CredUser.IDMemb;
  if (!oIDMembUser) throw Error("AddTransact wHandPost: Cannot get user ID");

  const oParamsEx = {
    IDMemb: oIDMemb,
    IDProducer: oIDProducer,
    IDMembStaffCreate: oIDMembUser,
  };

  const oIDTransact = await wIns("Transact", oFlds, oParamsEx);
  if (!oIDTransact) throw Error("AddTransact wHandPost: Could not create transaction record");

  // Go to Transaction Detail
  // ------------------------

  const oPage = `/transaction-detail/${oIDTransact}`;
  aResp.redirect(303, oPage);
}
