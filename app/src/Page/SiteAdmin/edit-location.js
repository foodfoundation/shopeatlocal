// edit-location.js
// ----------------
// Edit Location controllers

import { Valid as _Valid, wExec, CkFail, Retry, wUpdOne } from "../../Form.js";
import { Conn } from "../../Db.js";
import { Locs, CoopParams, wReady } from "../../Site.js";
import { Add_Props } from "../../Util.js";

export async function wHandGet(aReq, aResp) {
  const oCdLoc = aReq.params.CdLoc;
  const oLoc = Locs[oCdLoc];
  if (!oLoc) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }
  Add_Props(aResp.locals, oLoc);

  aResp.locals.CkEdit = true;
  aResp.locals.Title = `${CoopParams.CoopNameShort} edit location`;
  aResp.render("SiteAdmin/edit-location");
}

export async function wHandPost(aReq, aResp) {
  const oCdLoc = aReq.params.CdLoc;
  const oLoc = Locs[oCdLoc];
  if (!oLoc) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  // Field-level validation
  // ----------------------
  // The update should be performed in a transaction with the validation.
  // [TO DO]

  async function owValid_Name(aFld) {
    _Valid.Gen.Name(aFld);
    if (aFld.MsgFail) return;

    const oLocsExcept = await wLocsExcept(oCdLoc);
    const oCkDup = oLocsExcept.some(o => o.NameLoc.toUpperCase() === aFld.ValCook.toUpperCase());
    if (oCkDup) aFld.MsgFail = "This location name is already in use.";
  }

  const oFlds = {
    NameLoc: { CkRequire: true, Valid: owValid_Name },
    Addr: { Valid: false },
    Instruct: { Valid: false },
    CkReqDeactiv: { Valid: false },
  };
  // Locations can be activated at any time, but they cannot be deactivated
  // until the end of the cycle:
  if (!oLoc.CkActiv) oFlds.CkActiv = { Valid: false };

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

  await wUpdOne("Loc", "CdLoc", oCdLoc, oFlds);
  await wReady();

  // Return to Manage Categories
  // ---------------------------

  aResp.Show_Flash("success", null, "The location has been updated.");
  aResp.redirect(303, "/manage-locations");
}

/** Returns all locations except the one specified. */
async function wLocsExcept(aCdLoc) {
  const oSQL = `SELECT *
		FROM Loc
		WHERE CdLoc != :CdLoc
		ORDER BY NameLoc, CdLoc`;
  const oParams = {
    CdLoc: aCdLoc,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}
