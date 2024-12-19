// edit-member-status.js
// ---------------------
// Edit member status controllers

import { wMembFromID } from "../../Db.js";
import { wExec, CkFail, Retry, wUpdOne } from "../../Form.js";
import { PageAfterEditMemb } from "../../Util.js";
import { CoopParams } from "../../Site.js";

/** Returns an object containing fields that should be disabled in the form, and
 *  ignored during form processing. */
function FldsDisab(aReq, aResp) {
  const oFlds = {};

  if (aResp.locals.CkSelImperUserSelf)
    oFlds.CdStaff = { Msg: "You cannot change your own staff status." };

  if (!aResp.locals.CredUser.CkStaffMgr())
    oFlds.CdStaff = {
      Msg: `Only ${CoopParams.CoopNameShort} managers can change the staff status.`,
    };

  return oFlds;
}

export async function wHandGet(aReq, aResp) {
  const oIDMembEff = aResp.locals.CredSelImperUser.IDMemb;
  const oMemb = await wMembFromID(oIDMembEff);
  // It would be nicer to select from 'Memb' in the template, but the validation
  // system assumes the fields are in the context root: [TO DO]
  Object.assign(aResp.locals, oMemb);
  console.log(aResp.locals);

  aResp.locals.FldsDisab = FldsDisab(aReq, aResp);

  aResp.locals.Title = `${CoopParams.CoopNameShort} edit member status`;
  aResp.render("Memb/edit-member-status");
}

export async function wHandPost(aReq, aResp) {
  // Field-level validation
  // ----------------------

  const oFlds = {
    CdRegMemb: {},
    CdRegEBT: {},
    CkShowProducer: {},
    CdRegVolun: {},
    CdRegWholesale: {},
  };

  if (aResp.locals.CredUser.CkStaffMgr() && !aResp.locals.CkSelImperUserSelf) oFlds.CdStaff = {};

  if (aResp.locals.CredUser.CkStaff()) oFlds.Notes = { Valid: false };

  await wExec(aReq.body, oFlds);

  // Handle validation failure
  // -------------------------

  if (CkFail(oFlds)) {
    Retry(aResp, oFlds);

    aResp.locals.Title = `${CoopParams.CoopNameShort} edit member status`;
    aResp.render("Memb/edit-member-status");
    return;
  }

  // Update member record
  // --------------------

  const oIDMemb = aResp.locals.CredSelImperUser.IDMemb;
  await wUpdOne("Memb", "IDMemb", oIDMemb, oFlds);

  // Go to member or member detail page
  // ----------------------------------

  aResp.Show_Flash("success", null, "The member status has been updated.");

  const oPage = PageAfterEditMemb(aReq, aResp);
  aResp.redirect(303, oPage);
}
