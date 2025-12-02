// pickup-progress.js
// ------------------
// Pickup Progress page controllers

import { Conn } from "../../Db.js";
import { Locs, CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  if (aResp.PhaseCycLess("StartPickup")) {
    aResp.Show_Flash("danger", null, aReq.t("common:pickupProgress.cannotCheckOutPickupNotStarted"));

    aResp.redirect(303, "/distribution");
    return;
  }

  // Get location code
  // -----------------

  const oCdLoc = aReq.params.CdLoc;
  aResp.locals.Loc = Locs[oCdLoc];
  if (!aResp.locals.Loc) {
    aResp.status(404);
    aResp.render("Misc/404");
    return;
  }

  // Get shopper data
  // ----------------

  const oMembs = await wMembs(oCdLoc);

  aResp.locals.Pend = {
    Membs: [],
    CtIt: 0,
  };
  aResp.locals.Done = {
    Membs: [],
    CtIt: 0,
  };
  aResp.locals.Undeliv = {
    Membs: [],
    CtIt: 0,
  };
  oMembs.forEach(o => {
    if (o.CdStatCart === "Undeliv") aResp.locals.Undeliv.Membs.push(o);
    else if (o.CdStatCart === "Pend") {
      aResp.locals.Pend.Membs.push(o);
      aResp.locals.Pend.CtIt += o.QtyDeliv;
    } else {
      aResp.locals.Done.Membs.push(o);
      aResp.locals.Done.CtIt += o.QtySold;
    }
  });

  // Render page
  // -----------

  aResp.locals.Title = aReq.t("common:pageTitles.pickupProgress", { name: CoopParams.CoopNameShort });
  aResp.render("Distrib/pickup-progress");
}

async function wMembs(aCdLoc) {
  // To get only the delivered carts:
  //
  //   SELECT SUM(ItPickup.QtyDeliv) AS QtyDeliv,
  //   	SUM(ItPickup.QtySold) AS QtySold,
  //   	Memb.IDMemb, Memb.Name1First, Memb.Name1Last, Memb.NameBus,
  //   	Memb.Addr1, Memb.Addr2, Memb.City, Memb.St, Memb.Zip,
  //   	Memb.Phone1, Memb.Phone2, Memb.Email1, Memb.Email2,
  //   	InvcShopWeb.IDInvcShopWeb, InvcShopWeb.WhenUpd
  //   FROM ItPickup
  //   JOIN ItCart USING (IDItCart)
  //   JOIN Cart USING (IDCart)
  //   JOIN StApp USING (IDCyc)
  //   JOIN Memb USING (IDMemb)
  //   LEFT JOIN InvcShopWeb USING (IDCart)
  //   WHERE Cart.CdLoc = :CdLoc
  //   GROUP BY Cart.IDCart, Memb.IDMemb
  //   ORDER BY Memb.IDMemb
  //
  // This version gets undelivered carts as well:
  const oSQL = `SELECT Cart.CdLoc, Cart.CdStatCart,
			Memb.IDMemb, Memb.Name1First, Memb.Name1Last, Memb.NameBus,
			Memb.Addr1, Memb.Addr2, Memb.City, Memb.St, Memb.Zip,
			Memb.Phone1, Memb.Phone2, Memb.Email1, Memb.Email2,
			InvcShopWeb.IDInvcShopWeb, InvcShopWeb.WhenUpd,
			SUM(ItPickup.QtyDeliv) AS QtyDeliv,
			SUM(ItPickup.QtySold) AS QtySold
		FROM Cart
		JOIN ItCart USING (IDCart)
		JOIN StApp USING (IDCyc)
		JOIN Memb USING (IDMemb)
		LEFT JOIN InvcShopWeb USING (IDCart)
		LEFT JOIN ItPickup USING (IDItCart)
		WHERE Cart.CdLoc = :CdLoc
		GROUP BY Cart.IDCart, Memb.IDMemb
		ORDER BY Memb.IDMemb`;
  const oParams = {
    CdLoc: aCdLoc,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);
  return oRows;
}
