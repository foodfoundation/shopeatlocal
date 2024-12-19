// Producer-search-results.js
// ------------------------
// Producer Search Results page controllers

import { PathQuery, NamesParamProducer, wProducers, DataPage } from "../../Search.js";
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
      : PathQuery("/producer-search-results", aReq.query, NamesParamProducer, aIdxPage);
  }

  const { Ct: oCt, Producers: oProducers } = await wProducers(aReq.query);
  const oDataPage = DataPage(aReq.query, oCt, CtResultSearchListPage);

  aResp.locals.Title = `${CoopParams.CoopNameShort} producer search results`;
  aResp.locals.SummsParam = SummsParam(aReq.query);
  aResp.locals.Producers = oProducers;
  aResp.locals.TextRg = oDataPage.Text;
  aResp.locals.PathPagePrev = PathPage(oDataPage.IdxPagePrev);
  aResp.locals.PathPageNext = PathPage(oDataPage.IdxPageNext);
  aResp.locals.CkPaging = aResp.locals.PathPagePrev || aResp.locals.PathPageNext;
  aResp.locals.PathExport = PathQuery("/producer-search-export", aReq.query, NamesParamProducer);
  aResp.render("ProducerAdmin/producer-search-results");
}

export async function wHandGetExport(aReq, aResp) {
  const { Ct: _oCt, Producers: oProducers } = await wProducers(aReq.query, true);

  for (const o of oProducers) {
    delete o.NameImgProducer;
    delete o.WhenEdit;
    delete o.zRank;

    Fmt_RowExcel(o);
  }

  aResp.attachment("Producer search results.csv");
  aResp.csv(oProducers, true);
}

/** Returns an array of label/value objects that describe the search parameters,
 *  exclusive of the page index. */
function SummsParam(aParams) {
  const oSumms = [];

  function oAdd(aName, aLbl) {
    const oParam = aParams[aName];
    if (oParam === undefined) return;

    if (aLbl === undefined) aLbl = aName;

    oSumms.push({ Lbl: aLbl, Val: oParam });
  }

  oAdd("IDProducer", "Producer ID:");
  oAdd("CdProducer", "Producer code:");
  oAdd("NameBus", "Business name:");
  oAdd("NameFirst", "First name:");
  oAdd("NameLast", "Last name:");

  if (aParams.CkPendProducer) oSumms.push({ Lbl: "Pending registration" });
  if (aParams.CkList) oSumms.push({ Lbl: "Listed" });
  if (aParams.CkWithSale) oSumms.push({ Lbl: "With sales this cycle" });

  return oSumms;
}
