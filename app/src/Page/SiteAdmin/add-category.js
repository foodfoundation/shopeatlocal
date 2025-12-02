// add-category.js
// ---------------
// Add Category controllers

import { Valid as _Valid, wExec, CkFail, Retry, wIns } from "../../Form.js";
import { wCats } from "../../Db.js";
import { CoopParams, wReady } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = aReq.t("common:pageTitles.addCategory", { name: CoopParams.CoopNameShort });
  aResp.render("SiteAdmin/add-category");
}

export async function wHandPost(aReq, aResp) {
  // Field-level validation
  // ----------------------
  // The update should be performed in a transaction with the validation.
  // [TO DO]

  async function owValid_Name(aFld) {
    _Valid.Gen.Name(aFld);
    if (aFld.MsgFail) return;

    const oCats = await wCats();
    const oCkDup = oCats.some(o => o.NameCat.toUpperCase() === aFld.ValCook.toUpperCase());
    if (oCkDup) aFld.MsgFail = aReq.t("common:categories.categoryNameInUse");
  }

  const oFlds = {
    NameCat: { CkRequire: true, Valid: owValid_Name },
  };
  await wExec(aReq.body, oFlds);

  // Handle validation failure
  // -------------------------

  if (CkFail(oFlds)) {
    Retry(aResp, oFlds);

    wHandGet(aReq, aResp);
    return;
  }

  // Update category record
  // ----------------------

  await wIns("Cat", oFlds);
  await wReady();

  // Return to Manage Categories
  // ---------------------------

  aResp.Show_Flash("success", null, aReq.t("common:categories.categoryAdded"));
  aResp.redirect(303, "/manage-categories");
}
