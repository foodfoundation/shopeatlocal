// transaction-search-results.js
// -----------------------------
// Transaction Search Results page controllers

import { PathQuery, NamesParamTransact, wTransacts, DataPage } from "../../Search.js";
import { CdsTypeTransact, CdsMethPay } from "../../Db.js";
import { DataWhenDateUTC, Fmt_RowExcel } from "../../Util.js";
import { CtResultSearchListPage } from "../../../Cfg.js";
import { CoopParams } from "../../Site.js";
// The module adds the 'csv' method to the response object prototype, so it must
// be required, though the export is not used:
import _gCSV from "../../CSV.js";

export async function wHandGet(aReq, aResp) {
  /** Returns a path that adds the specified page number to the current search
   *  query, or 'undefined', if aIdxPage is undefined. */
  function PathPage(aIdxPage) {
    return aIdxPage === undefined
      ? undefined
      : PathQuery("/transaction-search-results", aReq.query, NamesParamTransact, aIdxPage);
  }

  const oParams = DataWhenDateUTC(aReq.query);
  if (!oParams) {
    aResp.status(400);
    aResp.locals.Msg = "Invalid search parameter.";
    aResp.render("Misc/400");
    return;
  }

  const { Ct: oCt, Transacts: oTransacts } = await wTransacts(oParams);

  const oDataPage = DataPage(aReq.query, oCt, CtResultSearchListPage);

  aResp.locals.Title = `${CoopParams.CoopNameShort} transaction search results`;
  aResp.locals.SummsParam = SummsParam(aReq.query);
  aResp.locals.Transacts = oTransacts;
  aResp.locals.TextRg = oDataPage.Text;
  aResp.locals.PathPagePrev = PathPage(oDataPage.IdxPagePrev);
  aResp.locals.PathPageNext = PathPage(oDataPage.IdxPageNext);
  aResp.locals.CkPaging = aResp.locals.PathPagePrev || aResp.locals.PathPageNext;
  aResp.locals.PathExport = PathQuery("/transaction-search-export", aReq.query, NamesParamTransact);
  aResp.render("Cashier/transaction-search-results");
}

export async function wHandGetExport(aReq, aResp) {
  const oParams = DataWhenDateUTC(aReq.query);
  if (!oParams) {
    aResp.status(400);
    aResp.locals.Msg = "Invalid search parameter.";
    aResp.render("Misc/400");
    return;
  }

  const { Ct: _oCt, Transacts: oTransacts } = await wTransacts(oParams, true);

  for (const oTransact of oTransacts) {
    // It would be nice to have a way to control the column order without
    // changing the search query, and perhaps to improve the names.

    delete oTransact.zRank;
    delete oTransact.Name1FirstCreate;
    delete oTransact.Name1LastCreate;

    Fmt_RowExcel(oTransact);
  }

  aResp.attachment("Transaction search results.csv");
  aResp.csv(oTransacts, true);
}

/** Returns an array of label/value objects that describe the search parameters,
 *  exclusive of the page index. */
function SummsParam(aParams) {
  const oSumms = [];

  function oAdd(aName, aLbl, aCds) {
    const oParam = aParams[aName];
    if (oParam === undefined) return;

    if (aLbl === undefined) aLbl = aName;

    let oTextVal;
    if (aCds) oTextVal = aCds[oParam].Text;
    else oTextVal = oParam;

    oSumms.push({ Lbl: aLbl, Val: oTextVal });
  }

  oAdd("IDTransact", "Transaction ID:");
  oAdd("IDMemb", "Member ID:");
  oAdd("IDProducer", "Producer ID:");
  oAdd("CdTypeTransact", "Transaction type:", CdsTypeTransact);
  oAdd("CdMethPay", "Payment method:", CdsMethPay);
  oAdd("WhenStart", "Start date:");
  oAdd("WhenEnd", "End date:");

  return oSumms;
}
