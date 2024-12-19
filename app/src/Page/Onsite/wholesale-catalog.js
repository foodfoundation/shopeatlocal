// wholesale-catalog.js
// ------------------
// On-site Catalog page controllers

import { Conn } from "../../Db.js";
import { Fmt_RowExcel, Struct } from "../../Util.js";
import { CoopParams } from "../../Site.js";
// The module adds the 'csv' method to the response object prototype, so it must
// be required, though the export is not used:
import _gCSV from "../../CSV.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Stors = await wStors();

  aResp.locals.Title = `${CoopParams.CoopNameShort} wholesale catalog`;
  aResp.render("Onsite/wholesale-catalog");
}

export async function wHandGetExport(aReq, aResp) {
  const oVtys = await wVtys();

  for (const oVty of oVtys) Fmt_RowExcel(oVty);

  aResp.attachment("Wholesale varieties.csv");
  aResp.csv(oVtys, true);
}

async function wVtys() {
  const oSQL = `SELECT Vty.IDVty, Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax,
			Vty.CkListOnsite, Vty.QtyOnsite, Vty.PriceNomOnsite,
			Product.IDProduct, Product.NameProduct, Product.CdStor,
			Producer.IDProducer, Producer.NameBus
		FROM Vty
		JOIN Product USING (IDProduct)
		JOIN Producer USING (IDProducer)
		WHERE (Vty.CdVtyType = 'Wholesale' AND Vty.CkListOnsite IS TRUE)
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
        "CkListOnsite",
        "QtyOnsite",
        "PriceNomOnsite",
      ],
    },
  ];
  return Struct(oVtys, oSpecs);
}
