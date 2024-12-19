// managed-catalog.js
// ------------------
// Managed Catalog page controllers
//
// This page is mostly identical to the On-site Catalog. I am separating them
// because that is likely to change.

import { Conn } from "../../Db.js";
import { Fmt_RowExcel, Struct } from "../../Util.js";
import { CoopParams } from "../../Site.js";
// The module adds the 'csv' method to the response object prototype, so it must
// be required, though the export is not used:
import _gCSV from "../../CSV.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Stors = await wStors();

  aResp.locals.Title = `${CoopParams.CoopNameShort} managed catalog`;
  aResp.render("Onsite/managed-catalog");
}

export async function wHandGetExport(aReq, aResp) {
  const oVtys = await wVtys();

  for (const oVty of oVtys) Fmt_RowExcel(oVty);

  aResp.attachment("Managed varieties.csv");
  aResp.csv(oVtys, true);
}

async function wVtys() {
  const oSQL = `SELECT Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax,
			Vty.CkListWeb, Vty.CkListOnsite, Vty.QtyOffer, Vty.PriceNomWeb,
			IFNULL(zItCartVty.QtyProm, 0) AS QtyProm,
			Product.IDProduct, Product.NameProduct, Product.CdStor,
			Producer.IDProducer, Producer.NameBus
		FROM Vty
		JOIN Product USING (IDProduct)
		JOIN Producer USING (IDProducer)
		LEFT JOIN (
			SELECT Vty.IDVty, SUM(ItCart.QtyProm) AS QtyProm
			FROM Vty
			JOIN ItCart USING (IDVty)
			JOIN Cart USING (IDCart)
			JOIN StApp ON (StApp.IDCycPrep = Cart.IDCyc)
			GROUP BY Vty.IDVty
		) AS zItCartVty USING (IDVty)
		WHERE Vty.CkInvtMgd IS TRUE
			AND (Vty.CkListWeb OR Vty.CkListOnsite)
			AND (Vty.CdVtyType = 'Retail')
		ORDER BY Product.CdStor,
			Producer.NameBus, Producer.IDProducer,
			Product.NameProduct, Product.IDProduct,
			Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty`;
  const [oVtys] = await Conn.wExecPrep(oSQL);
  return oVtys;
}

async function wStors() {
  const oVtys = await wVtys();
  const oSpecs = [
    {
      NameKey: "CdStor",
      Props: ["CdStor"],
      NameChild: "Vtys",
    },
    {
      Props: [
        "IDProducer",
        "NameBus",
        "IDProduct",
        "NameProduct",
        "IDVty",
        "Kind",
        "Size",
        "WgtMin",
        "WgtMax",
        "CkListWeb",
        "CkListOnsite",
        "QtyOffer",
        "PriceNomWeb",
        "QtyProm",
      ],
    },
  ];
  return Struct(oVtys, oSpecs);
}
