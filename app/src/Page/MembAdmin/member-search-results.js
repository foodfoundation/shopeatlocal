// member-search-results.js
// ------------------------
// Member Search Results page controllers

import { PathQuery, NamesParamMemb, wMembs, DataPage } from "../../Search.js";
import { Fmt_RowExcel } from "../../Util.js";
import { CtResultSearchListPage } from "../../../Cfg.js";
import { CoopParams } from "../../Site.js";
import { queryAllMemberTagAssignments } from "../../Db.js";
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
  const oMemberTagAssignments = await queryAllMemberTagAssignments(aReq.query);

  const membersWithTagAssignments = oMembs.map(oMemb => ({
    ...oMemb,
    MemberTagAssignments: oMemberTagAssignments.filter(o => o.IDMemb === oMemb.IDMemb),
  }));

  aResp.locals.Title = aReq.t("common:pageTitles.memberSearchResults", { name: CoopParams.CoopNameShort });
  aResp.locals.SummsParam = SummsParam(aReq.query, aReq.t);
  aResp.locals.Membs = membersWithTagAssignments;
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
function SummsParam(aParams, t) {
  const oSumms = [];

  function oAdd(aName, aLbl) {
    const oParam = aParams[aName];
    if (oParam === undefined) return;

    if (aLbl === undefined) aLbl = aName + ":";

    oSumms.push({ Lbl: aLbl, Val: oParam });
  }

  oAdd("IDMemb", t("common:memberSearchLabels.memberId"));
  oAdd("NameBus", t("common:memberSearchLabels.businessName"));
  oAdd("NameFirst", t("common:memberSearchLabels.firstName"));
  oAdd("NameLast", t("common:memberSearchLabels.lastName"));
  oAdd("City", t("common:memberSearchLabels.city"));
  oAdd("St", t("common:memberSearchLabels.state"));
  oAdd("Zip", t("common:memberSearchLabels.zip"));

  if (aParams.CkTrialMemb) oSumms.push({ Lbl: t("common:memberSearchLabels.currentTrialMembers") });
  if (aParams.CkPendMemb) oSumms.push({ Lbl: t("common:memberSearchLabels.trialCompletedPending") });
  if (aParams.CkPendEBT) oSumms.push({ Lbl: t("common:memberSearchLabels.pendingEBTRegistration") });
  if (aParams.CkPendVolun) oSumms.push({ Lbl: t("common:memberSearchLabels.pendingVolunteerRegistration") });
  if (aParams.CkWithItsCart) oSumms.push({ Lbl: t("common:memberSearchLabels.withItemsInCart") });
  if (aParams.CkDelivHomeNoDist) oSumms.push({ Lbl: t("common:memberSearchLabels.homeDeliveryWithoutDistance") });
  if (aParams.CkBalPos) oSumms.push({ Lbl: t("common:memberSearchLabels.withPositiveBalance") });
  if (aParams.CkBalNeg) oSumms.push({ Lbl: t("common:memberSearchLabels.withNegativeBalance") });
  if (aParams.CkEBT) oSumms.push({ Lbl: t("common:memberSearchLabels.approvedForEBT") });
  if (aParams.CkProducer) oSumms.push({ Lbl: t("common:memberSearchLabels.registeredAsProducer") });
  if (aParams.CkStaff) oSumms.push({ Lbl: t("common:memberSearchLabels.staff") });
  if (aParams.MemberTagID) oSumms.push({ Lbl: `${t("common:memberSearchLabels.memberTag")} ${aParams.MemberTagName}` });

  return oSumms;
}
