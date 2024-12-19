// edit-subcategory.js
// -------------------
// Edit Subcategory controllers

import { wExec, CkFail, Retry, wUpdOne } from "../../Form.js";
import { wSubcatFromID, wCats, wSubcatsByCatExcept } from "../../Db.js";
import { CoopParams, wReady } from "../../Site.js";
import { Add_Props } from "../../Util.js";

export async function wHandGet(aReq, aResp) {
  const oIDSubcat = aReq.params.IDSubcat;
  const oSubcat = await wSubcatFromID(oIDSubcat);
  if (!oSubcat) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }
  Add_Props(aResp.locals, oSubcat);

  aResp.locals.Cats = await wCats();

  aResp.locals.Title = `${CoopParams.CoopNameShort} edit subcategory`;
  aResp.render("SiteAdmin/edit-subcategory");
}

export async function wHandPost(aReq, aResp) {
  const oIDSubcat = aReq.params.IDSubcat;

  // Field-level validation
  // ----------------------

  const oFlds = {
    IDCat: { CkRequire: true },
    NameSubcat: { CkRequire: true },
    CkTaxSale: { CkRequire: true, Valid: false },
    CkEBT: { CkRequire: true, Valid: false },
  };
  await wExec(aReq.body, oFlds);

  // Check for name duplication
  // --------------------------
  // Subcategories are allowed to share names, but not within the same category.
  // It's difficult to do check this with a regular validation function, as the
  // new category ID is itself one of the inputs.
  //
  // The update should be performed in a transaction with the validation.
  // [TO DO]

  if (!CkFail(oFlds)) {
    const oIDCatNew = oFlds.IDCat.ValCook;
    const oNameNewUp = oFlds.NameSubcat.ValCook.toUpperCase();
    const oSubcatsExcept = await wSubcatsByCatExcept(oIDCatNew, oIDSubcat);
    const oCkDup = oSubcatsExcept.some(o => o.NameSubcat.toUpperCase() === oNameNewUp);
    if (oCkDup) oFlds.NameSubcat.MsgFail = "This subcategory name is already in use.";
  }

  // Handle validation failure
  // -------------------------

  if (CkFail(oFlds)) {
    Retry(aResp, oFlds);

    wHandGet(aReq, aResp);
    return;
  }

  // Update subcategory record
  // -------------------------

  await wUpdOne("Subcat", "IDSubcat", oIDSubcat, oFlds);
  await wReady();

  // Return to Manage Categories
  // ---------------------------

  aResp.Show_Flash("success", null, "The subcategory has been updated.");
  aResp.redirect(303, "/manage-categories?LastSubCatEdit=" + oIDSubcat);
}
