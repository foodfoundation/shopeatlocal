// EvtCyc.js
// =========
// Cycle events

import { wFill_WgtLblOrdWeb, wLockFill_ItDeliv } from "./Invt.js";
import { wExec } from "./CheckIn.js";
import { wCreate } from "./InvcProducerOnsite.js";
import { wExec as _wExec } from "./Checkout.js";
import { wSend } from "./Email.js";
import { wAdd_Transact, Conn, updateSetCycleCount, wUpd_WhenFeeMembLast } from "./Db.js";
import { TextIDCyc } from "./Util.js";
import { Site, CoopParams } from "./Site.js";
import moment from "moment";

import momentTimezone from "moment-timezone";
import { MembershipTags } from "../Cfg.js";
const { tz } = momentTimezone;

/** Passes the connection to function awExec so it can make changes within
 *  transaction aConn, then sets the phase to aCdPhaseNext and commits. If
 *  awExec is 'null', the phase will be set without performing other work. Note
 *  that the 'EndCyc' event does not use this function. */
async function wExec_EvtCyc(aConn, awExec, aCdPhaseNext) {
  console.log(`Advancing phase to '${aCdPhaseNext}'...`);

  // Another request could obtain a share lock in the wWarePhase loop just
  // before this one gets here. That would cause this task to wait, but then the
  // other would attempt to advance the phase, causing it to encounter the set
  // CkLockAdvPhase flag, release the lock, and await again at the start of the
  // loop. This task would then proceed:
  const oSQLLock = `SELECT *
		FROM StApp
		FOR UPDATE`;
  await aConn.wExecPrep(oSQLLock);

  // Handle 'phase end' event
  // ------------------------

  if (awExec) await awExec(aConn);

  // Advance phase
  // -------------

  const oSQLUpd = `UPDATE StApp
		SET CdPhaseCyc = :CdPhaseCyc`;
  const oParamsUpd = {
    CdPhaseCyc: aCdPhaseNext,
  };
  await aConn.wExecPrep(oSQLUpd, oParamsUpd);

  // No need to add an EvtApp record, the StApp_AfterUpd trigger has already
  // done it.
}

// -----------
// Cycle start
// -----------

/** Handles the 'cycle start' event, then advances to the next phase. */
export async function wExec_StartCyc(aConn, _aCycPrev, _aCycCurr, _aCycNext) {
  await wExec_EvtCyc(aConn, wClear_WgtLblOrdWeb, "StartCyc");
}

/** Deletes all web order label records. */
async function wClear_WgtLblOrdWeb(aConn) {
  console.log("~ Clearing web order label weights...");

  // This is also done at the start of gInvt.wFill_WgtLblOrdWeb. That is
  // necessary no matter what we do here, and it seems nice to have the table
  // empty at the start of the cycle, so we will keep this:
  const oSQL = "DELETE FROM WgtLblOrdWeb";
  await aConn.wExecPrep(oSQL);
}

// --------------
// Shopping start
// --------------

/** Transitions system to shopping phase */
export async function wExec_StartShop(aConn, _aCycPrev, _aCycCurr, _aCycNext) {
  await wExec_EvtCyc(aConn, null, "StartShop");
}

// ------------
// Shopping end
// ------------

/** Completes shopping phase and prepares for delivery:
 *  1. Removes empty shopping carts
 *  2. Processes member fees
 *  3. Generates web order labels
 */
export async function wExec_EndShop(aConn, _aCycPrev, _aCycCurr, _aCycNext) {
  async function owExec(aConn) {
    await wDel_CartsEmpty(aConn);
    await wAssess_FeesMemb(aConn);
    await wFill_WgtLblOrdWeb(aConn);
  }

  await wExec_EvtCyc(aConn, owExec, "EndShop");
}

/** Deletes all Cart records not referenced by ItCart, including those in other
 *  cycles. */
async function wDel_CartsEmpty(aConn) {
  console.log("~ Deleting empty carts...");

  const oSQL = `DELETE FROM Cart
		WHERE IDCart NOT IN (
			SELECT IDCart
			FROM ItCart
		)`;
  const [_oRows] = await aConn.wExecPrep(oSQL);
}

async function wAssess_FeesMemb(aConn) {
  console.log("~ Assessing member fees...");

  const oMembs = await wMembsFeeDue(aConn);
  const oTasks = oMembs.map(o => wAssess_FeeMemb(aConn, o));
  await Promise.all(oTasks);
}

/** Identifies members due for fee assessment based on:
 *  - Recent fee payment history
 *  - EBT approval status
 *  - Trial period status
 *  - Web shopping or production activity
 */
async function wMembsFeeDue(aConn) {
  // Why isn't CtMonthTrialMembNew a query parameter?: [TO DO]
  const oSQL = `SELECT
    Memb.*,
    IFNULL(zMembTags.TagIDs, CAST('[]' AS JSON)) AS TagIDs,
    IFNULL(zMembTags.Tags, CAST('[]' AS JSON)) AS Tags
		FROM Memb
		LEFT JOIN (
        SELECT
              MTA.IDMemb,
				CAST(CONCAT('[', GROUP_CONCAT(DISTINCT MTA.IDMemberTag ORDER BY MTA.IDMemberTag SEPARATOR ','), ']') AS JSON) AS TagIDs,
				CAST(CONCAT('[', GROUP_CONCAT(DISTINCT JSON_QUOTE(MT.Tag) ORDER BY MT.Tag SEPARATOR ','), ']') AS JSON) AS Tags
            FROM MemberTagAssignments AS MTA
            LEFT JOIN MemberTags AS MT ON (MT.IDMemberTag = MTA.IDMemberTag)
            GROUP BY MTA.IDMemb
    ) AS zMembTags ON (zMembTags.IDMemb = Memb.IDMemb)
		WHERE (
				WhenFeeMembLast IS NULL
				OR WhenFeeMembLast <= DATE_SUB(NOW(), INTERVAL 1 YEAR)
			)
    AND Memb.IDMemb IN (
				SELECT IDMemb
          FROM Memb
          JOIN Cart USING (IDMemb)
          JOIN ItCart USING (IDCart)
          JOIN StApp USING (IDCyc)
          WHERE ItCart.QtyProm > 0
          UNION
          SELECT Memb.IDMemb
          FROM Memb
          JOIN Producer ON Producer.IDMemb = Memb.IDMemb
          JOIN Product USING (IDProducer)
          JOIN Vty USING (IDProduct)
          JOIN ItCart USING (IDVty)
          JOIN Cart USING (IDCart)
          JOIN StApp USING (IDCyc)
          WHERE ItCart.QtyOrd > 0
    )
    AND WhenReg <= DATE_SUB(NOW(), INTERVAL ${Site.CtMonthTrialMembNew} MONTH)
    AND CkFounder IS NOT TRUE
    AND CdRegEBT != 'Approv'
		ORDER BY IDMemb`;
  const [oRows] = await aConn.wExecPrep(oSQL);
  return oRows;
}

/** Processes member fee assessment and updates payment records */
async function wAssess_FeeMemb(aConn, aMemb) {
  //const oCkInit = !aMemb.WhenFeeMembLast; //this looks like it's used to identify a new member to pay the initial 50
  let onTrial = false;
  //select IDMemb from producer
  const producerSql = `SELECT IDMemb
	FROM Producer
	WHERE IDMemb = :IDMemb`;

  const oParams = {
    IDMemb: aMemb.IDMemb,
  };
  const [producerRows] = await aConn.wExecPrep(producerSql, oParams);

  //if aMemb.IDMemb is in there, set cycles used to 2
  if (producerRows.length === 1) {
    aMemb.CyclesUsed = 2;
    await updateProducerCycleCount(aConn, aMemb.IDMemb);
  }

  const hasNoFeeMembership = !!MembershipTags.find(oMemberTag =>
    aMemb.TagIDs.includes(oMemberTag.tagId),
  )?.hasNoFee;

  if (hasNoFeeMembership) {
    console.log("membership_fee_not_assessed: has_no_fee_membership");
    return;
  }

  if (aMemb.CyclesUsed < 2) {
    onTrial = true;
    console.log("User is on trial. Updating cycle count and skipping payment.");
    await updateCycleCount(aConn, aMemb.IDMemb);
  }

  if (!onTrial) {
    let oCkInit = false;
    if (aMemb.CyclesUsed == 2 && !aMemb.WhenFeeMembLast) {
      oCkInit = true;
    }
    let oCdTransact;
    let oAmt;

    if (oCkInit) {
      oCdTransact = "FeeMembInit";
      oAmt = Site.FeeMembInit; // these values are stored in the SITE table in db
      //Add way to identify a member who's finished their trial
    } else {
      oCdTransact = "FeeMembRenew";
      oAmt = Site.FeeMembRenew;
    }

    await wAdd_Transact(aMemb.IDMemb, oCdTransact, oAmt, 0, null, null, aConn);

    await wUpd_WhenFeeMembLast(aMemb.IDMemb);
  }
}

/** Updates cycle participation count for member shopping activity */
async function updateCycleCount(aConn, aIDMemb) {
  const oSQL = `UPDATE Memb
	SET CyclesUsed = CyclesUsed + 1
	WHERE IDMemb = :IDMemb`;
  const oParams = {
    IDMemb: aIDMemb,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  if (oRows.affectedRows !== 1) throw Error("EvtCyc updateCycleCount: Cannot update cycle count");
}

/** Updates cycle participation count for producer activity */
async function updateProducerCycleCount(aConn, aIDMemb) {
  await updateSetCycleCount(aIDMemb, 2, aConn);
}

// --------------
// Delivery start
// --------------

/** Transitions system to delivery phase */
export async function wExec_StartDeliv(aConn, _aCycPrev, _aCycCurr, _aCycNext) {
  await wExec_EvtCyc(aConn, wLockFill_ItDeliv, "StartDeliv");
}

// ------------
// Delivery end
// ------------

/** Completes delivery phase and processes no-show scenarios:
 *  1. Sends notifications for missing pickups
 *  2. Processes no-show producers
 *  3. Generates producer invoices
 *  4. Updates inventory quantities
 */
export async function wExec_EndDeliv(aConn, _aCycPrev, aCycCurr, _aCycNext) {
  async function owExec(aConn) {
    await wCheckIn_ProducersNoShow(aConn);
    await wAdd_TransactInvcProducerWeb(aConn);
    await wUpd_QtysOffer(aConn);
    await wUpd_IDCycPrep(aConn);
    await sendTruancyEmails(aConn, aCycCurr);
  }

  await wExec_EvtCyc(aConn, owExec, "EndDeliv");
}

/** Sends notification emails for missed pickups */
async function sendTruancyEmails(aConn, aCycCurr) {
  const currentCyc = aCycCurr.IDCyc;
  const oSQL = `SELECT Cart.IDMemb, ItCart.QtyTruant, Vty.Size, Product.NameProduct, Producer.NameBus, Memb.Email1 FROM ItCart
	JOIN Vty USING (IDVty)
	JOIN Cart USING (IDCart)
	JOIN Product USING (IDProduct)
	JOIN Producer USING (IDProducer)
	JOIN Memb on Cart.IDMemb = Memb.IDMemb

	WHERE ItCart.QtyTruant > 0 AND Cart.IDCyc = ${currentCyc}`;
  const [oRows] = await aConn.wExecPrep(oSQL);

  for (const row of oRows) {
    const oMsg = {
      to: row.Email1,
      subject: "Item Variety Could Not Be Delivered",
      text: `Quantity: ${row.QtyTruant}, Variety: ${row.Size} of ${row.NameProduct} from ${row.NameBus} could not be delivered. You will not be charged. We apologize for the inconvenience.`,
    };
    await wSend(oMsg);
    await delay(100);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Processes check-in for no-show producers */
async function wCheckIn_ProducersNoShow(aConn) {
  console.log("~ Checking-in no-show producers...");

  const oProducers = await wLock_ProducersNoShow(aConn);
  for (const oProducer of oProducers) {
    const oData = await wExec(aConn, oProducer.IDProducer, []);
    if (oData.MsgFail)
      throw Error(`EvtCyc wCheckIn_ProducersNoShow: Check-in failed with error '${oData.MsgFail}'`);
  }
}

/** Retrieves list of no-show producers with promised items */
async function wLock_ProducersNoShow(aConn) {
  const oSQL = `SELECT DISTINCT Producer.IDProducer
		FROM ItCart
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		JOIN Producer USING (IDProducer)
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		LEFT JOIN InvcProducerWeb USING (IDCyc, IDProducer)
		WHERE InvcProducerWeb.IDInvcProducerWeb IS NULL
		FOR UPDATE`;
  const [oRows] = await aConn.wExecPrep(oSQL);
  return oRows;
}

/** Retrieves all producers with promised items */
async function _wProducersProm(aConn) {
  const oSQL = `SELECT DISTINCT Producer.IDProducer, Producer.IDMemb,
			InvcProducerWeb.IDInvcProducerWeb, InvcProducerWeb.FeeCoop,
			InvcProducerWeb.Ttl,
			StApp.IDCyc
		FROM ItCart
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		JOIN Producer USING (IDProducer)
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		LEFT JOIN InvcProducerWeb USING (IDCyc, IDProducer)`;
  const [oRows] = await aConn.wExecPrep(oSQL);
  return oRows;
}

async function wAdd_TransactInvcProducerWeb(aConn) {
  console.log("~ Adding web producer invoice transactions...");

  const oInvcs = await wInvcsProducerWeb(aConn);
  for (const oInvc of oInvcs) {
    const oAmt = -oInvc.Ttl || 0.0;
    const oOpts = {
      IDProducer: oInvc.IDProducer,
      IDCyc: oInvc.IDCyc,
      IDInvc: oInvc.IDInvcProducerWeb,
      FeeCoop: oInvc.FeeCoop,
    };
    await wAdd_Transact(oInvc.IDMemb, "EarnInvcProducerWeb", oAmt, 0.0, null, oOpts, aConn);
  }
}

/** Retrieves web producer invoices with non-zero totals */
async function wInvcsProducerWeb(aConn) {
  const oSQL = `SELECT InvcProducerWeb.IDInvcProducerWeb,
			InvcProducerWeb.FeeCoop, InvcProducerWeb.Ttl,
			StApp.IDCyc,
			Producer.IDProducer, Producer.IDMemb
		FROM InvcProducerWeb
		JOIN StApp USING (IDCyc)
		JOIN Producer USING (IDProducer)
		WHERE InvcProducerWeb.Ttl != 0`;
  const [oRows] = await aConn.wExecPrep(oSQL);
  return oRows;
}

async function wUpd_QtysOffer(aConn) {
  console.log("~ Updating variety offer quantities...");

  const oSQL = `UPDATE Vty
		JOIN (
			SELECT ItDeliv.IDVty, SUM(ItDeliv.QtyDeliv) AS QtyDeliv
			FROM ItDeliv
			JOIN StApp USING (IDCyc)
			GROUP BY ItDeliv.IDVty
		) AS zItDelivVty USING (IDVty)
		SET Vty.QtyOffer = (Vty.QtyOffer - zItDelivVty.QtyDeliv)`;
  await aConn.wExecPrep(oSQL);
}

async function wUpd_IDCycPrep(aConn) {
  console.log("~ Advancing 'prep' cycle ID...");

  const oSQL = `UPDATE StApp
		SET IDCycPrep = (IDCyc + 1)`;
  const [oRows] = await aConn.wExecPrep(oSQL);
  if (oRows.affectedRows !== 1) throw Error("EvtCyc wUpd_IDCycPrep: Cannot update prep cycle ID");
}

// ------------
// Pickup start
// ------------

/** Initiates pickup phase and prepares pickup items:
 *  1. Generates pickup records from cart data
 *  2. Processes undelivered items
 */
export async function wExec_StartPickup(aConn, _aCycPrev, _aCycCurr, _aCycNext) {
  async function owExec(aConn) {
    await wFill_ItPickup(aConn);
    await wUndeliv_ItsCart(aConn);
  }

  await wExec_EvtCyc(aConn, owExec, "StartPickup");

  // E-mail shoppers with undelivered orders
  // ---------------------------------------
  // It seems best to do this outside the event transaction.

  console.log("~ E-mailing undelivered cart shoppers...");

  const oMsgText = `We're sorry, but all the items in your ${CoopParams.CoopNameShort} order are out of stock.`;
  const oMembs = await wMembsUndeliv();
  for (const oMemb of oMembs) {
    const oMsg = {
      to: oMemb.Email1,
      subject: `Your ${CoopParams.CoopNameShort} order cannot be fulfilled`,
      text: oMsgText,
    };
    // This might be slow; is it better not to await, since we're processing a
    // cycle event?: [OPTIMIZE]
    await wSend(oMsg);
  }
}

/** Generates pickup records from delivered cart items */
async function wFill_ItPickup(aConn) {
  console.log("~ Filling pickup item table...");

  const oItsCart = await wItsCartDeliv(aConn);
  // Variable-price items are split into unit quantities:
  for (const oIt of oItsCart)
    if (oIt.CkPriceVar) {
      for (let o = 0; o < oIt.QtyDeliv; ++o) await wIns_ItPickup(aConn, oIt.IDItCart, 1);
    }
    // Fixed-price items are aggregated by variety. The query excludes zero-
    // quantity records:
    else await wIns_ItPickup(aConn, oIt.IDItCart, oIt.QtyDeliv);
}

/** Retrieves all delivered cart items for current cycle */
async function wItsCartDeliv(aConn) {
  const oSQL = `SELECT ItCart.IDItCart, ItCart.QtyDeliv,
			IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar
		FROM ItCart
		JOIN Vty USING (IDVty)
		JOIN Cart Using (IDCart)
		JOIN StApp USING (IDCyc)
		WHERE ItCart.QtyDeliv > 0`;
  const [oRows] = await aConn.wExecPrep(oSQL);
  return oRows;
}

async function wIns_ItPickup(aConn, aIDItCart, aQtyDeliv) {
  const oSQL = `INSERT INTO ItPickup (IDItCart, QtyDeliv)
		VALUES (:IDItCart, :QtyDeliv)`;
  const oParams = {
    IDItCart: aIDItCart,
    QtyDeliv: aQtyDeliv,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  return oRows;
}

/** Updates status for completely undelivered carts */
async function wUndeliv_ItsCart(aConn) {
  console.log("~ Marking undelivered carts...");

  const oSQL = `UPDATE Cart
		JOIN (
			SELECT IDCart
			FROM ItCart
			GROUP BY IDCart
			HAVING SUM(QtyDeliv) = 0
		) AS ItsCart USING (IDCart)
		JOIN StApp USING (IDCyc)
		SET CdStatCart = 'Undeliv'`;
  const [oRows] = await aConn.wExecPrep(oSQL);
  return oRows;
}

/** Retrieves shoppers with entirely undelivered orders */
async function wMembsUndeliv() {
  const oSQL = `SELECT Memb.Name1First, Memb.Name1Last, Memb.Email1
		FROM Memb
		JOIN Cart Using (IDMemb)
		JOIN StApp USING (IDCyc)
		WHERE Cart.CdStatCart = 'Undeliv'`;
  const [oRows] = await Conn.wExecPrep(oSQL);
  return oRows;
}

// ----------
// Pickup end
// ----------

/** Completes pickup phase and processes missed pickups */
export async function wExec_EndPickup(aConn, _aCycPrev, _aCycCurr, _aCycNext) {
  async function owExec(aConn) {
    await wCheckout_MembsMiss(aConn);
  }

  await wExec_EvtCyc(aConn, owExec, "EndPickup");
}

async function wCheckout_MembsMiss(aConn) {
  console.log("~ Checking-out 'missed' shoppers...");

  const oMembs = await wLock_MembsCheckoutMiss(aConn);
  const oTasks = oMembs.map(o => wCheckout_MembMiss(aConn, o.IDMemb));
  await Promise.all(oTasks);
}

async function wCheckout_MembMiss(aConn, aIDMemb) {
  const oData = await _wExec(aConn, aIDMemb, [], {}, "Miss");
  if (oData.MsgFail)
    throw Error(`EvtCyc wCheckout_MembMiss: Checkout failed with error '${oData.MsgFail}'`);
}

async function wLock_MembsCheckoutMiss(aConn) {
  const oSQL = `SELECT Memb.*
		FROM Memb
		JOIN Cart USING (IDMemb)
		JOIN StApp USING (IDCyc)
		WHERE CdStatCart = 'Pend'
		FOR SHARE`;
  const [oRows] = await aConn.wExecPrep(oSQL);
  return oRows;
}

// ---------
// Cycle end
// ---------

/** Finalizes current cycle and prepares next cycle:
 *  1. Generates producer invoices
 *  2. Updates variety prices and inventory settings
 *  3. Processes location changes
 *  4. Advances to next cycle
 */
export async function wExec_EndCyc(aConn, _aCycPrev, aCycCurr, _aCycNext) {
  const oTextIDCycNext = TextIDCyc(aCycCurr.IDCyc + 1);
  console.log(`Advancing cycle to ID ${oTextIDCycNext}...`);

  // Another request could obtain a share lock in the wWarePhase loop just
  // before this one gets here. That would cause this task to wait, but then the
  // other would attempt to advance the phase, causing it to encounter the set
  // CkLockAdvPhase flag, release the lock, and await again at the start of the
  // loop. This task would then proceed:
  const oSQLLockStApp = `SELECT *
		FROM StApp
		FOR UPDATE`;
  await aConn.wExecPrep(oSQLLockStApp);

  const oSQLLockCyc = `SELECT *
		FROM Cyc
		FOR UPDATE`;
  await aConn.wExecPrep(oSQLLockCyc);

  // Handle 'cycle end' event
  // ------------------------

  await wCreate_InvcsProducerOnsite(aConn, aCycCurr);
  await wAdd_TransactsInvcProducerOnsite(aConn, aCycCurr);
  await wUpd_PricesVty(aConn);
  await wUpd_CkInvtMgdVty(aConn);
  await wDeact_Locs(aConn);
  await wUpd_LocsLastMemb(aConn);

  // Advance cycle
  // -------------

  const oSQLUpdStApp = `UPDATE StApp
		SET IDCyc = (IDCyc + 1), CdPhaseCyc = 'PendCyc'`;
  await aConn.wExecPrep(oSQLUpdStApp);

  // Add 'next' cycle
  // ----------------

  // This assumes the existence of at least one Cyc record, and it also assumes
  // that adding a cycle equal in length to the last record produces a 'current'
  // cycle. Should that be checked?:

  //NEW APPROACH 3-29 - as long as we have the start date, just get all the times in CT and then convert
  //with moment-timezone

  //get each current cycle time, and use moment JS to calculate the next one
  //make 1 call to get all times

  const currentTimesSQL = `SELECT 
		WhenStartCyc
		FROM Cyc
		ORDER BY IDCyc DESC
		LIMIT 1`;
  let [currentTimes] = await aConn.wExecPrep(currentTimesSQL);
  console.log("current times: ", currentTimes);
  console.log(currentTimes[0].WhenStartCyc);
  let currentStartCyc = currentTimes[0].WhenStartCyc;
  var startingDate = moment(currentStartCyc).add(2, "weeks").format("YYYY-MM-DD HH:mm:ss");
  console.log("startingdate: ", startingDate);

  let newStartCycCT = moment(startingDate).format("YYYY-MM-DD 12:00:00");
  console.log("newStartCycCT: ", newStartCycCT);
  let newStartCycUTC = tz(newStartCycCT, "America/Chicago").utc().format("YYYY-MM-DD HH:mm:ss"); //.toISOString();//.format("YYYY-MM-DDTHH:mm:ss.SSSZ");
  console.log("newStartCycUTC: ", newStartCycUTC);

  let newStartShopCT = moment(startingDate).format("YYYY-MM-DD 12:00:00");
  console.log("newStartShopCT: ", newStartShopCT);
  let newStartShopUTC = tz(newStartShopCT, "America/Chicago").utc().format("YYYY-MM-DD HH:mm:ss"); //.toISOString();//.format("YYYY-MM-DDTHH:mm:ss.SSSZ");
  console.log("newStartShopUTC: ", newStartShopUTC);

  let newEndShopCT = moment(startingDate).add(1, "weeks").format("YYYY-MM-DD 23:59:00");
  console.log("newEndShopCT: ", newEndShopCT);
  let newEndShopUTC = tz(newEndShopCT, "America/Chicago").utc().format("YYYY-MM-DD HH:mm:ss"); //.toISOString();//.format("YYYY-MM-DDTHH:mm:ss.SSSZ");
  console.log("newEndShopUTC: ", newEndShopUTC);

  let newStartDelivCT = moment(newEndShopCT).add(1, "hour").format("YYYY-MM-DD HH:mm:ss");
  console.log("newStartDelivCT: ", newStartDelivCT);
  let newStartDelivUTC = tz(newStartDelivCT, "America/Chicago").utc().format("YYYY-MM-DD HH:mm:ss"); //.toISOString();//.format("YYYY-MM-DDTHH:mm:ss.SSSZ");
  console.log("newStartDelivUTC: ", newStartDelivUTC);

  let newEndDelivCT = moment(newStartDelivCT).add(3, "days").format("YYYY-MM-DD 10:45:00");
  console.log("newEndDelivCT: ", newEndDelivCT);
  let newEndDelivUTC = tz(newEndDelivCT, "America/Chicago").utc().format("YYYY-MM-DD HH:mm:ss"); //.toISOString();//.format("YYYY-MM-DDTHH:mm:ss.SSSZ");
  console.log("newEndDelivUTC: ", newEndDelivUTC);

  let newStartPickupCT = newEndDelivCT;
  console.log("newStartPickupCT: ", newStartPickupCT);
  let newStartPickupUTC = tz(newStartPickupCT, "America/Chicago")
    .utc()
    .format("YYYY-MM-DD HH:mm:ss"); //.toISOString();//.format("YYYY-MM-DDTHH:mm:ss.SSSZ");
  console.log("newStartPickupUTC: ", newStartPickupUTC);

  let newEndPickupCT = moment(newEndDelivCT).add(2, "days").format("YYYY-MM-DD 16:00:00");
  console.log("newEndPickupCT: ", newEndPickupCT);
  let newEndPickupUTC = tz(newEndPickupCT, "America/Chicago").utc().format("YYYY-MM-DD HH:mm:ss"); //.toISOString();//.format("YYYY-MM-DDTHH:mm:ss.SSSZ");
  console.log("newEndPickupUTC: ", newEndPickupUTC);

  let newEndCycCT = moment(newEndPickupCT).add(1, "days").format("YYYY-MM-DD 00:00:00");
  console.log("newEndCycCT: ", newEndCycCT);
  let newEndCycUTC = tz(newEndCycCT, "America/Chicago").utc().format("YYYY-MM-DD HH:mm:ss"); //.toISOString();//.format("YYYY-MM-DDTHH:mm:ss.SSSZ");
  console.log("newEndCycUTC: ", newEndCycUTC);

  const oSQLInsCyc = `INSERT INTO Cyc (WhenStartCyc, WhenStartShop, WhenEndShop, WhenStartDeliv,
			WhenEndDeliv, WhenStartPickup, WhenEndPickup, WhenEndCyc)
		VALUES(:newStartCycUTC, :newStartShopUTC, :newEndShopUTC, :newStartDelivUTC, 
			:newEndDelivUTC, :newStartPickupUTC, :newEndPickupUTC, :newEndCycUTC)`;
  const oParams = {
    newStartCycUTC: newStartCycUTC,
    newStartShopUTC: newStartShopUTC,
    newEndShopUTC: newEndShopUTC,
    newStartDelivUTC: newStartDelivUTC,
    newEndDelivUTC: newEndDelivUTC,
    newStartPickupUTC: newStartPickupUTC,
    newEndPickupUTC: newEndPickupUTC,
    newEndCycUTC: newEndCycUTC,
  };
  await aConn.wExecPrep(oSQLInsCyc, oParams);
}

async function wCreate_InvcsProducerOnsite(aConn, aCyc) {
  console.log("~ Generating on-site producer invoices...");

  const oProducersRetail = await wProducersOnsite(aConn, aCyc, "Retail");
  const oProducersWholesale = await wProducersOnsite(aConn, aCyc, "Wholesale");

  const oTasksInvcRetail = oProducersRetail.map(o => wCreate(aConn, aCyc, o, "Retail"));
  const oTasksInvcWholesale = oProducersWholesale.map(o => wCreate(aConn, aCyc, o, "Wholesale"));
  await Promise.all([...oTasksInvcRetail, ...oTasksInvcWholesale]);
}

/** Retrieves producers with onsite sales for specified cycle and cart type */
async function wProducersOnsite(aConn, aCyc, aCdCartType) {
  const oSQL = `SELECT DISTINCT Producer.*
		FROM CartOnsite
		JOIN ItCartOnsite USING (IDCartOnsite)
		JOIN Vty USING (IDVty)
		JOIN Product USING (IDProduct)
		JOIN Producer USING (IDProducer)
		WHERE IDCyc = :IDCyc AND CdCartType = :CdCartType
		ORDER BY Producer.IDProducer`;
  const oParams = {
    IDCyc: aCyc.IDCyc,
    CdCartType: aCdCartType,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  return oRows;
}

async function wAdd_TransactsInvcProducerOnsite(aConn, aCyc) {
  console.log("~ Adding on-site producer invoice transactions...");

  const oInvcs = await wInvcsProducerOnsite(aConn, aCyc);
  for (const oInvc of oInvcs) {
    const oAmt = -oInvc.Ttl || 0.0;
    const oOpts = {
      IDProducer: oInvc.IDProducer,
      IDCyc: oInvc.IDCyc,
      IDInvc: oInvc.IDInvcProducerOnsite,
      FeeCoop: oInvc.FeeCoop,
    };
    const oTransactType =
      oInvc.CdInvcType === "Wholesale"
        ? "EarnInvcProducerOnsiteWholesale"
        : "EarnInvcProducerOnsite";
    await wAdd_Transact(oInvc.IDMemb, oTransactType, oAmt, 0.0, null, oOpts, aConn);
  }
}

/** Retrieves onsite producer invoices for specified cycle */
async function wInvcsProducerOnsite(aConn, aCyc) {
  const oSQL = `SELECT InvcProducerOnsite.*,
			Producer.IDMemb
		FROM InvcProducerOnsite
		JOIN Producer USING (IDProducer)
		WHERE InvcProducerOnsite.IDCyc = :IDCyc`;
  const oParams = {
    IDCyc: aCyc.IDCyc,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  return oRows;
}

/** Updates variety prices for next cycle */
async function wUpd_PricesVty(aConn) {
  console.log("~ Updating variety prices...");

  const oSQL = "UPDATE Vty SET PriceNomWeb = PriceNomWebNext";
  const [_oRows] = await aConn.wExecPrep(oSQL);
}

/** Updates managed inventory flags for next cycle */
async function wUpd_CkInvtMgdVty(aConn) {
  console.log("~ Updating variety inventory management statuses...");

  const oSQL = "UPDATE Vty SET CkInvtMgd = CkInvtMgdNext";
  const [_oRows] = await aConn.wExecPrep(oSQL);
}

/** Processes location deactivation requests */
async function wDeact_Locs(aConn) {
  console.log("~ Deactivating locations...");

  const oSQL = `UPDATE Loc
		SET CkActiv = FALSE, CkReqDeactiv = FALSE
		WHERE CkReqDeactiv IS TRUE`;
  const [_oRows] = await aConn.wExecPrep(oSQL);
}

/** Updates member locations by selecting optimal central location.
 *  Selection criteria:
 *  1. Prioritizes central locations
 *  2. Prioritizes non-delivery locations
 *  3. Prioritizes active locations
 */
async function wUpd_LocsLastMemb(aConn) {
  console.log("~ Updating shopper pickup location defaults...");

  const oSQL = `UPDATE Memb
		SET CdLocLast = (
			SELECT CdLoc
			FROM Loc
			ORDER BY IF((CdTypeLoc = 'Central'), 0, 1),
				IF((CdTypeLoc != 'Deliv'), 0, 1),
				IF((CkActiv IS TRUE), 0, 1)
			LIMIT 1
		)
		WHERE CdLocLast IN (
			SELECT CdLoc
			FROM Loc
			WHERE CkActiv IS FALSE
		)`;
  const [_oRows] = await aConn.wExecPrep(oSQL);
}
