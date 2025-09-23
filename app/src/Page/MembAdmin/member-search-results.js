// member-search-results.js
// ------------------------
// Member Search Results page controllers

import { PathQuery, NamesParamMemb, wMembs, DataPage } from "../../Search.js";
import { Fmt_RowExcel } from "../../Util.js";
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
      : PathQuery("/member-search-results", aReq.query, NamesParamMemb, aIdxPage);
  }

  const { Ct: oCt, Membs: oMembs } = await wMembs(aReq.query);
  const oDataPage = DataPage(aReq.query, oCt, CtResultSearchListPage);

  aResp.locals.Title = `${CoopParams.CoopNameShort} member search results`;
  aResp.locals.SummsParam = SummsParam(aReq.query);
  aResp.locals.Membs = oMembs;
  aResp.locals.TextRg = oDataPage.Text;
  aResp.locals.PathPagePrev = PathPage(oDataPage.IdxPagePrev);
  aResp.locals.PathPageNext = PathPage(oDataPage.IdxPageNext);
  aResp.locals.CkPaging = aResp.locals.PathPagePrev || aResp.locals.PathPageNext;
  aResp.locals.PathExport = PathQuery("/member-search-export", aReq.query, NamesParamMemb);
  aResp.render("MembAdmin/member-search-results");
}

export async function wHandGetExport(aReq, aResp) {
  const { Ct: _oCt, Membs: oMembs } = await wMembs(aReq.query, true);
  for (const o of oMembs) {
    delete o.HashPass;
    delete o.HashPassLeg;
    delete o.zRank;

    Fmt_RowExcel(o);
  }

  aResp.attachment("Member search results.csv");
  aResp.csv(oMembs, true);
}

/** Returns an array of label/value objects that describe the search parameters,
 *  exclusive of the page index. */
function SummsParam(aParams) {
  const oSumms = [];

  function oAdd(aName, aLbl) {
    const oParam = aParams[aName];
    if (oParam === undefined) return;

    if (aLbl === undefined) aLbl = aName + ":";

    oSumms.push({ Lbl: aLbl, Val: oParam });
  }

  oAdd("IDMemb", "Member ID:");
  oAdd("NameBus", "Business name:");
  oAdd("NameFirst", "First name:");
  oAdd("NameLast", "Last name:");
  oAdd("City");
  oAdd("St", "State:");
  oAdd("Zip");

  if (aParams.CkTrialMemb) oSumms.push({ Lbl: "Current trial members" });
  if (aParams.CkPendMemb) oSumms.push({ Lbl: "Trial completed and pending" });
  if (aParams.CkPendEBT) oSumms.push({ Lbl: "Pending EBT registration" });
  if (aParams.CkPendVolun) oSumms.push({ Lbl: "Pending volunteer registration" });
  if (aParams.CkWithItsCart) oSumms.push({ Lbl: "With items in cart" });
  if (aParams.CkDelivHomeNoDist) oSumms.push({ Lbl: "Home delivery without distance" });
  if (aParams.CkBalPos) oSumms.push({ Lbl: "With positive balance" });
  if (aParams.CkBalNeg) oSumms.push({ Lbl: "With negative balance" });
  if (aParams.CkEBT) oSumms.push({ Lbl: "Approved for EBT" });
  if (aParams.CkProducer) oSumms.push({ Lbl: "Registered as producer" });
  if (aParams.CkStaff) oSumms.push({ Lbl: "Staff" });
  if (aParams.MemberTagID) oSumms.push({ Lbl: `Member tag: ${aParams.MemberTagName}` });

  return oSumms;
}
