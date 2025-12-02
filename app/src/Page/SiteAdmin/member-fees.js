// member-fees.js
// --------------
// Member Fees page controllers

import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = aReq.t("common:pageTitles.memberFees", {
    name: CoopParams.CoopNameShort,
  });
  aResp.render("SiteAdmin/member-fees");
}
