/** QuickBooks Online integration dashboard controllers
 *  @module quickbooks
 *  @description Staff dashboard for the QuickBooks connection, bootstrap and
 *  cutover controls, the sync queue, job detail with dry-run preview, retry,
 *  and reversals. Route visibility uses WareCkStaffAccts; connect, disconnect,
 *  bootstrap, cutover, and reversal actions use WareCkStaffMgr (enforced in
 *  index.js).
 */

import { Conn } from "../../Db.js";
import { CoopParams } from "../../Site.js";
import {
  AppBase,
  CkConfigured,
  CkFeatureEnabled,
  EnvironmentName,
} from "../../QuickBooks/Config.js";
import { AuthorizeUri, wDisconnect, wHandleCallback } from "../../QuickBooks/OAuth.js";
import { wBootstrap, wValidateSetup } from "../../QuickBooks/Bootstrap.js";
import {
  wAdd_Event,
  wAdd_SyncJob,
  wConnection,
  wEntityLinksFromJob,
  wEntityMaps,
  wEvents,
  wSyncJobCounts,
  wSyncJobFromID,
  wSyncJobs,
  wUpd_ConnectionSettings,
  wUpd_SyncJob,
} from "../../QuickBooks/Db.js";
import {
  wSnapshotChannelJournal,
  wSnapshotDailyPaymentJournal,
  wSnapshotMembershipJournal,
  wSnapshotProducerBill,
  wSnapshotProducerPayment,
} from "../../QuickBooks/Accounting.js";
import { wRunBatch } from "../../QuickBooks/Worker.js";

function urlDoc(aCdTypeDoc, aQuickBooksID) {
  const oPaths = {
    JournalEntry: "journal",
    Bill: "bill",
    VendorCredit: "vendorcredit",
    BillPayment: "billpayment",
  };
  return `${AppBase}/app/${oPaths[aCdTypeDoc] || "search"}?txnId=${aQuickBooksID}`;
}

async function wCycsRecent() {
  const oSQL = `SELECT IDCyc, WhenStartCyc, WhenEndCyc,
			(WhenEndCyc > NOW()) AS CkFuture
		FROM Cyc
		ORDER BY IDCyc DESC
		LIMIT 12`;
  const [oRows] = await Conn.wExec(oSQL);
  return oRows;
}

// ---------
// Dashboard
// ---------

export async function wHandGet(aReq, aResp) {
  const oConnection = await wConnection();

  aResp.locals.CkFeatureEnabled = CkFeatureEnabled();
  aResp.locals.CkConfigured = CkConfigured();
  aResp.locals.EnvironmentName = EnvironmentName;
  aResp.locals.Connection = oConnection;
  aResp.locals.CkConnected = oConnection?.CdStatusQuickBooksConnection === "Connected";

  if (oConnection) {
    const oValidation = await wValidateSetup();
    aResp.locals.CkSetupValid = oValidation.CkValid;
    aResp.locals.MissingRoles = oValidation.Missing;
    aResp.locals.EntityMaps = await wEntityMaps(oConnection.RealmID);
    aResp.locals.JobCounts = await wSyncJobCounts();
    aResp.locals.Jobs = await wSyncJobs({ Limit: 50 });
    aResp.locals.Events = await wEvents(20);
    aResp.locals.Cycs = await wCycsRecent();

    const oSQLLast = `SELECT MAX(WhenPosted) AS WhenLastPosted
			FROM QuickBooksSyncJob
			WHERE CdStatusQuickBooksSyncJob = 'Posted'`;
    const [oLastRows] = await Conn.wExec(oSQLLast);
    aResp.locals.WhenLastPosted = oLastRows[0]?.WhenLastPosted || null;
  }

  aResp.locals.Title = `${CoopParams.CoopNameShort} QuickBooks`;
  aResp.render("Cashier/quickbooks");
}

// -----
// OAuth
// -----

export async function wHandPostConnect(aReq, aResp) {
  if (!CkConfigured()) {
    aResp.Show_Flash("danger", null, "QuickBooks credentials are not configured on this server.");
    aResp.redirect(303, "/quickbooks");
    return;
  }
  const { URL: oURL, State: oState } = AuthorizeUri();
  aReq.session.QuickBooksOAuthState = oState;
  aResp.redirect(303, oURL);
}

export async function wHandGetCallback(aReq, aResp) {
  const oStateExpect = aReq.session.QuickBooksOAuthState;
  delete aReq.session.QuickBooksOAuthState;

  try {
    await wHandleCallback(
      aReq.originalUrl,
      aReq.query.state,
      oStateExpect,
      aResp.locals.CredUser.IDMemb,
    );
    aResp.Show_Flash("success", null, "QuickBooks connected.");
  } catch (aErr) {
    aReq.Err(aErr);
    aResp.Show_Flash("danger", "Could not connect QuickBooks!", aErr.message || String(aErr));
  }
  aResp.redirect(303, "/quickbooks");
}

export async function wHandPostDisconnect(aReq, aResp) {
  try {
    await wDisconnect(aResp.locals.CredUser.IDMemb);
    aResp.Show_Flash(
      "success",
      null,
      "QuickBooks disconnected. Queued sync work is retained and pauses until you reconnect.",
    );
  } catch (aErr) {
    aReq.Err(aErr);
    aResp.Show_Flash("danger", null, aErr.message || String(aErr));
  }
  aResp.redirect(303, "/quickbooks");
}

// -------------------
// Bootstrap & cutover
// -------------------

export async function wHandPostBootstrap(aReq, aResp) {
  const oCkDryRun = aReq.body.Action === "DryRun";
  try {
    const oResult = await wBootstrap({
      CkDryRun: oCkDryRun,
      IDMembStaff: aResp.locals.CredUser.IDMemb,
    });
    const oCtCreated = oResult.Steps.filter(o => o.Action === "Created").length;
    const oCtWould = oResult.Steps.filter(o => o.Action === "WouldCreate").length;
    aResp.Show_Flash(
      "success",
      null,
      oCkDryRun
        ? `Bootstrap dry run: ${oCtWould} entities would be created; the rest exist.`
        : `Bootstrap complete: ${oCtCreated} entities created, ` +
            `${oResult.Steps.length - oCtCreated} already existed.`,
    );
  } catch (aErr) {
    aReq.Err(aErr);
    aResp.Show_Flash("danger", "Bootstrap failed!", aErr.message || String(aErr));
  }
  aResp.redirect(303, "/quickbooks");
}

export async function wHandPostCutover(aReq, aResp) {
  try {
    const oConnection = await wConnection();
    if (!oConnection) throw Error("QuickBooks is not connected.");

    const oData = {};
    if (aReq.body.IDCycCutover) {
      const oIDCyc = Number(aReq.body.IDCycCutover);
      if (!Number.isInteger(oIDCyc) || oIDCyc <= 0) throw Error("Invalid cutover cycle.");
      oData.IDCycCutover = oIDCyc;
    }
    oData.CkPostingEnabled = aReq.body.CkPostingEnabled === "on";

    if (oData.CkPostingEnabled) {
      const oValidation = await wValidateSetup();
      if (!oValidation.CkValid)
        throw Error(
          `Cannot enable posting: setup is missing ${oValidation.Missing.join(", ")}. ` +
            "Run bootstrap first.",
        );
      if (!oData.IDCycCutover && !oConnection.IDCycCutover)
        throw Error("Cannot enable posting without a cutover cycle.");
    }

    await wUpd_ConnectionSettings(oConnection.IDQuickBooksConnection, oData);
    await wAdd_Event({
      CdTypeQuickBooksEvent: "SettingsChange",
      RealmID: oConnection.RealmID,
      IDMembStaffCreate: aResp.locals.CredUser.IDMemb,
      Detail: oData,
    });
    aResp.Show_Flash("success", null, "QuickBooks settings updated.");
  } catch (aErr) {
    aReq.Err(aErr);
    aResp.Show_Flash("danger", null, aErr.message || String(aErr));
  }
  aResp.redirect(303, "/quickbooks");
}

// ----------
// Sync queue
// ----------

export async function wHandPostRun(aReq, aResp) {
  try {
    const oResult = await wRunBatch();
    if (!oResult.Ck) {
      const oReasons = {
        NotConnected: "QuickBooks is not connected.",
        ConnectionUnhealthy: "The QuickBooks connection needs reauthorization.",
        RefreshTokenExpired: "The QuickBooks refresh token expired; reconnect the realm.",
        PostingDisabled: "Posting is disabled; enable it in the settings below.",
      };
      aResp.Show_Flash("warning", null, oReasons[oResult.Reason] || oResult.Reason);
    } else
      aResp.Show_Flash(
        "success",
        null,
        `Sync ran: ${oResult.CtClaimed} job(s) claimed, ${oResult.CtPosted} posted.`,
      );
  } catch (aErr) {
    aReq.Err(aErr);
    aResp.Show_Flash("danger", null, aErr.message || String(aErr));
  }
  aResp.redirect(303, "/quickbooks");
}

async function wSnapshotPreview(aJob, aConnection) {
  try {
    switch (aJob.CdTypeQuickBooksSyncJob) {
      case "CycChannelJournal":
        return await wSnapshotChannelJournal(aJob.IDCyc, aJob.CdChannel);
      case "CycMembershipJournal":
        return await wSnapshotMembershipJournal(aJob.IDCyc);
      case "DailyPaymentJournal": {
        const oDate =
          aJob.DateBatch instanceof Date
            ? aJob.DateBatch.toISOString().slice(0, 10)
            : String(aJob.DateBatch);
        const oWhenCutover = aConnection?.IDCycCutover
          ? (
              await Conn.wExecPrep(`SELECT WhenStartCyc FROM Cyc WHERE IDCyc = :IDCyc`, {
                IDCyc: aConnection.IDCycCutover,
              })
            )[0][0]?.WhenStartCyc
          : new Date(0);
        return await wSnapshotDailyPaymentJournal(
          oDate,
          aJob.CdMethPay,
          oWhenCutover || new Date(0),
        );
      }
      case "ProducerBill":
        return await wSnapshotProducerBill(aJob.IDCyc, aJob.IDProducer);
      case "ProducerPayment":
        return await wSnapshotProducerPayment(aJob.IDTransact);
      default:
        return null;
    }
  } catch (aErr) {
    return { PreviewError: aErr.message || String(aErr) };
  }
}

export async function wHandGetJob(aReq, aResp) {
  const oJob = await wSyncJobFromID(Number(aReq.params.IDJob));
  if (!oJob) {
    aResp.status(404);
    aResp.locals.Title = "Job not found";
    aResp.render("Misc/404");
    return;
  }

  const oConnection = await wConnection();
  const oLinks = await wEntityLinksFromJob(oJob.IDQuickBooksSyncJob);

  aResp.locals.Job = oJob;
  aResp.locals.PayloadText = oJob.PayloadJSON
    ? JSON.stringify(
        typeof oJob.PayloadJSON === "string" ? JSON.parse(oJob.PayloadJSON) : oJob.PayloadJSON,
        null,
        2,
      )
    : null;
  aResp.locals.Links = oLinks.map(o => ({
    ...o,
    URL: urlDoc(o.CdTypeQuickBooksDoc, o.QuickBooksID),
  }));
  aResp.locals.CkRetryable =
    oJob.CdStatusQuickBooksSyncJob === "Blocked" || oJob.CdStatusQuickBooksSyncJob === "Failed";
  aResp.locals.CkReversible = oJob.CdStatusQuickBooksSyncJob === "Posted" && oJob.PayloadJSON;

  // Dry-run preview: what this job would post right now, without posting it:
  if (oJob.CdStatusQuickBooksSyncJob !== "Posted") {
    const oPreview = await wSnapshotPreview(oJob, oConnection);
    aResp.locals.PreviewText = oPreview ? JSON.stringify(oPreview, null, 2) : null;
  }

  aResp.locals.Title = `${CoopParams.CoopNameShort} QuickBooks job`;
  aResp.render("Cashier/quickbooks-job");
}

export async function wHandPostJobRetry(aReq, aResp) {
  const oJob = await wSyncJobFromID(Number(aReq.params.IDJob));
  try {
    if (!oJob) throw Error("Job not found.");
    if (oJob.CdStatusQuickBooksSyncJob !== "Blocked" && oJob.CdStatusQuickBooksSyncJob !== "Failed")
      throw Error("Only blocked or failed jobs can be retried.");

    // Clearing the checksum accepts recalculated source totals; the persisted
    // requestid still guards against duplicate documents:
    await wUpd_SyncJob(oJob.IDQuickBooksSyncJob, {
      CdStatusQuickBooksSyncJob: "Pending",
      PayloadChecksum: null,
      CtAttempt: 0,
      WhenNextRetry: null,
      WhenLeaseExpires: null,
      Error: null,
      CkAlerted: 0,
    });
    await wAdd_Event({
      CdTypeQuickBooksEvent: "JobRetry",
      IDQuickBooksSyncJob: oJob.IDQuickBooksSyncJob,
      IDMembStaffCreate: aResp.locals.CredUser.IDMemb,
      Detail: { SourceKey: oJob.SourceKey },
    });
    aResp.Show_Flash("success", null, "Job queued for retry.");
  } catch (aErr) {
    aReq.Err(aErr);
    aResp.Show_Flash("danger", null, aErr.message || String(aErr));
  }
  aResp.redirect(303, `/quickbooks/job/${aReq.params.IDJob}`);
}

export async function wHandPostJobReverse(aReq, aResp) {
  const oJob = await wSyncJobFromID(Number(aReq.params.IDJob));
  try {
    if (!oJob) throw Error("Job not found.");
    if (oJob.CdStatusQuickBooksSyncJob !== "Posted")
      throw Error("Only posted jobs can be reversed.");
    if (
      oJob.CdTypeQuickBooksSyncJob === "ProducerBill" ||
      oJob.CdTypeQuickBooksSyncJob === "ProducerPayment"
    )
      throw Error(
        "Producer Bills and BillPayments cannot be reversed automatically; " +
          "make the correcting entry in QuickBooks.",
      );

    const oID = await wAdd_SyncJob({
      CdTypeQuickBooksSyncJob: "Reversal",
      SourceKey: `reversal:${oJob.IDQuickBooksSyncJob}`,
      IDQuickBooksSyncJobOrig: oJob.IDQuickBooksSyncJob,
    });
    if (!oID) throw Error("A reversal for this job already exists.");
    await wAdd_Event({
      CdTypeQuickBooksEvent: "ReversalEnqueue",
      IDQuickBooksSyncJob: oID,
      IDMembStaffCreate: aResp.locals.CredUser.IDMemb,
      Detail: { IDQuickBooksSyncJobOrig: oJob.IDQuickBooksSyncJob, SourceKey: oJob.SourceKey },
    });
    aResp.Show_Flash("success", null, "Reversing journal queued.");
  } catch (aErr) {
    aReq.Err(aErr);
    aResp.Show_Flash("danger", null, aErr.message || String(aErr));
  }
  aResp.redirect(303, `/quickbooks/job/${aReq.params.IDJob}`);
}
