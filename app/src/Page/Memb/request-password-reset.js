// request-password-reset.js
// -------------------------
// Password reset request controller

import handlebars from "handlebars";
const { compile } = handlebars;

import { wMembFromNameLogin, Conn } from "../../Db.js";
import { wExec, CkFail, Retry } from "../../Form.js";
import { wSend } from "../../Email.js";
import { URLBase } from "../../../Cfg.js";
import { TemplFromFile } from "../../View.js";
import { CoopParams } from "../../Site.js";

import uuid from "uuid";
const { v4: gUUID4 } = uuid;

export function HandGet(aReq, aResp) {
  // No particular reason to require that the user be logged-out.

  aResp.locals.Title = aReq.t("common:pageTitles.requestPasswordReset", { name: CoopParams.CoopNameShort });
  aResp.render("Memb/request-password-reset");
}

export async function wHandPost(aReq, aResp) {
  // Field-level validation
  // ----------------------

  const oFlds = {
    NameLogin: { Valid: false, CkRequire: true },
  };
  await wExec(aReq.body, oFlds);

  // Handle validation failure
  // -------------------------

  if (CkFail(oFlds)) {
    Retry(aResp, oFlds);

    HandGet(aReq, aResp);
    return;
  }

  // Check if user is logged in
  // -----------

  let isLoggedIn = false;
  let isStaff = false;
  if (aResp.locals.CredUser) {
    isLoggedIn = true;
    if (aResp.locals.CredUser.CkStaff()) {
      isStaff = true;
    }
  }

  // Find member
  // -----------

  const oNameLogin = oFlds.NameLogin.ValCook;
  const oMemb = await wMembFromNameLogin(oNameLogin);
  if (oMemb && !oMemb.CkLock) {
    // Store reset token
    // -----------------

    const oTok = gUUID4();
    await wAdd_TokResetPass(aReq.ip, oNameLogin, oTok);

    // Send reset e-mail
    // -----------------

    aReq.Log(`Sending password reset e-mail... ['${oNameLogin}']`);

    let oAddrsTo = oMemb.Email1;

    const oData = {
      NameLogin: oNameLogin,
      PathReset: `${URLBase}/reset-password/${oTok}`,
    };

    if (!isLoggedIn || !isStaff) {
      const oMsgText = ViewMsgText(oData);
      const oMsgHTML = ViewMsgHTML(oData);

      const oMsg = {
        to: oAddrsTo,
        subject: aReq.t("common:passwordReset.emailSubject", { name: CoopParams.CoopNameShort }),
        text: oMsgText,
        html: oMsgHTML,
      };
      await wSend(oMsg);
    } else {
      aResp.redirect(303, `/reset-password/${oTok}`);
    }
  }

  // Go to home page
  // ---------------
  // To prevent attackers from enumerating usernames, we will show the same
  // result regardless of whether a member was found.

  if (!isLoggedIn || !isStaff) {
    aResp.Show_Flash(
      "info",
      aReq.t("common:passwordReset.emailSent"),
      aReq.t("common:passwordReset.checkSpamFolder"),
    );
    aResp.redirect(303, "/");
  }
}

/** A view that generates the text version of the password reset e-mail. */
const ViewMsgText = compile(TemplFromFile("Rsc/MsgTextResetPass"));
/** A view that generates the HTML version of the password reset e-mail. */
const ViewMsgHTML = compile(TemplFromFile("Rsc/MsgHTMLResetPass"));

/** Adds a password reset token record to the database. */
async function wAdd_TokResetPass(aIP, aNameLogin, aTok) {
  const oParams = {
    IP: aIP,
    NameLogin: aNameLogin,
    Tok: aTok,
  };
  const oSQL = `INSERT INTO ResetPass (IP, NameLogin, Tok)
VALUES (:IP, :NameLogin, :Tok)`;
  const [oRows, _oFlds] = await Conn.wExec(oSQL, oParams);
  if (oRows.affectedRows < 1) throw Error("ResetPass.wAdd: Failed to add record");
}
