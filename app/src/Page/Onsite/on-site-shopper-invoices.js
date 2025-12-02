// on-site-shopper-invoices.js
// ---------------------------
// On-site Shopper Invoices page controllers

import { PathQuery, DataPage } from "../../Search.js";
import { Conn } from "../../Db.js";
import { Plural, Fmt_RowExcel } from "../../Util.js";
import { CtResultSearchListPage } from "../../../Cfg.js";
import { CoopParams } from "../../Site.js";
// The module adds the 'csv' method to the response object prototype, so it must
// be required, though the export is not used:
import _gCSV from "../../CSV.js";

export async function wHandGet(aReq, aResp) {
  // The paging functionality was borrowed from the transaction search. It would
  // be nice to encapsulate that system. [TO DO]

  /** Returns a path that adds the specified page number to the current search
   *  query, or 'undefined', if aIdxPage is undefined. */
  const oCDInvcType = aResp.locals.CdCartType || "Retail";
  const oPathPage =
    oCDInvcType === "Wholesale" ? "/wholesale-shopper-invoices" : "/on-site-shopper-invoices";
  const oPathExport =
    oCDInvcType === "Wholesale"
      ? "/wholesale-shopper-invoices-export"
      : "/on-site-shopper-invoices-export";
  function PathPage(aIdxPage) {
    return aIdxPage === undefined ? undefined : PathQuery(oPathPage, aReq.query, [], aIdxPage);
  }

  const { Ct: oCt, Invcs: oInvcs } = await wInvcs(
    {
      ...aReq.query,
      CdInvcType: oCDInvcType,
    },
    false,
  );

  const oNameEl = aCt => Plural(aCt, "invoice");
  const oDataPage = DataPage(aReq.query, oCt, CtResultSearchListPage, oNameEl);

  // Render page
  // -----------

  aResp.locals.Title = aReq.t("common:pageTitles.onSiteShopperInvoices", {
    name: CoopParams.CoopNameShort,
  });
  aResp.locals.Invcs = oInvcs;
  aResp.locals.TextRg = oDataPage.Text;
  aResp.locals.PathPagePrev = PathPage(oDataPage.IdxPagePrev);
  aResp.locals.PathPageNext = PathPage(oDataPage.IdxPageNext);
  aResp.locals.CkPaging = aResp.locals.PathPagePrev || aResp.locals.PathPageNext;
  aResp.locals.PathExport = PathQuery(oPathExport, aReq.query, []);

  aResp.render("Onsite/on-site-shopper-invoices");
}

export async function wHandGetExport(aReq, aResp) {
  const oCDInvcType = aResp.locals.CdCartType || "Retail";
  const { Invcs: oInvcs } = await wInvcs(
    {
      ...aReq.query,
      CdInvcType: oCDInvcType,
    },
    true,
  );

  for (const oInvc of oInvcs) {
    delete oInvc.NameFileInvc;
    delete oInvc.IDCartOnsite;

    Fmt_RowExcel(oInvc);
  }

  aResp.attachment(aReq.t("common:exportFilenames.onSiteShopperInvoices") + ".csv");
  aResp.csv(oInvcs, true);
}

async function wInvcs(aParams, aCkExport) {
  const oSQLCt = `SELECT COUNT(*) AS Ct FROM (
			SELECT InvcShopOnsite.*,
				CartOnsite.IDMembShop,
				Memb.Name1First, Memb.Name1Last
			FROM InvcShopOnsite
			JOIN CartOnsite USING (IDCartOnsite)
			LEFT JOIN Memb ON Memb.IDMemb = CartOnsite.IDMembShop
			WHERE CdInvcType = :CdInvcType
		) AS Sub`;

  let oSQLSel = `SELECT InvcShopOnsite.*,
			CartOnsite.IDCyc, CartOnsite.IDMembShop,
			Memb.Name1First, Memb.Name1Last
		FROM InvcShopOnsite
		JOIN CartOnsite USING (IDCartOnsite)
		LEFT JOIN Memb ON Memb.IDMemb = CartOnsite.IDMembShop
		WHERE CdInvcType = :CdInvcType
		ORDER BY InvcShopOnsite.WhenCreate DESC`;

  if (!aCkExport) {
    const oIdxStart = (aParams.IdxPage || 0) * CtResultSearchListPage;
    oSQLSel += `\nLIMIT ${oIdxStart}, ${CtResultSearchListPage}`;
  }

  const [oRowsCt] = await Conn.wExec(oSQLCt, aParams);
  if (oRowsCt.length < 1) throw Error("on-site-shopper-invoices wInvcs: Cannot get count");

  const [oRowsSel] = await Conn.wExec(oSQLSel, aParams);

  return {
    Ct: oRowsCt[0].Ct,
    Invcs: oRowsSel,
  };
}
