// member-registration.js
// ----------------------
// Member registration controllers

import { wExec, CkFail, Retry, wIns } from "../../Form.js";
import { wCredFromIDMemb } from "../../Cred.js";
import { wHash } from "../../Pass.js";
import { wAdd_Login } from "../../Auth.js";
import { PageAfterEditMemb } from "../../Util.js";
import { Conn } from "../../Db.js";
import { wSend } from "../../Email.js";
import { CoopParams } from "../../Site.js";

import _ from "lodash";

export function Prep(aReq, aResp, aNext) {
  if (aReq.user) {
    aResp.Show_Flash(
      "danger",
      aReq.t("common:registration.alreadyRegistered"),
      aReq.t("common:registration.contactForHelp", { name: CoopParams.CoopNameShort }),
    );

    const oPage = PageAfterEditMemb(aReq, aResp);
    aResp.redirect(303, oPage);
    return;
  }
  aNext();
}

export function HandGet(aReq, aResp) {
  aResp.locals.Title = aReq.t("common:pageTitles.memberRegistration", { name: CoopParams.CoopNameShort });
  aResp.locals.CoopParams = CoopParams;
  aResp.render("Memb/member-registration");
}

export async function wHandPost(aReq, aResp) {
  // Field-level validation
  // ----------------------

  function oValid_CkReadTOS(aFld) {
    if (!aFld.ValCook) aFld.MsgFail = aReq.t("common:registration.mustAcceptTOS");
  }

  const oFlds = {
    NameLogin: { CkRequire: true },
    Pass: { CkRequire: true, Store: false },
    PassConfirm: { CkRequire: true, Valid: false, Store: false },
    Name1First: { CkRequire: true },
    Name1Last: { CkRequire: true },
    Name2First: {},
    Name2Last: {},
    NameBus: {},
    Addr1: { CkRequire: true },
    Addr2: {},
    City: { CkRequire: true },
    St: { CkRequire: true },
    Zip: { CkRequire: true },
    InstructDeliv: { Valid: false },
    CkAllowMail: {},
    Phone1: { CkRequire: true },
    CkAllowPhone1MsgCart: {},
    Phone2: {},
    CkAllowPhone2MsgCart: {},
    Email1: { CkRequire: true },
    CkAllowEmail1RemindShop: {},
    CkAllowEmail1News: {},
    Email2: {},
    CkAllowEmail2RemindShop: {},
    CkAllowEmail2News: {},
    CkAllowPublicName: {},
    HowHear: { Valid: false },
    DtlHowHear: { CkRequire: true },
    CkApplyEBT: { Store: false },
    CkApplyVolun: { Store: false },
    CkReadTOS: { Valid: oValid_CkReadTOS, Store: false },
  };
  await wExec(aReq.body, oFlds);

  // Form-level validation
  // ---------------------

  if (oFlds.Pass.ValCook !== oFlds.PassConfirm.ValCook)
    oFlds.PassConfirm.MsgFail = aReq.t("common:registration.passwordsMustMatch");

  if (oFlds.Name2First.ValCook && !oFlds.Name2Last.ValCook)
    oFlds.Name2Last.MsgFail = aReq.t("common:registration.enterLastNameOrClear");

  if (oFlds.Name2Last.ValCook && !oFlds.Name2First.ValCook)
    oFlds.Name2First.MsgFail = aReq.t("common:registration.enterFirstNameOrClear");

  // Clear second name if it matches the first:
  if (
    oFlds.Name2First.ValCook &&
    oFlds.Name2Last.ValCook &&
    oFlds.Name2First.ValCook === oFlds.Name1First.ValCook &&
    oFlds.Name2Last.ValCook === oFlds.Name1Last.ValCook
  ) {
    oFlds.Name2First.ValCook = null;
    oFlds.Name2Last.ValCook = null;
  }

  // Handle validation failure
  // -------------------------

  if (CkFail(oFlds)) {
    Retry(aResp, oFlds);

    HandGet(aReq, aResp);
    return;
  }

  // Create member record
  // --------------------

  //check db for phone # and email. if they already exist, show an error message
  const existingUser = await checkMembForExistingUser(oFlds.Email1.ValCook, oFlds.Phone1.ValCook);
  if (existingUser > 0) {
    aResp.Show_Flash(
      "danger",
      aReq.t("common:registration.alreadyRegistered"),
      aReq.t("common:registration.contactForHelp", { name: CoopParams.CoopNameShort }),
    );

    aResp.redirect("/");
    return;
  }

  const oParamsEx = {
    HashPass: await wHash(oFlds.Pass.ValCook),
    CdRegEBT: CdRegFromCk(oFlds.CkApplyEBT.ValCook),
    CdRegVolun: CdRegFromCk(oFlds.CkApplyVolun.ValCook),
  };

  const oIDMemb = await wIns("Memb", oFlds, oParamsEx);
  if (!oIDMemb) {
    throw Error("wHandPost: Could not create member record");
  }

  // Login as new member
  // -------------------

  const oUser = await wCredFromIDMemb(oIDMemb);
  if (!oUser) {
    throw Error("wHandPost: Could not retrieve member record");
  }

  await aReq.logout();

  await aReq.login(oUser);

  await wAdd_Login(aReq.ip, aReq.body.NameLogin, oIDMemb);

  // Go to member page
  // -----------------
  // Send email to user
  const oMsg = {
    to: oFlds.Email1.ValCook,
    subject: CoopParams.registrationEmailSubject,
    html: CoopParams.registrationEmailContent,
  };
  await wSend(oMsg);

  const oPage = PageAfterEditMemb(aReq, aResp);
  aResp.redirect(303, oPage);
}

/** Returns 'Pend' if aCk is truthy, or 'Avail' if it is not. */
function CdRegFromCk(aCk) {
  return aCk ? "Pend" : "Avail";
}

async function checkMembForExistingUser(email, phone) {
  const oSQL = `SELECT * FROM Memb WHERE Memb.Email1 = '${email}' OR Memb.Phone1 = ${phone}`;
  console.log(oSQL);
  const oParams = {};
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);

  return oRows.length;
}
