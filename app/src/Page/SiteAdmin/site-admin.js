// site-admin.js
// -------------
// Site Admin page controllers

import { wIPsBlock } from "../../Auth.js";
import { querySiteConfigurations } from "../../Db.js";
import { CkDev, Db, Sanity } from "../../../Cfg.js";
import { Add_Props } from "../../Util.js";
import { CoopParams, wReady } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.Title = `${CoopParams.CoopNameShort} site admin`;

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

  aResp.Show_Flash("success", null, "Market parameters were updated successfully.");

  aResp.redirect(303, "/site-admin");
}
