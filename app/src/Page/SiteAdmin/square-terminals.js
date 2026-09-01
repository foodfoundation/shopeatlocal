import { wSquareTerminals } from "../../Db.js";
import {
  wCreateSquareTerminalCode,
  wDisableSquareTerminal,
  wRefreshSquareTerminal,
} from "../../Square.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  aResp.locals.SquareTerminals = await wSquareTerminals();
  aResp.locals.Title = `${CoopParams.CoopNameShort} Square terminals`;
  aResp.render("SiteAdmin/square-terminals");
}

export async function wHandPost(aReq, aResp) {
  const oAction = aReq.body.Action;
  const oIDMembStaff = aResp.locals.CredUser.IDMemb;

  try {
    if (oAction === "Create") {
      await wCreateSquareTerminalCode(aReq.body.Name, oIDMembStaff);
      aResp.Show_Flash("success", null, "Square terminal pairing code created.");
    } else if (oAction === "Refresh") {
      await wRefreshSquareTerminal(Number(aReq.body.IDSquareTerminal), oIDMembStaff);
      aResp.Show_Flash("success", null, "Square terminal status refreshed.");
    } else if (oAction === "Disable") {
      await wDisableSquareTerminal(Number(aReq.body.IDSquareTerminal), oIDMembStaff);
      aResp.Show_Flash("success", null, "Square terminal disabled.");
    } else {
      aResp.Show_Flash("danger", null, "Unknown Square terminal action.");
    }
  } catch (aErr) {
    aResp.Show_Flash("danger", null, aErr.message || String(aErr));
  }

  aResp.redirect(303, "/square-terminals");
}
