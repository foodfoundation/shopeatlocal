// member-registration.js
// ----------------------
// Member registration controllers

import { wExec, CkFail, Retry, wIns } from "../../Form.js";
import { wCredFromIDMemb } from "../../Cred.js";
import { wHash } from "../../Pass.js";
import { wAdd_Login } from "../../Auth.js";
import { PageAfterEditMemb } from "../../Util.js";
import { Conn, wAdd_Transact, wUpd_WhenFeeMembLast } from "../../Db.js";
import { wSend } from "../../Email.js";
import { CoopParams, Site } from "../../Site.js";

import _ from "lodash";

export function Prep(aReq, aResp, aNext) {
  if (aReq.user) {
    aResp.Show_Flash(
      "danger",
      "You are already registered!",
      `Please contact ${CoopParams.CoopNameShort} if you need help.`,
    );

    const oPage = PageAfterEditMemb(aReq, aResp);
    aResp.redirect(303, oPage);
    return;
  }
  aNext();
}

function CkTrialAllowed() {
  return Site.CtMonthTrialMembNew >= 1;
}

/** 'choice', 'join', or 'trial'. A trial is never selected when one is not allowed. */
function ModeReg(aReq) {
  if (!CkTrialAllowed()) return "join";
  if (String(aReq.query.trial ?? "") === "1") return "trial";
  if (String(aReq.query.join ?? "") === "1") return "join";
  return "choice";
}

/** Form and link target. The trial query is omitted when a trial is not allowed. */
function PathReg(aMode) {
  if (!CkTrialAllowed()) return "/member-registration";
  if (aMode === "trial") return "/member-registration?trial=1";
  if (aMode === "join") return "/member-registration?join=1";
  return "/member-registration";
}

export function HandGet(aReq, aResp) {
  if (aReq.method === "GET" && !CkTrialAllowed() && aReq.query.trial != null) {
    aResp.redirect(303, "/member-registration");
    return;
  }

  const oMode = ModeReg(aReq);
  aResp.locals.Title = `${CoopParams.CoopNameShort} member registration`;
  aResp.locals.CoopParams = CoopParams;
  aResp.locals.ModeReg = oMode;
  aResp.locals.PathReg = PathReg(oMode);
  aResp.render("Memb/member-registration");
}

export async function wHandPost(aReq, aResp) {
  // Field-level validation
  // ----------------------

  function oValid_CkReadTOS(aFld) {
    if (!aFld.ValCook) aFld.MsgFail = "You must accept the Terms of Service to continue.";
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
    DtlHowHear: { CkRequire: CoopParams.RegisterPageTellUsMoreRequired },
    CkApplyEBT: { Store: false },
    CkApplyVolun: { Store: false },
    CkReadTOS: { Valid: oValid_CkReadTOS, Store: false },
  };
  await wExec(aReq.body, oFlds);

  // Form-level validation
  // ---------------------

  if (oFlds.Pass.ValCook !== oFlds.PassConfirm.ValCook)
    oFlds.PassConfirm.MsgFail = "Your passwords must match.";

  if (oFlds.Name2First.ValCook && !oFlds.Name2Last.ValCook)
    oFlds.Name2Last.MsgFail = "Please enter a last name, or clear the first name.";

  if (oFlds.Name2Last.ValCook && !oFlds.Name2First.ValCook)
    oFlds.Name2First.MsgFail = "Please enter a first name, or clear the last name.";

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
      "You are already registered!",
      `Please contact ${CoopParams.CoopNameShort} if you need help.`,
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

  // Join now charges the initial fee. A trial does not. The page chooses this;
  // a posted checkbox cannot.
  const oCkSkipMembTrial = ModeReg(aReq) !== "trial";
  if (Site.CtMonthTrialMembNew < 1 || oCkSkipMembTrial) {
    await wAdd_Transact(oIDMemb, "FeeMembInit", Site.FeeMembInit, 0, null, null);
    await wUpd_WhenFeeMembLast(oIDMemb);
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
