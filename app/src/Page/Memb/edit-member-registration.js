// edit-member-registration.js
// ---------------------------
// Edit member registration controllers

import { wMembFromID, Conn } from "../../Db.js";
import { wExec, CkFail, Retry, ValsCookFromFlds, wUpdOne } from "../../Form.js";
import { PageAfterEditMemb } from "../../Util.js";
import { wSend } from "../../Email.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  const oIDMembEff = aResp.locals.CredSelImperUser.IDMemb;
  const oMemb = await wMembFromID(oIDMembEff);
  // It would be nicer to select from 'Memb' in the template, but the validation
  // system assumes the fields are in the context root: [TO DO]
  Object.assign(aResp.locals, oMemb);

  aResp.locals.Title = aReq.t("common:pageTitles.editMemberRegistration", { name: CoopParams.CoopNameShort });
  aResp.render("Memb/edit-member-registration");
}

export async function wHandPost(aReq, aResp) {
  // Field-level validation
  // ----------------------

  const oFlds = {
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
  };
  // This field is displayed only to staff members:
  if (aResp.locals.CredUser.CkStaff()) oFlds.DistDeliv = { Valid: true };

  await wExec(aReq.body, oFlds);

  // Form-level validation
  // ---------------------

  if (oFlds.Name2First.ValCook && !oFlds.Name2Last.ValCook)
    oFlds.Name2Last.MsgFail = aReq.t("common:memberRegistration.enterLastNameOrClearFirst");

  if (oFlds.Name2Last.ValCook && !oFlds.Name2First.ValCook)
    oFlds.Name2First.MsgFail = aReq.t("common:memberRegistration.enterFirstNameOrClearLast");

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

    aResp.locals.Title = aReq.t("common:pageTitles.editMemberRegistration", { name: CoopParams.CoopNameShort });
    aResp.render("Memb/edit-member-registration");
    return;
  }

  // Update member record
  // --------------------

  const oIDMemb = aResp.locals.CredSelImperUser.IDMemb;

  //Send Email to staff if member email is updated
  const oParams = {};
  const oSQL = `SELECT Email1 FROM Memb WHERE IDMemb = ${oIDMemb}`;
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);

  if (oRows[0].Email1 != aReq.body.Email1) {
    const oMsg = {
      to: CoopParams.MembershipNotificationEmail,
      subject: aReq.t("common:memberRegistration.emailUpdatedSubject"),
      text: aReq.t("common:memberRegistration.emailUpdatedBody", {
        firstName: aReq.body.Name1First,
        lastName: aReq.body.Name1Last,
        email: aReq.body.Email1,
      }),
    };

    await wSend(oMsg);
  }

  const oParamsEx = {};

  // Reset delivery distance if the member changed their address. We will leave
  // the distance if staff changed the address:
  if (!aResp.locals.CredUser.CkStaff()) {
    const oMembOrig = await wMembFromID(oIDMemb);
    const oMembNew = ValsCookFromFlds(oFlds);
    if (!CkMatchAddr(oMembOrig, oMembNew)) oParamsEx.DistDeliv = null;
  }

  // Advance the member status to 'pending' if it was 'available', that status
  // being used to mark registrations that require changes:
  if (aResp.locals.CredUser.CdRegMemb === "Avail") oParamsEx.CdRegMemb = "Pend";

  await wUpdOne("Memb", "IDMemb", oIDMemb, oFlds, oParamsEx);

  // Go to Member or Member Detail page
  // ----------------------------------

  aResp.Show_Flash("success", null, aReq.t("common:memberRegistration.registrationUpdated"));

  const oPage = PageAfterEditMemb(aReq, aResp);
  aResp.redirect(303, oPage);
}

function CkMatchAddr(aMembL, aMembR) {
  // I guess we can ignore InstructDeliv here:
  return (
    aMembL.Addr1 === aMembR.Addr1 &&
    aMembL.Addr2 === aMembR.Addr2 &&
    aMembL.City === aMembR.City &&
    aMembL.St === aMembR.St &&
    aMembL.Zip === aMembR.Zip
  );
}
