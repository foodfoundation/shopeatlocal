// QuickBooks/History.js
// ---------------------
// Safe historical backfill planning and enqueueing. This reuses the canonical
// accounting snapshots and the normal durable outbox; it never writes directly
// to QuickBooks. Jobs retain the same SourceKeys, document numbers, drift
// checks, and requestid behavior as live posting.

import { Conn, wConnNew } from "../Db.js";
import {
  DateBusiness,
  wProducersInCyc,
  wSnapshotChannelJournal,
  wSnapshotDailyPaymentJournal,
  wSnapshotMembershipJournal,
  wSnapshotProducerBill,
  wSnapshotProducerPayment,
} from "./Accounting.js";
import { wValidateSetup } from "./Bootstrap.js";
import { wQueryByDocNumber } from "./Client.js";
import {
  wAdd_Event,
  wAdd_SyncJob,
  wConnection,
  wEntityLinksFromJob,
  wSyncJobFromSourceKey,
  wUpd_ConnectionSettings,
} from "./Db.js";
import { Channels } from "./Outbox.js";

export class tHistoryMigrationError extends Error {
  constructor(aMessage, aDetails = null) {
    super(aMessage);
    this.name = "QuickBooksHistoryMigrationError";
    this.Details = aDetails;
  }
}

function intCycle(aVal, aName) {
  const oVal = Number(aVal);
  if (!Number.isInteger(oVal) || oVal <= 0)
    throw new tHistoryMigrationError(`${aName} must be a positive cycle ID.`);
  return oVal;
}

function doc(aCdTypeQuickBooksDoc, aDocNumber) {
  return { CdTypeQuickBooksDoc: aCdTypeQuickBooksDoc, DocNumber: aDocNumber };
}

function job(aData, aDocuments) {
  return { ...aData, Documents: aDocuments };
}

async function wCycles(aIDCycFrom, aIDCycTo) {
  const [oRows] = await Conn.wExecPrep(
    `SELECT IDCyc, WhenStartCyc, WhenEndCyc
		FROM Cyc
		WHERE IDCyc BETWEEN :IDCycFrom AND :IDCycTo
		ORDER BY IDCyc`,
    { IDCycFrom: aIDCycFrom, IDCycTo: aIDCycTo },
  );
  if (!oRows.length || oRows[0].IDCyc !== aIDCycFrom)
    throw new tHistoryMigrationError(`Starting cycle ${aIDCycFrom} does not exist.`);
  if (oRows[oRows.length - 1].IDCyc !== aIDCycTo)
    throw new tHistoryMigrationError(`Ending cycle ${aIDCycTo} does not exist.`);

  const oOpen = oRows.filter(o => new Date(o.WhenEndCyc) >= new Date());
  if (oOpen.length)
    throw new tHistoryMigrationError(
      `Historical migration only supports completed cycles. Cycle ${oOpen[0].IDCyc} has not ended.`,
    );
  return oRows;
}

async function wCycleJobs(aCycles) {
  const oJobs = [];
  for (const oCyc of aCycles) {
    for (const oCdChannel of Channels) {
      const oSnapshot = await wSnapshotChannelJournal(oCyc.IDCyc, oCdChannel);
      if (!oSnapshot) continue;
      oJobs.push(
        job(
          {
            CdTypeQuickBooksSyncJob: "CycChannelJournal",
            SourceKey: `cyc:${oCyc.IDCyc}:sales:${oCdChannel}`,
            IDCyc: oCyc.IDCyc,
            CdChannel: oCdChannel,
          },
          [doc("JournalEntry", oSnapshot.DocNumber)],
        ),
      );
    }

    const oMembership = await wSnapshotMembershipJournal(oCyc.IDCyc);
    if (oMembership)
      oJobs.push(
        job(
          {
            CdTypeQuickBooksSyncJob: "CycMembershipJournal",
            SourceKey: `cyc:${oCyc.IDCyc}:membership`,
            IDCyc: oCyc.IDCyc,
          },
          [doc("JournalEntry", oMembership.DocNumber)],
        ),
      );

    const oIDsProducer = await wProducersInCyc(oCyc.IDCyc);
    for (const oIDProducer of oIDsProducer) {
      const oProducer = await wSnapshotProducerBill(oCyc.IDCyc, oIDProducer);
      if (!oProducer) continue;
      const oDocuments = [];
      if (oProducer.Bill) oDocuments.push(doc("Bill", oProducer.Bill.DocNumber));
      if (oProducer.VendorCredit)
        oDocuments.push(doc("VendorCredit", oProducer.VendorCredit.DocNumber));
      oJobs.push(
        job(
          {
            CdTypeQuickBooksSyncJob: "ProducerBill",
            SourceKey: `cyc:${oCyc.IDCyc}:bill:${oIDProducer}`,
            IDCyc: oCyc.IDCyc,
            IDProducer: oIDProducer,
          },
          oDocuments,
        ),
      );
    }
  }
  return oJobs;
}

async function wPaymentJobs(aWhenStart, aWhenEnd) {
  const [oRows] = await Conn.wExecPrep(
    `SELECT IDTransact, CdTypeTransact, CdMethPay, IDProducer, WhenCreate
		FROM Transact
		WHERE WhenCreate >= :WhenStart AND WhenCreate < :WhenEnd
			AND CdTypeTransact IN ('PayRecv', 'PaySent', 'Adj')
		ORDER BY WhenCreate, IDTransact`,
    { WhenStart: aWhenStart, WhenEnd: aWhenEnd },
  );

  const oGroups = new Map();
  const oPayouts = [];
  for (const oRow of oRows) {
    if (oRow.CdTypeTransact === "PaySent" && oRow.IDProducer) {
      oPayouts.push(oRow);
      continue;
    }

    const oDateBatch = DateBusiness(oRow.WhenCreate);
    if (oRow.CdTypeTransact === "Adj") {
      oGroups.set(`adj:${oDateBatch}`, { DateBatch: oDateBatch, CdMethPay: "Adj" });
      continue;
    }
    if ((oRow.CdTypeTransact === "PayRecv" || oRow.CdTypeTransact === "PaySent") && oRow.CdMethPay)
      oGroups.set(`pay:${oDateBatch}:${oRow.CdMethPay}`, {
        DateBatch: oDateBatch,
        CdMethPay: oRow.CdMethPay,
      });
  }

  const oJobs = [];
  const oGroupsSorted = [...oGroups.entries()].sort(([aKey], [bKey]) => aKey.localeCompare(bKey));
  for (const [oSourceKey, oGroup] of oGroupsSorted) {
    // Daily journals are intentionally whole-business-date batches. The
    // cutover lower bound prevents rows before the first cycle from leaking
    // into its first date.
    const oSnapshot = await wSnapshotDailyPaymentJournal(
      oGroup.DateBatch,
      oGroup.CdMethPay,
      aWhenStart,
    );
    if (!oSnapshot) continue;
    oJobs.push(
      job(
        {
          CdTypeQuickBooksSyncJob: "DailyPaymentJournal",
          SourceKey: oSourceKey,
          DateBatch: oGroup.DateBatch,
          CdMethPay: oGroup.CdMethPay,
        },
        [doc("JournalEntry", oSnapshot.DocNumber)],
      ),
    );
  }

  // Payouts are appended after every cycle Bill/VendorCredit and every daily
  // journal, so the worker's ID ordering cannot process historical payouts
  // before their source Bills.
  for (const oRow of oPayouts) {
    const oSnapshot = await wSnapshotProducerPayment(oRow.IDTransact);
    if (!oSnapshot) continue;
    oJobs.push(
      job(
        {
          CdTypeQuickBooksSyncJob: "ProducerPayment",
          SourceKey: `transact:${oRow.IDTransact}`,
          IDProducer: oRow.IDProducer,
          IDTransact: oRow.IDTransact,
        },
        [doc("BillPayment", oSnapshot.DocNumber)],
      ),
    );
  }
  return oJobs;
}

async function wExistingAndConflicts(aJobs, aCkCheckQuickBooks, aFindDocument = wQueryByDocNumber) {
  const oConflicts = [];
  let oCtExisting = 0;

  for (const oJob of aJobs) {
    const oExisting = await wSyncJobFromSourceKey(oJob.SourceKey);
    oJob.ExistingStatus = oExisting?.CdStatusQuickBooksSyncJob || null;
    oJob.IDQuickBooksSyncJobExisting = oExisting?.IDQuickBooksSyncJob || null;
    if (oExisting) oCtExisting++;
    if (
      oExisting &&
      ["Claimed", "Blocked", "Failed", "Skipped"].includes(oExisting.CdStatusQuickBooksSyncJob)
    )
      oConflicts.push({
        SourceKey: oJob.SourceKey,
        Type: "LocalJobStatus",
        Status: oExisting.CdStatusQuickBooksSyncJob,
        Message: "Resolve or retry this existing local job before migration.",
      });

    const oLinks = oExisting ? await wEntityLinksFromJob(oExisting.IDQuickBooksSyncJob) : [];
    const oLinked = new Set(oLinks.map(o => `${o.CdTypeQuickBooksDoc}:${o.DocNumber || ""}`));

    if (!aCkCheckQuickBooks) continue;
    for (const oDocument of oJob.Documents) {
      const oKey = `${oDocument.CdTypeQuickBooksDoc}:${oDocument.DocNumber}`;
      if (oLinked.has(oKey)) continue;
      const oFound = await aFindDocument(oDocument.CdTypeQuickBooksDoc, oDocument.DocNumber);
      if (oFound)
        oConflicts.push({
          SourceKey: oJob.SourceKey,
          Type: "QuickBooksDocument",
          CdTypeQuickBooksDoc: oDocument.CdTypeQuickBooksDoc,
          DocNumber: oDocument.DocNumber,
          QuickBooksID: oFound.Id,
        });
    }
  }

  // Historical jobs must be the only runnable queue. Older unrelated rows
  // would otherwise retain lower IDs and post before this migration after
  // staff re-enables the worker.
  const oSourceKeys = new Set(aJobs.map(o => o.SourceKey));
  const [oRunnable] = await Conn.wExec(
    `SELECT IDQuickBooksSyncJob, SourceKey, CdTypeQuickBooksSyncJob,
			CdStatusQuickBooksSyncJob
		FROM QuickBooksSyncJob
		WHERE CdStatusQuickBooksSyncJob IN ('Pending', 'Claimed')
		ORDER BY IDQuickBooksSyncJob
		LIMIT 101`,
  );
  for (const oOther of oRunnable.filter(o => !oSourceKeys.has(o.SourceKey)).slice(0, 100))
    oConflicts.push({
      SourceKey: oOther.SourceKey,
      Type: "UnrelatedRunnableJob",
      Status: oOther.CdStatusQuickBooksSyncJob,
      Message: "Resolve this unrelated runnable job before staging historical migration work.",
    });

  // An already-enqueued payout is only safe when every Bill in this migration
  // already has a lower job ID (or has posted). New Bills would be inserted
  // after that payout and violate FIFO dependency order.
  for (const oPayout of aJobs.filter(
    o => o.CdTypeQuickBooksSyncJob === "ProducerPayment" && o.ExistingStatus === "Pending",
  )) {
    const oBills = aJobs.filter(
      o => o.CdTypeQuickBooksSyncJob === "ProducerBill" && o.IDProducer === oPayout.IDProducer,
    );
    const oCkUnsafe = oBills.some(
      oBill =>
        oBill.ExistingStatus !== "Posted" &&
        (!oBill.IDQuickBooksSyncJobExisting ||
          oBill.IDQuickBooksSyncJobExisting > oPayout.IDQuickBooksSyncJobExisting),
    );
    if (oCkUnsafe)
      oConflicts.push({
        SourceKey: oPayout.SourceKey,
        Type: "LocalJobOrder",
        Status: oPayout.ExistingStatus,
        Message:
          "This existing payout precedes one or more required producer Bill jobs; resolve and requeue it.",
      });
  }
  return { Conflicts: oConflicts, CtExisting: oCtExisting };
}

function countsByType(aJobs) {
  const oCounts = {};
  for (const oJob of aJobs)
    oCounts[oJob.CdTypeQuickBooksSyncJob] = (oCounts[oJob.CdTypeQuickBooksSyncJob] || 0) + 1;
  return oCounts;
}

/**
 * Builds and validates a historical migration without changing local or QBO
 * data. QBO is queried by deterministic DocNumber to reject accidental
 * duplication. Set CkCheckQuickBooks false only in automated tests.
 */
export async function wPlanHistoryMigration(aOpts) {
  const oIDCycFrom = intCycle(aOpts?.IDCycFrom, "IDCycFrom");
  const oIDCycTo = intCycle(aOpts?.IDCycTo, "IDCycTo");
  if (oIDCycTo < oIDCycFrom)
    throw new tHistoryMigrationError("IDCycTo must be greater than or equal to IDCycFrom.");

  const oConnection = await wConnection();
  if (!oConnection)
    throw new tHistoryMigrationError(
      "No authorized QuickBooks realm. Connect through the staff dashboard first.",
    );
  if (oConnection.CdStatusQuickBooksConnection !== "Connected")
    throw new tHistoryMigrationError(
      `QuickBooks connection is ${oConnection.CdStatusQuickBooksConnection}; reauthorize first.`,
    );
  if (!oConnection.CkBootstrapped)
    throw new tHistoryMigrationError("QuickBooks setup is incomplete; run bootstrap first.");

  const oSetup = await wValidateSetup();
  if (!oSetup.CkValid)
    throw new tHistoryMigrationError("QuickBooks setup mappings are incomplete.", {
      MissingRoles: oSetup.Missing,
    });

  const oCycles = await wCycles(oIDCycFrom, oIDCycTo);
  const oWhenStart = oCycles[0].WhenStartCyc;
  const oWhenEnd = oCycles[oCycles.length - 1].WhenEndCyc;
  const oJobs = [...(await wCycleJobs(oCycles)), ...(await wPaymentJobs(oWhenStart, oWhenEnd))];
  const oExisting = await wExistingAndConflicts(
    oJobs,
    aOpts.CkCheckQuickBooks !== false,
    aOpts.wFindDocument,
  );

  const oCutoverNow = oConnection.IDCycCutover ? Number(oConnection.IDCycCutover) : null;
  return {
    RealmID: oConnection.RealmID,
    EnvironmentName: oConnection.EnvironmentName,
    CompanyName: oConnection.CompanyName || null,
    IDCycFrom: oIDCycFrom,
    IDCycTo: oIDCycTo,
    CtCycles: oCycles.length,
    WhenStart: new Date(oWhenStart).toISOString(),
    WhenEnd: new Date(oWhenEnd).toISOString(),
    PaymentDateFrom: DateBusiness(oWhenStart),
    PaymentDateTo: DateBusiness(new Date(new Date(oWhenEnd).getTime() - 1)),
    CkPaymentBatchesAreWholeBusinessDates: true,
    IDCycCutoverCurrent: oCutoverNow,
    CkCutoverChangeRequired: oCutoverNow === null || oCutoverNow > oIDCycFrom,
    CkPostingEnabled: Boolean(oConnection.CkPostingEnabled),
    CtJobs: oJobs.length,
    CtJobsExisting: oExisting.CtExisting,
    CtJobsNew: oJobs.length - oExisting.CtExisting,
    CountsByType: countsByType(oJobs),
    Conflicts: oExisting.Conflicts,
    Jobs: oJobs,
  };
}

/**
 * Atomically sets an earlier cutover when explicitly requested and enqueues
 * every planned job. Posting must be disabled so the worker cannot observe a
 * partially staged migration.
 */
export async function wQueueHistoryMigration(aOpts) {
  const oPlan = await wPlanHistoryMigration(aOpts);
  if (oPlan.CkPostingEnabled)
    throw new tHistoryMigrationError(
      "Disable QuickBooks posting before staging historical migration jobs.",
    );
  if (oPlan.Conflicts.length)
    throw new tHistoryMigrationError(
      "Historical migration conflicts must be resolved before jobs can be queued.",
      { Conflicts: oPlan.Conflicts },
    );
  if (oPlan.CkCutoverChangeRequired && !aOpts.CkSetCutover)
    throw new tHistoryMigrationError(
      `The current cutover does not include cycle ${oPlan.IDCycFrom}. ` +
        "Rerun with --set-cutover after reviewing the dry run.",
    );
  if (
    aOpts.CkSetCutover &&
    oPlan.IDCycCutoverCurrent !== null &&
    oPlan.IDCycCutoverCurrent < oPlan.IDCycFrom
  )
    throw new tHistoryMigrationError(
      `The current cutover cycle ${oPlan.IDCycCutoverCurrent} is already earlier than ` +
        `${oPlan.IDCycFrom}; refusing to move it forward.`,
    );

  const oConnection = await wConnection();
  const oConn = await wConnNew();
  let oCtQueued = 0;
  try {
    await oConn.wTransact();
    const [oRowsLocked] = await oConn.wExecPrep(
      `SELECT *
			FROM QuickBooksConnection
			WHERE IDQuickBooksConnection = :ID
			FOR UPDATE`,
      { ID: oConnection.IDQuickBooksConnection },
    );
    const oConnectionLocked = oRowsLocked[0];
    if (!oConnectionLocked)
      throw new tHistoryMigrationError("The QuickBooks connection no longer exists.");
    if (oConnectionLocked.CdStatusQuickBooksConnection !== "Connected")
      throw new tHistoryMigrationError(
        "The QuickBooks connection changed while the migration was being planned.",
      );
    if (oConnectionLocked.CkPostingEnabled)
      throw new tHistoryMigrationError(
        "QuickBooks posting was enabled while the migration was being planned; no jobs were queued.",
      );
    const oCutoverLocked = oConnectionLocked.IDCycCutover
      ? Number(oConnectionLocked.IDCycCutover)
      : null;
    if (oCutoverLocked !== oPlan.IDCycCutoverCurrent && oCutoverLocked !== oPlan.IDCycFrom)
      throw new tHistoryMigrationError(
        "The cutover cycle changed while the migration was being planned; rerun the dry run.",
      );

    if (oPlan.CkCutoverChangeRequired)
      await wUpd_ConnectionSettings(
        oConnectionLocked.IDQuickBooksConnection,
        { IDCycCutover: oPlan.IDCycFrom },
        oConn,
      );

    for (const oJob of oPlan.Jobs) {
      const {
        Documents: _Documents,
        ExistingStatus: _ExistingStatus,
        IDQuickBooksSyncJobExisting: _IDExisting,
        ...oData
      } = oJob;
      if (await wAdd_SyncJob(oData, oConn)) oCtQueued++;
    }

    await wAdd_Event(
      {
        CdTypeQuickBooksEvent: "HistoryMigrationQueued",
        RealmID: oPlan.RealmID,
        Detail: {
          IDCycFrom: oPlan.IDCycFrom,
          IDCycTo: oPlan.IDCycTo,
          CtJobs: oPlan.CtJobs,
          CtJobsQueued: oCtQueued,
          CtJobsExisting: oPlan.CtJobs - oCtQueued,
          CountsByType: oPlan.CountsByType,
        },
      },
      oConn,
    );
    await oConn.wCommit();
  } catch (aErr) {
    try {
      await oConn.wRollback();
    } catch {
      // Preserve the original failure.
    }
    throw aErr;
  } finally {
    oConn.Release();
  }

  return {
    ...oPlan,
    Applied: true,
    IDCycCutover: oPlan.CkCutoverChangeRequired ? oPlan.IDCycFrom : oPlan.IDCycCutoverCurrent,
    CtJobsQueued: oCtQueued,
    CtJobsExisting: oPlan.CtJobs - oCtQueued,
  };
}
