// index.js
// --------
// Market home controllers

import { ArrayFromCds, CdsAttrProduct, Conn } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.AttrsProduct = ArrayFromCds(CdsAttrProduct);
  aResp.locals.Cats = await wCats();
  aResp.locals.Title = aReq.t("common:pageTitles.marketHome", { name: CoopParams.CoopNameShort });

  aResp.render("Home/index");
}

async function wCats() {
  const oSQL = `SELECT DISTINCT Cat.IDCat, Cat.NameCat,
			Subcat.IDSubcat, Subcat.NameSubcat
		FROM Cat
		JOIN Subcat USING (IDCat)
		JOIN Product USING (IDSubcat)
		JOIN Vty USING (IDProduct)
		JOIN Producer USING (IDProducer)
		WHERE (Producer.CdRegProducer = 'Approv')
			AND (Producer.CkListProducer IS TRUE)
			AND (Vty.CkListWeb IS TRUE)
			AND (Vty.QtyOffer > 0)
		ORDER BY NameCat, IDCat, NameSubcat, IDSubcat`;

  const [oRows, _oFlds] = await Conn.wExecPrep(oSQL);

  // Structure categories and subcategories
  // --------------------------------------

  const oCats = [];
  let oCatLast = null;
  for (const oRow of oRows) {
    // Add category element:
    if (!oCatLast || oRow.IDCat !== oCatLast.IDCat) {
      oCatLast = {
        IDCat: oRow.IDCat,
        NameCat: oRow.NameCat,
        Subcats: [],
      };
      oCats.push(oCatLast);
    }

    // Add subcategory element:
    const oSubcat = {
      IDSubcat: oRow.IDSubcat,
      NameSubcat: oRow.NameSubcat,
    };
    oCatLast.Subcats.push(oSubcat);
  }
  return oCats;
}
