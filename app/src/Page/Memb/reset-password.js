// reset-password.js
// -----------------
// Password reset controller

import { wExec, CkFail, Retry } from "../../Form.js";
import { wMembFromNameLogin, wUpd_PassMemb, Conn } from "../../Db.js";
import { CoopParams } from "../../Site.js";

export function HandGet(aReq, aResp) {
  // No particular reason to require that the user be logged-out.

  aResp.locals.Title = `${CoopParams.CoopNameShort} password reset`;
  aResp.locals.TokResetPass = aReq.params.TokResetPass;
  aResp.render("Memb/reset-password");
}

export async function wHandPost(aReq, aResp) {
  // Field-level validation
  // ----------------------

  const oFlds = {
    PassNew: {},
    PassNewConfirm: { Valid: false },
  };
  await wExec(aReq.body, oFlds);

  // Form-level validation
  // ---------------------

  if (oFlds.PassNew.ValCook !== oFlds.PassNewConfirm.ValCook)
    oFlds.PassNewConfirm.MsgFail = "Your new passwords must match.";

  // Handle validation failure
  // -------------------------

  if (CkFail(oFlds)) {
    Retry(aResp, oFlds);

    HandGet(aReq, aResp);
    return;
  }

  // Check reset token
  // -----------------

  function oHandFail(_aSty, _aHead, _aMsg) {
    aResp.Show_Flash(
      "danger",
      "Reset request invalid or expired!",
      `Please request a new reset e-mail or contact ${CoopParams.CoopNameShort} for help.`,
    );
    aResp.redirect(303, "/");
  }

  const oTok = aReq.params.TokResetPass;
  const oNameLogin = await wNameLoginRecentFromTok(oTok);
  if (!oNameLogin) {
    oHandFail();
    return;
  }

  const oMemb = await wMembFromNameLogin(oNameLogin);
  if (!oMemb) {
    oHandFail();
    return;
  }

  // Store new password and delete token
  // -----------------------------------

  aReq.Log(`Resetting password... ['${oNameLogin}']`);

  await wUpd_PassMemb(oMemb.IDMemb, oFlds.PassNew.ValCook);
  await wClear_ToksResetPass(oTok, oNameLogin);

  // Go to home page
  // ---------------
  // We could log them in, but maybe an attacker found the login e-mail without
  // knowing the username?

  aResp.Show_Flash("success", null, "Your password has been changed. You may now login.");
  aResp.redirect(303, "/");
}

/** Returns the username associated with the specified reset token, or 'null' if
 *  no match is found, or if the token has expired. */
async function wNameLoginRecentFromTok(aTok) {
  const oParams = { Tok: aTok };
  const oSQL = `SELECT NameLogin
		FROM ResetPass
		WHERE (zWhen > DATE_SUB(NOW(), INTERVAL 1 HOUR))
			AND (Tok = :Tok)`;
  const [oRows, _oFlds] = await Conn.wExecPrep(oSQL, oParams);
  if (oRows.length < 1) return null;
  return oRows[0].NameLogin;
}

/** Deletes all reset token records that contain the specified token or
 *  username. */
async function wClear_ToksResetPass(aTok, aNameLogin) {
  const oParams = {
    Tok: aTok,
    NameLogin: aNameLogin,
  };
  const oSQL = `DELETE FROM ResetPass
		WHERE Tok = :Tok OR NameLogin = :NameLogin`;
  await Conn.wExecPrep(oSQL, oParams);
}
