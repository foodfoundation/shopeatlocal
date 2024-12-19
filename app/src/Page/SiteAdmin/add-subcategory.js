// add-subcategory.js
// ------------------
// Add Subcategory controllers

import { Valid as _Valid, wExec, CkFail, Retry, wIns } from "../../Form.js";
import { wCats, wSubcats } from "../../Db.js";
import { CoopParams, wReady } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Cats = await wCats();
  aResp.locals.Title = `${CoopParams.CoopNameShort} add subcategory`;
  aResp.render("SiteAdmin/add-subcategory");
}

export async function wHandPost(aReq, aResp) {
  // Field-level validation
  // ----------------------
  // The update should be performed in a transaction with the validation.
  // [TO DO]

  async function owValid_Name(aFld) {
    _Valid.Gen.Name(aFld);
    if (aFld.MsgFail) return;

    const oSubcats = await wSubcats();
    const oCkDup = oSubcats.some(o => o.NameSubcat.toUpperCase() === aFld.ValCook.toUpperCase());
    if (oCkDup) aFld.MsgFail = "This subcategory name is already in use.";
  }

  const oFlds = {
    IDCat: { CkRequire: true },
    NameSubcat: { CkRequire: true, Valid: owValid_Name },
    CkTaxSale: { CkRequire: true, Valid: false },
    CkEBT: { CkRequire: true, Valid: false },
  };
  await wExec(aReq.body, oFlds);

  // Handle validation failure
  // -------------------------

  if (CkFail(oFlds)) {
    Retry(aResp, oFlds);

    wHandGet(aReq, aResp);
    return;
  }

  // Update subcategory record
  // -------------------------

  await wIns("Subcat", oFlds);
  await wReady();

  // Return to Manage Categories
  // ---------------------------

  aResp.Show_Flash("success", null, "The subcategory has been added.");
  aResp.redirect(303, "/manage-categories");
}
