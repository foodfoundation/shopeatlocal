// manage-categories.js
// --------------------
// Manage Categories page controller

import { Conn } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  // Structure data
  // --------------

  aResp.locals.Cats = [];
  aResp.locals.LastSubCatEdit = aReq.query.LastSubCatEdit;
  aResp.locals.LastCatEdit = aReq.query.LastCatEdit;

  let oCatLast = null;
  const oCatsSubcats = await wCatsSubcats();
  for (const oCatSubcat of oCatsSubcats) {
    if (!oCatLast || oCatSubcat.IDCat !== oCatLast.IDCat) {
      oCatLast = {
        IDCat: oCatSubcat.IDCat,
        NameCat: oCatSubcat.NameCat,
        Subcats: [],
      };
      aResp.locals.Cats.push(oCatLast);
    }

    if (oCatSubcat.IDSubcat)
      oCatLast.Subcats.push({
        IDSubcat: oCatSubcat.IDSubcat,
        NameSubcat: oCatSubcat.NameSubcat,
        CkTaxSale: oCatSubcat.CkTaxSale,
        CkEBT: oCatSubcat.CkEBT,
      });
  }

  // Render page
  // -----------

  aResp.locals.Title = `${CoopParams.CoopNameShort} manage categories`;
  aResp.render("SiteAdmin/manage-categories");
}

async function wCatsSubcats() {
  const oSQL = `SELECT Cat.IDCat, Cat.NameCat,
			Subcat.IDSubcat, Subcat.NameSubcat,
			Subcat.CkTaxSale, Subcat.CkEBT
		FROM Cat
		LEFT JOIN Subcat USING (IDCat)
		ORDER BY NameCat, IDCat, NameSubcat, IDSubcat`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  return oRows;
}
