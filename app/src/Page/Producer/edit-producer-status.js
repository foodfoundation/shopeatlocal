// edit-producer-status.js
// -----------------------
// Edit producer status controllers

import _ from "lodash";
import { wExec, CkFail, Retry, wUpdOne } from "../../Form.js";
import { wProducerFromID } from "../../Db.js";
import { PageAfterEditProducer } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export function Prep(aReq, aResp, aNext) {
  if (!aResp.locals.CredSelImperUser.IDProducer) {
    aResp.Show_Flash(
      "danger",
      null,
      aReq.t("common:producerStatus.mustCompleteRegistration"),
    );
    aResp.redirect(303, "/producer-registration");
    return;
  }
  aNext();
}

export async function wHandGet(aReq, aResp) {
  // Though other staff are not allowed to edit a manager's member data, I think
  // it does make sense to allow them to edit producer data.

  const oIDProducerEff = aResp.locals.CredSelImperUser.IDProducer;
  const oProducer = await wProducerFromID(oIDProducerEff);
  Object.assign(aResp.locals, oProducer);

  aResp.locals.Title = aReq.t("common:pageTitles.editProducerStatus", { name: CoopParams.CoopNameShort });
  aResp.render("Producer/edit-producer-status");
}

export async function wHandPost(aReq, aResp) {
  const oCkStaff = aResp.locals.CredUser.CkStaff();

  // Field-level validation
  // ----------------------

  const oFlds = {
    CkListProducer: {},
  };

  if (oCkStaff) {
    oFlds.CdRegProducer = {};
    oFlds.CdRegWholesale = {};
  }

  await wExec(aReq.body, oFlds);

  // Form-level validation
  // ---------------------

  // Only staff can change the registration status.
  // It shouldn't be possible for non-staff to reach this page if the
  // producer is unapproved, but just in case:
  const oCdReg = oCkStaff
    ? oFlds.CdRegProducer.ValCook
    : aResp.locals.CredSelImperUser.CdRegProducer;

  // Check the producer status before allowing the producer to be listed:
  if (oFlds.CkListProducer.ValCook && oCdReg !== "Approv") {
    oFlds.CkListProducer.MsgFail = aReq.t("common:producerStatus.unapprovedCannotBeListed");
  }

  // Check the producer status before allowing the producer to be listed:
  if (oFlds.CdRegWholesale?.ValCook === "Approv" && oCdReg !== "Approv") {
    oFlds.CdRegWholesale.MsgFail = aReq.t("common:producerStatus.unapprovedCannotBeWholesale");
  }

  // Handle validation failure
  // -------------------------

  if (CkFail(oFlds)) {
    Retry(aResp, oFlds);

    aResp.locals.Title = aReq.t("common:pageTitles.editProducerStatus", { name: CoopParams.CoopNameShort });
    aResp.render("Producer/edit-producer-status");
    return;
  }

  // Update producer record
  // ----------------------

  const oIDProducer = aResp.locals.CredSelImperUser.IDProducer;
  await wUpdOne("Producer", "IDProducer", oIDProducer, oFlds);

  // Go to Producer or Producer Detail page
  // --------------------------------------

  aResp.Show_Flash("success", null, aReq.t("common:producerStatus.statusUpdated"));

  const oPage = PageAfterEditProducer(aReq, aResp);
  aResp.redirect(303, oPage);
}
