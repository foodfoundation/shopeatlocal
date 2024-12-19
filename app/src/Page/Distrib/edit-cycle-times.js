// edit-cycle-times.js
// -------------------
// Edit Cycle Times controllers

import { Unroll, wExec, Roll, CkFail, Fill, Retry, wUpdOne } from "../../Form.js";
import { wConnNew, wCycCurr, wCycNext, wStApp, wAdd_EvtApp, Conn } from "../../Db.js";
import { DiffDays } from "../../Util.js";
import { MinLenCycDays } from "../../../Cfg.js";
import { CoopParams } from "../../Site.js";

export async function wHandGet(aReq, aResp) {
  //this is the GET when the page is called
  aResp.locals.Title = `${CoopParams.CoopNameShort} edit cycle times`;

  aResp.locals.WhenNow = new Date();

  //By default, aReq.Work is undefined, and it uses aResp.locals.CycCurr and CycNext

  if (aReq.Work.Cycs) {
    aResp.locals.Cycs = aReq.Work.Cycs; //not sure what Work is
  } else {
    aResp.locals.Cycs = [
      //
      aResp.locals.CycCurr,
      aResp.locals.CycNext,
    ];
  }

  /*
  aResp.locals.CycCurr is the first object in the array
      IDCyc: 293, //the cycle #
    WhenStartCyc: 2021-10-04T00:00:00.000Z,
    WhenStartShop: 2021-10-04T11:00:00.000Z,
    WhenEndShop: 2021-10-17T17:00:00.000Z,
    WhenStartDeliv: 2021-10-17T18:00:00.000Z,
    WhenEndDeliv: 2021-10-21T15:30:00.000Z,
    WhenStartPickup: 2021-10-21T15:30:00.000Z,
    WhenEndPickup: 2021-10-23T21:00:00.000Z,
    WhenEndCyc: 2021-10-24T05:00:00.000Z,
    z: 1, //not sure what this does
    IDCycPrep: 293, // not sure what this does, seems the same as idcyc
    CdPhaseCyc: 'StartShop', //current phase
    CkDisabTrig: 0 //not sure what this does

  aResp.locals.CycNext is the second object in the array
    IDCyc: 294, //the cycle #
    WhenStartCyc: 2021-10-24T05:00:00.000Z, //cycle start
    WhenStartShop: 2021-10-24T16:00:00.000Z, // shop start
    WhenEndShop: 2021-11-06T22:00:00.000Z, // shop end
    WhenStartDeliv: 2021-11-06T23:00:00.000Z, // delivery start
    WhenEndDeliv: 2021-11-10T20:30:00.000Z, // delivery end
    WhenStartPickup: 2021-11-10T20:30:00.000Z, // pickup start
    WhenEndPickup: 2021-11-13T02:00:00.000Z, //pickup end
    WhenEndCyc: 2021-11-13T10:00:00.000Z //cycle end

  */
  const oNow = new Date();
  // Disable past cycle time inputs. The view data is structured, so the flag
  // must be added to a specific record:
  const oDataCycCurr = aResp.locals.Cycs[0]; //set to the current cycle object

  const oNamesPhase = [
    "StartCyc",
    "StartShop",
    "EndShop",
    "StartDeliv",
    "EndDeliv",
    "StartPickup",
    "EndPickup",
  ]; //array of cycle phase names/date entries
  oNamesPhase.forEach(oName => {
    // Use the database value to determine whether the time has passed, not the
    // value returned with a validation failure:
    if (aResp.locals.CycCurr["When" + oName] <= oNow)
      //loops through each of the phase names, to find the ones where the date is in the past
      oDataCycCurr["CkPast" + oName] = true; //if the date is int he past, it sets a new field in the object called CkPast+name to true
  });

  aResp.render("Distrib/edit-cycle-times"); //I think this renders the handlebar/view
}

export async function wHandPost(aReq, aResp) {
  //this is the POST when data is submitted to the form on the page
  const oConn = await wConnNew();
  await oConn.wTransact();
  try {
    // We can't trust the data in aResp.locals, so we must re-query some values.

    // Field-level validation
    // ----------------------

    const oFlds = {
      // The 'current' start will not be updated, but the 'next' will. Those
      // must be distinguished below, as setting 'Store' here would affect both:
      WhenStartCyc: { CkRequire: true, Valid: false, Collect: "Cycs" },
      WhenStartShop: { CkRequire: true, Valid: false, Collect: "Cycs" },
      WhenEndShop: { CkRequire: true, Valid: false, Collect: "Cycs" },
      WhenStartDeliv: { CkRequire: true, Valid: false, Collect: "Cycs" },
      WhenEndDeliv: { CkRequire: true, Valid: false, Collect: "Cycs" },
      WhenStartPickup: { CkRequire: true, Valid: false, Collect: "Cycs" },
      WhenEndPickup: { CkRequire: true, Valid: false, Collect: "Cycs" },
      WhenEndCyc: { CkRequire: true, Valid: false, Collect: "Cycs" },
    };

    const oFldsUnroll = Unroll(aReq.body, oFlds);
    await wExec(aReq.body, oFldsUnroll);
    const oFldsRoll = Roll(oFldsUnroll);

    // If no cycles appear in the page, this array won't even be defined:
    if (!oFldsRoll.Cycs) {
      aResp.status(400);
      aResp.render("Misc/400");

      await oConn.wRollback();
      return;
    }

    // Verify cycle IDs
    // ----------------
    // A new cycle could have started while the page was displayed.

    const oCycCurr = await wCycCurr(oConn);
    const oFldsCycCurr = oFldsRoll.Cycs[oCycCurr.IDCyc];

    const oCycNext = await wCycNext(oConn);
    const oFldsCycNext = oFldsRoll.Cycs[oCycNext.IDCyc];

    if (!oFldsCycCurr || !oFldsCycNext) {
      aResp.status(400);
      aResp.locals.Msg = "That cycle data is out of date. Refresh the page and try again.";
      aResp.render("Misc/400");

      await oConn.wRollback();
      return;
    }

    // Discard 'passed' times
    // ----------------------
    // The phase may have advanced while the page was displayed. If so, the end
    // time of that phase must be deleted from the form data, otherwise it could
    // be increased, which would cause the cycle event to be fired twice.
    //
    // The possibility that the cycle end passed has already been ruled out.

    const oStApp = await wStApp(oConn);
    switch (oStApp.CdPhaseCyc) {
      // Fall through in each case to delete earlier phase times as well:
      case "EndPickup":
        delete oFldsCycCurr.WhenEndPickup;
      case "StartPickup":
        delete oFldsCycCurr.WhenStartPickup;
      case "EndDeliv":
        delete oFldsCycCurr.WhenEndDeliv;
      case "StartDeliv":
        delete oFldsCycCurr.WhenStartDeliv;
      case "EndShop":
        delete oFldsCycCurr.WhenEndShop;
      case "StartShop":
        delete oFldsCycCurr.WhenStartShop;
      case "StartCyc":
        delete oFldsCycCurr.WhenStartCyc;
      case "PendCyc":
        break;
      default:
        throw Error("edit-cycle-times wHandPost: Invalid cycle phase code");
    }

    // Form-level validation
    // ---------------------

    // When values are missing (and therefore null) we don't want to overwrite
    // CkRequire messages with comparison messages:
    if (!CkFail(oFldsRoll, "Cycs")) {
      // It is necessary to combine these because past times are discarded in
      // the form (and are not meant to be updated) yet those times are still
      // used when validating:
      const oCycCurrJoin = { ...oCycCurr };
      Fill(oCycCurrJoin, oFldsCycCurr);
      oCycCurrJoin.Flds = oFldsCycCurr;

      // It should not be possible for any 'next' time to have passed, but we
      // will use the same pattern:
      const oCycNextJoin = { ...oCycNext };
      Fill(oCycNextJoin, oFldsCycNext);
      oCycNextJoin.Flds = oFldsCycNext;
      [oCycCurrJoin, oCycNextJoin].forEach(aCyc => {
        if (aCyc.WhenStartShop < aCyc.WhenStartCyc)
          aCyc.Flds.WhenStartShop.MsgFail =
            "The shopping start must equal or exceed the cycle start.";

        if (aCyc.WhenEndShop <= aCyc.WhenStartShop)
          aCyc.Flds.WhenEndShop.MsgFail = "The shopping end must exceed the shopping start.";

        if (aCyc.WhenStartDeliv < aCyc.WhenEndShop)
          aCyc.Flds.WhenStartDeliv.MsgFail =
            "The delivery start must equal or exceed the shopping end.";

        if (aCyc.WhenEndDeliv <= aCyc.WhenStartDeliv)
          aCyc.Flds.WhenEndPickup.MsgFail = "The delivery end must exceed the pickup start.";

        if (aCyc.WhenStartPickup < aCyc.WhenEndDeliv)
          aCyc.Flds.WhenStartPickup.MsgFail =
            "The pickup start must equal or exceed the delivery end.";

        if (aCyc.WhenEndPickup <= aCyc.WhenStartPickup)
          aCyc.Flds.WhenEndPickup.MsgFail = "The pickup end must exceed the pickup start.";

        if (aCyc.WhenEndCyc < aCyc.WhenEndPickup)
          aCyc.Flds.WhenEndCyc.MsgFail = "The cycle end must equal or exceed the pickup end.";

        const oLenCycDays = DiffDays(aCyc.WhenEndCyc, aCyc.WhenStartCyc);
        if (oLenCycDays < MinLenCycDays)
          aCyc.Flds.WhenEndCyc.MsgFail = `The cycle must be at least ${MinLenCycDays} days long.`;
      });

      /*if (oCycNextJoin.WhenStartCyc.getTime()
        !== oCycCurrJoin.WhenEndCyc.getTime())
        oCycNextJoin.Flds.WhenStartCyc.MsgFail
          = "The 'next' start time must match the 'current' end time.";*/
    }

    // Handle validation failure
    // -------------------------

    if (CkFail(oFldsRoll, "Cycs")) {
      // Don't forward the form entries or validation messages here:
      Retry(aResp);

      // Let's not modify the originals:
      const oCycCurrWork = { ...oCycCurr };
      Fill(oCycCurrWork, oFldsCycCurr);

      const oCycNextWork = { ...oCycNext };
      Fill(oCycNextWork, oFldsCycNext);

      // Return the data to its 'record' form:
      aReq.Work.Cycs = [oCycCurrWork, oCycNextWork];
      wHandGet(aReq, aResp);

      await oConn.wRollback();
      return;
    }

    // Update cycles
    // -------------

    await wAdd_EvtApp("EditCycTime", null, null, aReq.user.IDMemb, oConn);

    // Could lock just the last two, but who knows:
    const oSQL = "SELECT * FROM Cyc FOR UPDATE";
    await oConn.wExecPrep(oSQL);

    for (const oIDCyc in oFldsRoll.Cycs) {
      const oFldsCyc = oFldsRoll.Cycs[oIDCyc];
      await wUpdOne("Cyc", "IDCyc", oIDCyc, oFldsCyc, {}, oConn);
    }

    // We could update the start time of the cycle that follows 'next', if any:
    //
    //   await wUpd_StartCycNext(oCycNext.IDCyc,
    //     oFldsCycNext.WhenEndCyc.ValCook);
    //
    // but that could cause constraint failures within that record. It's
    // difficult to solve that problem without displaying all future records in
    // the view, which is feasible, but not what I want to do right now. I can't
    // think of any reason to have more than one record after the current, so I
    // will have gDb.wCycNext throw if more than one is found.

    // Display updated values
    // ----------------------

    const oHead = "The cycles have been updated.";
    const oMsg =
      "However, any of the original times that passed while the " +
      "page was open have <strong>not</strong> been changed. Please check " +
      "the values before you go.";
    aResp.Show_Flash("success", oHead, oMsg);

    // Seems best to show this page with the updated values:
    aResp.redirect(303, "/edit-cycle-times");

    await oConn.wCommit();
  } catch (aErr) {
    await oConn.wRollback();
    // So that the pipline exception handler sends the usual 500 response:
    throw aErr;
  } finally {
    oConn.Release();
  }
}

/** Sets the start time of the cycle that immediately follows aIDCyc. */
async function _wUpd_StartCycNext(aIDCycPrev, aWhenStartCyc) {
  const oSQL = `UPDATE Cyc
		SET WhenStartCyc = :WhenEndCyc
		WHERE IDCyc > :IDCyc
		ORDER BY IDCyc
		LIMIT 1`;

  const oData = {
    IDCyc: aIDCycPrev,
    WhenEndCyc: aWhenStartCyc,
  };

  // There probably isn't a 'next' record, no need to check for success:
  await Conn.wExecPrep(oSQL, oData);
}

//TODO
//create function that advances to the next cycle
//create function that allows a "quick jump" between the cycles
