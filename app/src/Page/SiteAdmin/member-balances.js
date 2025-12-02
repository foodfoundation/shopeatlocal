// member-balances.js
// ------------------
// Member Balances page controllers

import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = aReq.t("common:pageTitles.memberBalances", {
    name: CoopParams.CoopNameShort,
  });
  aResp.render("SiteAdmin/member-balances");
}
