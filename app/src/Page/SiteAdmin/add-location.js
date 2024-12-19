// add-location.js
// ---------------
// Add Location controllers

import { Valid as _Valid, wExec, CkFail, Retry, wIns } from "../../Form.js";
import { wLocs } from "../../Db.js";
import { CoopParams, wReady } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.CkEdit = false;
  aResp.locals.Title = `${CoopParams.CoopNameShort} add location`;
  aResp.render("SiteAdmin/add-location");
}

export async function wHandPost(aReq, aResp) {
  // Field-level validation
  // ----------------------
  // The update should be performed in a transaction with the validation.
  // [TO DO]

  async function owValid_Cd(aFld) {
    _Valid.Gen.AlphaNum(aFld);
    if (aFld.MsgFail) return;

    const oLocs = await wLocs();
    const oCkDup = oLocs.some(o => o.CdLoc.toUpperCase() === aFld.ValCook.toUpperCase());
    if (oCkDup) aFld.MsgFail = "This location code is already in use.";
  }

  async function owValid_Name(aFld) {
    _Valid.Gen.Name(aFld);
    if (aFld.MsgFail) return;

    const oLocs = await wLocs();
    const oCkDup = oLocs.some(o => o.NameLoc.toUpperCase() === aFld.ValCook.toUpperCase());
    if (oCkDup) aFld.MsgFail = "This location name is already in use.";
  }

  const oFlds = {
    CdLoc: { CkRequire: true, Valid: owValid_Cd },
    NameLoc: { CkRequire: true, Valid: owValid_Name },
    Addr: { Valid: false },
    Instruct: { Valid: false },
    CkActiv: { CkRequire: true, Valid: false },
  };
  await wExec(aReq.body, oFlds);

  // Handle validation failure
  // -------------------------

  if (CkFail(oFlds)) {
    Retry(aResp, oFlds);

    wHandGet(aReq, aResp);
    return;
  }

  // Update location record
  // ----------------------

  // This is the database default, but just in case:
  const oParamsEx = { CdTypeLoc: "Satel" };

  await wIns("Loc", oFlds, oParamsEx);
  await wReady();

  // Return to Manage Locations
  // ---------------------------

  aResp.Show_Flash("success", null, "The location has been added.");
  aResp.redirect(303, "/manage-locations");
}
