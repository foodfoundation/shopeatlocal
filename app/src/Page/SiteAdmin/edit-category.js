// edit-category.js
// ----------------
// Edit Category controllers

import { Valid as _Valid, wExec, CkFail, Retry, wUpdOne } from "../../Form.js";
import { wCatFromID, wCatsExcept } from "../../Db.js";
import { CoopParams, wReady } from "../../Site.js";
import { Add_Props } from "../../Util.js";

export async function wHandGet(aReq, aResp) {
  const oIDCat = aReq.params.IDCat;
  const oCat = await wCatFromID(oIDCat);
  if (!oCat) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }
  Add_Props(aResp.locals, oCat);

  aResp.locals.Title = `${CoopParams.CoopNameShort} edit category`;
  aResp.render("SiteAdmin/edit-category");
}

export async function wHandPost(aReq, aResp) {
  const oIDCat = aReq.params.IDCat;

  // Field-level validation
  // ----------------------
  // The update should be performed in a transaction with the validation.
  // [TO DO]

  async function owValid_Name(aFld) {
    _Valid.Gen.Name(aFld);
    if (aFld.MsgFail) return;

    const oCatsExcept = await wCatsExcept(oIDCat);
    const oCkDup = oCatsExcept.some(o => o.NameCat.toUpperCase() === aFld.ValCook.toUpperCase());
    if (oCkDup) aFld.MsgFail = "This category name is already in use.";
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

  await wUpdOne("Cat", "IDCat", oIDCat, oFlds);
  await wReady();

  // Return to Manage Categories
  // ---------------------------

  aResp.Show_Flash("success", null, "The category has been updated.");
  aResp.redirect(303, "/manage-categories?LastCatEdit=" + oIDCat);
}
