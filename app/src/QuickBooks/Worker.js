// QuickBooks/Worker.js
// --------------------
// In-process sync worker. A non-overlapping timer plus a MySQL named lock
// ensures a single web instance claims work at a time. Jobs are claimed with
// short leases so a crashed instance's work becomes claimable again, external
// QuickBooks calls happen outside any business transaction, and terminal
// failures alert accounting by email exactly once per job.

import { wConnNew } from "../Db.js";
import { wSend } from "./../Email.js";
import { AlertEmails, CkConfigured, CkFeatureEnabled, SyncIntervalMs } from "./Config.js";
import { CdClassifyError, TextError } from "./Client.js";
import { DateBusiness } from "./Accounting.js";
import {
  wAdd_Event,
  wClaim_SyncJobs,
  wConnection,
  wUpd_ConnectionStatus,
  wUpd_SyncJob,
} from "./Db.js";
import { tValidationError, wProcessJob } from "./Post.js";

const NameLock = "shopeatlocal_quickbooks_sync";
const CtBatch = 10;
const SecLease = 300;
const CtAttemptMax = 8;

let Timer = null;
let CkTickBusy = false;
let CkAlertedConnection = false;

function msBackoff(aCtAttempt) {
  return Math.min(2 ** aCtAttempt * 30_000, 60 * 60_000);
}

async function wAlert(aSubject, aText) {
  if (!AlertEmails.length) return;
  try {
    await wSend({
      to: AlertEmails.join(", "),
      subject: `[QuickBooks sync] ${aSubject}`,
      text: aText,
    });
  } catch (aErr) {
    console.error("quickbooks_alert_email_failed", aErr);
  }
}

async function wHandleJobError(aJob, aErr) {
  const oCkValidation = aErr instanceof tValidationError;
  const oCdClass = oCkValidation ? "Validation" : CdClassifyError(aErr);
  const oText = oCkValidation ? aErr.message : TextError(aErr);
  const oCtAttempt = (aJob.CtAttempt || 0) + 1;

  if (oCdClass === "Validation") {
    // Permanent business failure: hold for accounting review, never retry
    // against the API:
    await wUpd_SyncJob(aJob.IDQuickBooksSyncJob, {
      CdStatusQuickBooksSyncJob: "Blocked",
      CtAttempt: oCtAttempt,
      WhenLeaseExpires: null,
      Error: oText,
    });
    if (!aJob.CkAlerted) {
      await wAlert(
        `Job ${aJob.IDQuickBooksSyncJob} blocked (${aJob.SourceKey})`,
        `The QuickBooks sync job '${aJob.SourceKey}' was blocked for review:\n\n${oText}`,
      );
      await wUpd_SyncJob(aJob.IDQuickBooksSyncJob, { CkAlerted: 1 });
    }
    return;
  }

  if (oCdClass === "Auth") {
    // The refresh path already marked the connection Expired when the grant
    // died; leave the job Pending so it resumes after reauthorization:
    await wUpd_SyncJob(aJob.IDQuickBooksSyncJob, {
      CdStatusQuickBooksSyncJob: "Pending",
      CtAttempt: oCtAttempt,
      WhenLeaseExpires: null,
      WhenNextRetry: new Date(Date.now() + msBackoff(oCtAttempt)),
      Error: oText,
    });
    return;
  }

  // Throttle/Transient: exponential backoff, terminal after CtAttemptMax:
  if (oCtAttempt >= CtAttemptMax) {
    await wUpd_SyncJob(aJob.IDQuickBooksSyncJob, {
      CdStatusQuickBooksSyncJob: "Failed",
      CtAttempt: oCtAttempt,
      WhenLeaseExpires: null,
      Error: oText,
    });
    if (!aJob.CkAlerted) {
      await wAlert(
        `Job ${aJob.IDQuickBooksSyncJob} failed (${aJob.SourceKey})`,
        `The QuickBooks sync job '${aJob.SourceKey}' failed after ` +
          `${oCtAttempt} attempts:\n\n${oText}`,
      );
      await wUpd_SyncJob(aJob.IDQuickBooksSyncJob, { CkAlerted: 1 });
    }
    return;
  }

  const oMsDelay =
    oCdClass === "Throttle" ? Math.max(msBackoff(oCtAttempt), 60_000) : msBackoff(oCtAttempt);
  await wUpd_SyncJob(aJob.IDQuickBooksSyncJob, {
    CdStatusQuickBooksSyncJob: "Pending",
    CtAttempt: oCtAttempt,
    WhenLeaseExpires: null,
    WhenNextRetry: new Date(Date.now() + oMsDelay),
    Error: oText,
  });
}

/** Processes one batch under the named lock. Exported for the admin UI's
 *  "run now" action and for tests. */
export async function wRunBatch() {
  const oConnection = await wConnection();
  if (!oConnection) return { Ck: false, Reason: "NotConnected" };

  if (oConnection.CdStatusQuickBooksConnection !== "Connected") {
    if (!CkAlertedConnection) {
      CkAlertedConnection = true;
      await wAlert(
        "Connection needs attention",
        `The QuickBooks connection is '${oConnection.CdStatusQuickBooksConnection}'. ` +
          "Sync is paused until a staff manager reconnects; no queued work is lost.",
      );
    }
    return { Ck: false, Reason: "ConnectionUnhealthy" };
  }
  CkAlertedConnection = false;

  if (
    oConnection.WhenRefreshTokenExpires &&
    new Date(oConnection.WhenRefreshTokenExpires) < new Date()
  ) {
    await wUpd_ConnectionStatus(oConnection.IDQuickBooksConnection, "Expired");
    return { Ck: false, Reason: "RefreshTokenExpired" };
  }

  if (!oConnection.CkPostingEnabled) return { Ck: false, Reason: "PostingDisabled" };

  // Daily batches only become claimable after their business date has ended:
  const oJobs = await wClaim_SyncJobs(CtBatch, SecLease, DateBusiness(new Date()));
  let oCtPosted = 0;
  for (const oJob of oJobs) {
    try {
      const oResult = await wProcessJob(oJob, oConnection);
      await wUpd_SyncJob(oJob.IDQuickBooksSyncJob, {
        CdStatusQuickBooksSyncJob: oResult,
        WhenLeaseExpires: null,
        WhenNextRetry: null,
        Error: null,
        ...(oResult === "Posted" ? { WhenPosted: new Date() } : {}),
      });
      if (oResult === "Posted") oCtPosted++;
    } catch (aErr) {
      console.error("quickbooks_job_error", oJob.SourceKey, aErr?.message || aErr);
      await wHandleJobError(oJob, aErr);
      // Stop the batch on auth/throttle failures; later jobs would hit the
      // same wall:
      const oCdClass = aErr instanceof tValidationError ? "Validation" : CdClassifyError(aErr);
      if (oCdClass === "Auth" || oCdClass === "Throttle") break;
    }
  }
  return { Ck: true, CtClaimed: oJobs.length, CtPosted: oCtPosted };
}

async function wTick() {
  console.log("tick tack tick tack");
  if (CkTickBusy) return;
  CkTickBusy = true;

  // The named lock is session-scoped, so hold one dedicated connection for
  // the duration of the batch:
  let oConn = null;
  try {
    oConn = await wConnNew();
    const [oLockRows] = await oConn.wExec(`SELECT GET_LOCK('${NameLock}', 0) AS Ck`);
    if (!oLockRows[0]?.Ck) return;

    try {
      console.log("running batch");
      await wRunBatch();
    } finally {
      await oConn.wExec(`SELECT RELEASE_LOCK('${NameLock}')`);
    }
  } catch (aErr) {
    console.error("quickbooks_worker_tick_error", aErr);
  } finally {
    if (oConn) oConn.Release();
    CkTickBusy = false;
  }
}

/** Starts the worker after database/site readiness. A no-op when the feature
 *  flag is off or credentials are not configured. */
export function Start() {
  if (Timer) return;
  if (!CkFeatureEnabled()) {
    console.log("QuickBooks sync worker disabled by feature flag.");
    return;
  }
  if (!CkConfigured()) {
    console.log("QuickBooks sync worker not started: credentials are not configured.");
    return;
  }
  console.log(`QuickBooks sync worker polling every ${SyncIntervalMs}ms.`);
  Timer = setInterval(wTick, SyncIntervalMs);
  Timer.unref?.();

  wAdd_Event({ CdTypeQuickBooksEvent: "WorkerStart", Detail: { SyncIntervalMs } }).catch(aErr =>
    console.error("quickbooks_worker_start_event_failed", aErr),
  );
}

/** Stops the timer. In-flight leases recover by timeout on the next start. */
export function Stop() {
  if (Timer) clearInterval(Timer);
  Timer = null;
}
