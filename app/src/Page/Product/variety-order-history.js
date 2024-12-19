// variety-order-history.js
// ------------------------
// Variety Order History page controllers

import { wProductFromID, Conn } from "../../Db.js";
import { Struct } from "../../Util.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  // VtySel was added by wWareVtySelOwn:
  aResp.locals.Product = await wProductFromID(aResp.locals.VtySel.IDProduct);

  const oIDCycStart = aResp.locals.CycCurr.IDCyc - 12;
  aResp.locals.Cycs = await wCycs(aResp.locals.VtySel.IDVty, oIDCycStart);

  aResp.locals.Title = `${CoopParams.CoopNameShort} variety order history`;
  aResp.render("Product/variety-order-history");
}

/** Returns members who ordered the specified variety, since the specified
 *  cycle, grouped by cycle. */
async function wCycs(aIDVty, aIDCycStart) {
  const oSQL = `SELECT ItCart.NoteShop, ItCart.QtyOrd, ItCart.QtyProm,
			IFNULL(ItCart.QtyDeliv, 0) AS QtyDeliv,
			Cyc.IDCyc, Cyc.WhenStartCyc,
			Memb.IDMemb, Memb.Name1First, Memb.Name1Last, Memb.Email1, Memb.Phone1
		FROM ItCart
		JOIN Cart USING (IDCart)
		JOIN Cyc USING (IDCyc)
		JOIN Memb USING (IDMemb)
		WHERE ItCart.IDVty = :IDVty
			AND Cyc.IDCyc >= :IDCycStart
		ORDER BY Cyc.IDCyc DESC, Memb.Name1Last, Memb.Name1First, Memb.IDMemb`;
  const oParams = {
    IDVty: aIDVty,
    IDCycStart: aIDCycStart,
  };
  const [oRows] = await Conn.wExecPrep(oSQL, oParams);

  // Structure by cycle
  // ------------------

  const oSpecs = [
    {
      NameKey: "IDCyc",
      Props: ["IDCyc", "WhenStartCyc"],
      NameChild: "Membs",
    },
    {
      Props: [
        "NoteShop",
        "QtyOrd",
        "QtyProm",
        "QtyDeliv",
        "IDMemb",
        "Name1First",
        "Name1Last",
        "Email1",
        "Phone1",
      ],
    },
  ];
  const oCycs = Struct(oRows, oSpecs);

  // Add cycle totals
  // ----------------

  for (const oCyc of oCycs) {
    oCyc.QtyOrd = 0;
    oCyc.QtyProm = 0;
    oCyc.QtyDeliv = 0;

    for (const oMemb of oCyc.Membs) {
      oCyc.QtyOrd += oMemb.QtyOrd;
      oCyc.QtyProm += oMemb.QtyProm;
      oCyc.QtyDeliv += oMemb.QtyDeliv;
    }
  }

  return oCycs;
}
