// site-admin.js
// -------------
// Site Admin page controllers

import { wIPsBlock } from "../../Auth.js";
import { querySiteConfigurations } from "../../Db.js";
import { CkDev, Db, Sanity } from "../../../Cfg.js";
import { Add_Props } from "../../Util.js";
import { CoopParams, wReady } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = aReq.t("common:pageTitles.siteAdmin", { name: CoopParams.CoopNameShort });

  const oIPsBlock = await wIPsBlock();
  aResp.locals.CtBlockIP = oIPsBlock.length;

  const siteConfigurations = await querySiteConfigurations();

  if (CkDev) {
    aResp.locals.NameDB = Db.database;
    aResp.locals.IDSess = aReq.session.id.substr(0, 5) + "...";
  }

  const siteConfiguration = siteConfigurations[0];
  if (siteConfigurations) {
    Add_Props(aResp.locals, siteConfiguration);
  }

  aResp.locals.sanityUrl = Sanity.baseUrl;

  aResp.render("SiteAdmin/site-admin");
}

export async function wHandPost(aReq, aResp) {
  await wReady();

  aResp.Show_Flash("success", null, aReq.t("common:flashMessages.marketParametersUpdated"));

  aResp.redirect(303, "/site-admin");
}
