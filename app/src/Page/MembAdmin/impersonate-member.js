// impersonate-member.js
// ------------------
// Member impersonation controllers

import { wMembFromID, wAdd_EvtApp } from "../../Db.js";

export async function wHandPost(aReq, aResp) {
  // Check target member ID
  // ----------------------

  const oIDMembImper = parseInt(aReq.body.IDMembImper);
  if (isNaN(oIDMembImper)) {
    aResp.status(400);
    aResp.render("Misc/400");
    return;
  }

  // Do not allow self-impersonation
  // -------------------------------

  if (oIDMembImper === aReq.user.IDMemb) {
    // We can do this, at least:
    delete aReq.session.IDMembImper;

    aResp.Show_Flash("danger", null, aReq.t("common:impersonation.cannotImpersonateSelf"));
    aResp.redirect(303, "/member");
    return;
  }

  // Check member ID
  // ---------------

  const oMemb = await wMembFromID(oIDMembImper);
  if (!oMemb) {
    aResp.status(400);
    aResp.render("Misc/400");
    return;
  }

  // Impersonate target
  // ------------------

  await wAdd_EvtApp("Imper", oIDMembImper, null, aReq.user.IDMemb);

  aReq.session.IDMembImper = oIDMembImper;

  // It's not enough to check CkShowProducer, because that produces a confusing
  // 'You must complete the producer registration before using that page'
  // message if the impersonated member's producer registration happens to be
  // incomplete:
  const oPage = oMemb.IDProducer ? "/producer" : "/member";
  aResp.redirect(303, oPage);
}
