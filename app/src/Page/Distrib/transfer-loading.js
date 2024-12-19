// transfer-loading.js
// -------------------
// Transfer Loading page controllers

import { Conn } from "../../Db.js";
import { Struct } from "../../Util.js";
import { Locs, CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  if (aResp.PhaseCycLess("StartPickup")) {
    const oMsg = "<strong>Cannot load transfers!</strong> The pickup window has not started.";
    aResp.Show_Flash("danger", null, oMsg);

    aResp.redirect(303, "/distribution");
    return;
  }

  // Get location code
  // -----------------

  const oCdLoc = aReq.params.CdLoc;
  const oLoc = Locs[oCdLoc];
  if (!oLoc) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }
  aResp.locals.Loc = oLoc;

  // Check cart statuses
  // -------------------
  // All orders at this location must be picked before the transfer can occur.

  const oMembs = await wMembsByStor(oCdLoc);
  const oCkPendCart = oMembs.some(o => o.CdStatCart === "Pend");
  if (oCkPendCart) {
    const oHead = "Cannot transfer!";
    const oMsg = `One or more ${oLoc.NameLoc} orders are awaiting check out.`;
    aResp.Show_Flash("danger", oHead, oMsg);

    const oPage = "/pickup-progress/" + oLoc.CdLoc;
    aResp.redirect(303, oPage);
    return;
  }

  // Structure by location and storage code
  // --------------------------------------

  const oSpecs = [
    {
      NameKey: "CdStor",
      Props: ["CdStor"],
      NameChild: "Membs",
    },
    {
      Props: ["IDMemb", "Name1First", "Name1Last", "QtySold"],
    },
  ];
  aResp.locals.Stors = Struct(oMembs, oSpecs);

  aResp.locals.QtySold = 0;
  for (const oStor of aResp.locals.Stors) {
    oStor.QtySold = 0;
    for (const oMemb of oStor.Membs) oStor.QtySold += oMemb.QtySold;
    aResp.locals.QtySold += oStor.QtySold;
  }

  // Render page
  // -----------

  aResp.locals.Title = `${CoopParams.CoopNameShort} transfer loading`;
  aResp.render("Distrib/transfer-loading");
}

async function wMembsByStor(aCdLoc) {
  const oSQL = `SELECT SUM(ItCart.QtySold) AS QtySold,
			Product.CdStor,
			Cart.CdStatCart,
			Memb.IDMemb, Memb.Name1First, Memb.Name1Last
		FROM ItCart
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		JOIN Cart USING (IDCart)
		JOIN Memb USING (IDMemb)
		JOIN Loc USING (CdLoc)
		JOIN StApp USING (IDCyc)
		WHERE (Loc.CdLoc = :CdLoc)
		GROUP BY Product.CdStor, Cart.CdStatCart, Memb.IDMemb
		ORDER BY Product.CdStor,
			Memb.Name1Last, Memb.Name1First, Memb.IDMemb`;
  const oParams = {
    CdLoc: aCdLoc,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}
