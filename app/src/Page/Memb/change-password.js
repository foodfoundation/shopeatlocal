// change-password.js
// ------------------
// Password change controllers

import { wUpd_PassMemb } from "../../Db.js";
import { wExec, CkFail, Retry } from "../../Form.js";
import { wComp } from "../../Pass.js";
import { PageAfterEditMemb } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export function HandGet(aReq, aResp) {
  if (aResp.locals.CredImper) {
    const oMsg = "You cannot change the password while impersonating a member.";
    aResp.Show_Flash("danger", null, oMsg);

    aResp.redirect(303, "/member");
    return;
  }

  aResp.locals.Title = `${CoopParams.CoopNameShort} password change`;
  aResp.render("Memb/change-password");
}

export async function wHandPost(aReq, aResp) {
  // The user should not be allowed to update a selected or impersonated
  // member's password. In fact, they shouldn't be able to click the link, but
  // just in case:
  if (aResp.locals.CredImper) {
    aResp.status(400);
    aResp.render("Misc/400");
    return;
  }

  const oIDMemb = aReq.user.IDMemb;

  // Field-level validation
  // ----------------------

  const oFlds = {
    PassOrig: { Valid: false },
    PassNew: {},
    PassNewConfirm: { Valid: false },
  };
  await wExec(aReq.body, oFlds);

  // Form-level validation
  // ---------------------

  if (oFlds.PassNew.ValCook !== oFlds.PassNewConfirm.ValCook)
    oFlds.PassNewConfirm.MsgFail = "Your new passwords must match.";

  // Original password check
  // -----------------------

  if (!(await wComp(oFlds.PassOrig.ValCook, aReq.user.HashPass)))
    oFlds.PassOrig.MsgFail = "Your password is wrong.";

  // Handle validation failure
  // -------------------------

  if (CkFail(oFlds)) {
    Retry(aResp, oFlds);

    HandGet(aReq, aResp);
    return;
  }

  // Store new password
  // ------------------

  aReq.Log("Updating password...");
  await wUpd_PassMemb(oIDMemb, oFlds.PassNew.ValCook);

  // Return to previous page
  // -----------------------

  aResp.Show_Flash("success", null, "Your password has been changed.");

  const oPage = PageAfterEditMemb(aReq, aResp);
  aResp.redirect(303, oPage);
}
