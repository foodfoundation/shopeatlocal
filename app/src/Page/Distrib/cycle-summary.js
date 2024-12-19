// cycle-summary.js
// ----------------
// Cycle Summary page controllers

import { Conn } from "../../Db.js";
import { WgtEst } from "../../Util.js";
import { CoopParams } from "../../Site.js";

import _ from "lodash";
const { round } = _;

export async function wHandGet(aReq, aResp) {
  aResp.locals.CtShop = await wCtShop();

  // Get quantities and sale amounts
  // -------------------------------

  const oNamesQty = ["Ord", "Withdr", "Prom", "Truant", "Deliv", "Lost", "Reject", "Sold"];
  for (const oName of oNamesQty)
    aResp.locals["Stat" + oName] = {
      Qty: 0,
      SaleNom: 0,
    };

  // We don't need to estimate the delivery item weights, but getting actual
  // delivered weights would require another query. I doubt anyone cares:
  const oItsCart = await wItsCart();
  for (const oIt of oItsCart)
    for (const oName of oNamesQty) {
      const oStat = aResp.locals["Stat" + oName];

      const oNameQty = "Qty" + oName;
      oStat.Qty += oIt[oNameQty] || 0;
      oStat.SaleNom += SaleNom(oIt, oNameQty);
    }

  aResp.locals.StatCheckin = {
    Qty: aResp.locals.StatProm.Qty - aResp.locals.StatTruant.Qty - aResp.locals.StatDeliv.Qty,
    SaleNom:
      aResp.locals.StatProm.SaleNom -
      aResp.locals.StatTruant.SaleNom -
      aResp.locals.StatDeliv.SaleNom,
  };

  aResp.locals.StatCheckout = {
    Qty:
      aResp.locals.StatDeliv.Qty -
      aResp.locals.StatLost.Qty -
      aResp.locals.StatReject.Qty -
      aResp.locals.StatSold.Qty,
    SaleNom:
      aResp.locals.StatDeliv.SaleNom -
      aResp.locals.StatLost.SaleNom -
      aResp.locals.StatReject.SaleNom -
      aResp.locals.StatSold.SaleNom,
  };
  // The difference between the estimated and actual values could otherwise show
  // up here at the end of pickup:
  if (!aResp.locals.StatCheckout.Qty) aResp.locals.StatCheckout.SaleNom = 0;

  aResp.locals.StatProm.Percent = aResp.locals.StatProm.Qty / aResp.locals.StatOrd.Qty || 0;
  aResp.locals.StatWithdr.Percent = aResp.locals.StatWithdr.Qty / aResp.locals.StatOrd.Qty || 0;

  aResp.locals.StatCheckin.Percent = aResp.locals.StatCheckin.Qty / aResp.locals.StatProm.Qty || 0;
  aResp.locals.StatDeliv.Percent = aResp.locals.StatDeliv.Qty / aResp.locals.StatProm.Qty || 0;
  aResp.locals.StatTruant.Percent = aResp.locals.StatTruant.Qty / aResp.locals.StatProm.Qty || 0;

  aResp.locals.StatCheckout.Percent =
    aResp.locals.StatCheckout.Qty / aResp.locals.StatDeliv.Qty || 0;
  aResp.locals.StatLost.Percent = aResp.locals.StatLost.Qty / aResp.locals.StatDeliv.Qty || 0;
  aResp.locals.StatReject.Percent = aResp.locals.StatReject.Qty / aResp.locals.StatDeliv.Qty || 0;
  aResp.locals.StatSold.Percent = aResp.locals.StatSold.Qty / aResp.locals.StatDeliv.Qty || 0;

  aResp.locals.StatOrd.Name = "ordered";
  aResp.locals.StatWithdr.Name = "withdrawn";
  aResp.locals.StatProm.Name = "promised";
  aResp.locals.StatCheckin.Name = "to check-in";
  aResp.locals.StatTruant.Name = "truant";
  aResp.locals.StatDeliv.Name = "delivered";
  aResp.locals.StatCheckout.Name = "to checkout";
  aResp.locals.StatLost.Name = "lost";
  aResp.locals.StatReject.Name = "rejected";
  aResp.locals.StatSold.Name = "sold";

  aResp.locals.StatOrd.CkEstim = true;
  aResp.locals.StatWithdr.CkEstim = true;
  aResp.locals.StatProm.CkEstim = true;
  aResp.locals.StatCheckin.CkEstim = true;
  aResp.locals.StatTruant.CkEstim = true;
  aResp.locals.StatDeliv.CkEstim = true;
  aResp.locals.StatCheckout.CkEstim = true;
  aResp.locals.StatLost.CkEstim = true;
  aResp.locals.StatReject.CkEstim = true;

  // Render page
  // -----------

  aResp.locals.Title = `${CoopParams.CoopNameShort} cycle summary`;
  aResp.render("Distrib/cycle-summary");
}

function SaleNom(aIt, aNameQty) {
  // We can't use the SaleNom function in Util because the rules for selecting
  // quantity and weight fields do not apply here. In particular, the WgtTtlSold
  // field applies only when compiling 'Sold' stats. Other stats must be
  // derived from estimated weights.

  const oQty = aIt[aNameQty];

  let oFac;
  switch (aNameQty) {
    case "Sold":
      oFac = aIt.WgtTtlSold;
      break;

    default:
      if (aIt.CkPriceVar) oFac = WgtEst(aIt) * oQty;
      else oFac = oQty;
      break;
  }
  return round(oFac * aIt.PriceNomWeb, 2);
}

async function wCtShop() {
  const oSQL = `SELECT COUNT(DISTINCT Cart.IDMemb) AS Ct
		FROM Cart
		JOIN StApp USING (IDCyc)
		JOIN ItCart USING (IDCart)`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  if (oRows.length !== 1) throw Error("cycle-summary wCtShop: Cannot get shopper count");
  return oRows[0].Ct;
}

async function _wQtysItCart() {
  const oSQL = `SELECT SUM(ItCart.QtyOrd) AS QtyOrd,
			SUM(ItCart.QtyProm) AS QtyProm,
			SUM(ItCart.QtyWithdr) AS QtyWithdr
		FROM ItCart
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  return oRows;
}

async function wItsCart() {
  // Weighted records in ItPickup have unit quantities, so there is no need to
  // multiply by the quantity:
  const oSQL = `SELECT ItCart.IDItCart,
			ItCart.QtyOrd, ItCart.QtyProm, ItCart.QtyWithdr,
			ItCart.QtyDeliv, ItCart.QtyTruant,
			ItCart.QtyLost, ItCart.QtyReject, ItCart.QtySold,
			Vty.WgtMin, Vty.WgtMax, Vty.PriceNomWeb,
			IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
			SUM(IFNULL(ItPickup.WgtPer, 0)) AS WgtTtlSold
		FROM ItCart
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		JOIN Vty USING (IDVty)
		LEFT JOIN ItPickup USING (IDItCart)
		GROUP BY ItCart.IDItCart`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  return oRows;
}
