// QuickBooks/Post.js
// ------------------
// Turns claimed sync jobs into QuickBooks documents: channel and membership
// journals, daily payment journals, producer Bills plus fee VendorCredits,
// FIFO BillPayments, and reversing journals. Runs preflight validation first;
// validation failures throw tValidationError so the worker holds the job as
// 'Blocked' for accounting review instead of retrying.

import { randomUUID } from "node:crypto";
import { Conn } from "../Db.js";
import {
  AllocatePayment,
  ChecksumFromPayload,
  SnapshotReversalJournal,
  wSnapshotChannelJournal,
  wSnapshotDailyPaymentJournal,
  wSnapshotMembershipJournal,
  wSnapshotProducerBill,
  wSnapshotProducerPayment,
  CdRoleClearing,
} from "./Accounting.js";
import { wCreate, wQueryByDocNumber } from "./Client.js";
import { wEnsureVendor } from "./Bootstrap.js";
import {
  wAdd_EntityLink,
  wAdd_Event,
  wEntityLinksFromJob,
  wEntityMap,
  wProducerOpenDocs,
  wSyncJobFromID,
  wUpd_SyncJob,
} from "./Db.js";

/** A permanent business/validation failure: the job must be blocked for
 *  review, never retried against the API. */
export class tValidationError extends Error {}

async function wRoleID(aRealmID, aCdRole, aLocalKey = "") {
  const oMap = await wEntityMap(aRealmID, aCdRole, aLocalKey);
  if (!oMap)
    throw new tValidationError(
      `Missing QuickBooks mapping for '${aCdRole}${aLocalKey ? ":" + aLocalKey : ""}'. ` +
        "Run bootstrap, then retry.",
    );
  return oMap.QuickBooksID;
}

// ------------------
// Document builders
// ------------------

async function wJournalBody(aRealmID, aSnapshot) {
  const oLines = [];
  for (const oLine of aSnapshot.Lines) {
    const oDetail = {
      PostingType: oLine.PostingType,
      AccountRef: { value: await wRoleID(aRealmID, oLine.CdRoleAcct) },
    };
    if (oLine.CdRoleClass) oDetail.ClassRef = { value: await wRoleID(aRealmID, oLine.CdRoleClass) };
    if (oLine.CdRoleEntity)
      oDetail.Entity = {
        Type: "Customer",
        EntityRef: { value: await wRoleID(aRealmID, oLine.CdRoleEntity) },
      };
    oLines.push({
      Description: oLine.Desc,
      Amount: oLine.Amt,
      DetailType: "JournalEntryLineDetail",
      JournalEntryLineDetail: oDetail,
    });
  }
  return {
    DocNumber: aSnapshot.DocNumber,
    TxnDate: aSnapshot.TxnDate,
    PrivateNote: aSnapshot.Memo,
    Line: oLines,
  };
}

async function wExpenseLines(aRealmID, aLines) {
  const oLines = [];
  for (const oLine of aLines)
    oLines.push({
      Description: oLine.Desc,
      Amount: oLine.Amt,
      DetailType: "AccountBasedExpenseLineDetail",
      AccountBasedExpenseLineDetail: {
        AccountRef: { value: await wRoleID(aRealmID, oLine.CdRoleAcct) },
        ...(oLine.CdRoleClass
          ? { ClassRef: { value: await wRoleID(aRealmID, oLine.CdRoleClass) } }
          : {}),
      },
    });
  return oLines;
}

// -------------------------------
// Idempotent single-document post
// -------------------------------

/** Creates one document unless it already exists. Order of defense:
 *  1. an existing entity link for this job and type short-circuits;
 *  2. a QBO document with the deterministic DocNumber is adopted (covers
 *     writes applied before an ambiguous timeout);
 *  3. otherwise create with the job's persistent requestid. */
async function wPostDoc(
  aJob,
  aRealmID,
  aCdTypeDoc,
  aDocNumber,
  aBody,
  aAmtTotal,
  aRequestIDSuffix,
) {
  const oLinks = await wEntityLinksFromJob(aJob.IDQuickBooksSyncJob);
  const oExisting = oLinks.find(o => o.CdTypeQuickBooksDoc === aCdTypeDoc);
  if (oExisting) return { QuickBooksID: oExisting.QuickBooksID, CkCreated: false };

  const oFound = await wQueryByDocNumber(aCdTypeDoc, aDocNumber);
  if (oFound) {
    await wAdd_EntityLink({
      IDQuickBooksSyncJob: aJob.IDQuickBooksSyncJob,
      RealmID: aRealmID,
      CdTypeQuickBooksDoc: aCdTypeDoc,
      QuickBooksID: oFound.Id,
      DocNumber: aDocNumber,
      AmtTotal: aAmtTotal,
    });
    return { QuickBooksID: oFound.Id, CkCreated: false };
  }

  const oCreated = await wCreate(aCdTypeDoc, aBody, `${aJob.RequestID}${aRequestIDSuffix || ""}`);
  await wAdd_EntityLink({
    IDQuickBooksSyncJob: aJob.IDQuickBooksSyncJob,
    RealmID: aRealmID,
    CdTypeQuickBooksDoc: aCdTypeDoc,
    QuickBooksID: oCreated.Id,
    DocNumber: aDocNumber,
    AmtTotal: aAmtTotal,
  });
  return { QuickBooksID: oCreated.Id, CkCreated: true };
}

// ----------
// Preflight
// ----------

async function wWhenCutover(aConnection) {
  if (!aConnection.IDCycCutover)
    throw new tValidationError("No cutover cycle is set; select one before posting.");
  const oSQL = `SELECT WhenStartCyc
		FROM Cyc
		WHERE IDCyc = :IDCyc`;
  const [oRows] = await Conn.wExecPrep(oSQL, { IDCyc: aConnection.IDCycCutover });
  if (!oRows.length) throw new tValidationError("The configured cutover cycle does not exist.");
  return oRows[0].WhenStartCyc;
}

function ckPreCutover(aJob, aConnection, aWhenCutover) {
  if (aJob.IDCyc) return aJob.IDCyc < aConnection.IDCycCutover;
  if (aJob.DateBatch) {
    const oDate =
      aJob.DateBatch instanceof Date
        ? aJob.DateBatch.toISOString().slice(0, 10)
        : String(aJob.DateBatch);
    return new Date(`${oDate}T23:59:59Z`) < new Date(aWhenCutover);
  }
  return false;
}

/** Recomputes the snapshot and confirms source totals have not drifted from
 *  the payload the job stored on a previous attempt. */
function ckDrift(aJob, aPayload) {
  if (!aJob.PayloadChecksum) return false;
  return aJob.PayloadChecksum !== ChecksumFromPayload(aPayload);
}

function dateBatchText(aJob) {
  return aJob.DateBatch instanceof Date
    ? aJob.DateBatch.toISOString().slice(0, 10)
    : String(aJob.DateBatch);
}

// -------------
// Job processor
// -------------

/** Processes one claimed job end to end. Returns 'Posted' or 'Skipped'.
 *  Throws tValidationError for permanent business failures and SDK errors for
 *  retryable API failures. The caller (Worker.js) owns status transitions. */
export async function wProcessJob(aJob, aConnection) {
  const oRealmID = aConnection.RealmID;
  const oWhenCutover = await wWhenCutover(aConnection);

  // Pre-cutover records are suppressed, not posted:
  if (ckPreCutover(aJob, aConnection, oWhenCutover)) return "Skipped";
  if (!aConnection.CkBootstrapped)
    throw new tValidationError("QuickBooks setup is incomplete; run bootstrap first.");

  // Build the snapshot for this job type:
  let oPayload;
  switch (aJob.CdTypeQuickBooksSyncJob) {
    case "CycChannelJournal":
      oPayload = await wSnapshotChannelJournal(aJob.IDCyc, aJob.CdChannel);
      break;
    case "CycMembershipJournal":
      oPayload = await wSnapshotMembershipJournal(aJob.IDCyc);
      break;
    case "DailyPaymentJournal":
      oPayload = await wSnapshotDailyPaymentJournal(
        dateBatchText(aJob),
        aJob.CdMethPay,
        oWhenCutover,
      );
      break;
    case "ProducerBill":
      oPayload = await wSnapshotProducerBill(aJob.IDCyc, aJob.IDProducer);
      break;
    case "ProducerPayment":
      oPayload = await wSnapshotProducerPayment(aJob.IDTransact);
      break;
    case "Reversal": {
      const oJobOrig = await wSyncJobFromID(aJob.IDQuickBooksSyncJobOrig);
      if (!oJobOrig || oJobOrig.CdStatusQuickBooksSyncJob !== "Posted")
        throw new tValidationError("The job to reverse is missing or was never posted.");
      const oPayloadOrig =
        typeof oJobOrig.PayloadJSON === "string"
          ? JSON.parse(oJobOrig.PayloadJSON)
          : oJobOrig.PayloadJSON;
      oPayload = SnapshotReversalJournal(oPayloadOrig, oJobOrig.IDQuickBooksSyncJob);
      break;
    }
    default:
      throw new tValidationError(`Unknown job type '${aJob.CdTypeQuickBooksSyncJob}'.`);
  }

  if (!oPayload) return "Skipped";

  if (ckDrift(aJob, oPayload))
    throw new tValidationError(
      "Source totals changed since this job was first attempted. " +
        "Review the discrepancy, then clear and retry the job.",
    );

  // Persist the payload, checksum, and idempotency root before any API write
  // so retries reuse the identical requestid:
  const oRequestID = aJob.RequestID || randomUUID();
  await wUpd_SyncJob(aJob.IDQuickBooksSyncJob, {
    RequestID: oRequestID,
    PayloadJSON: oPayload,
    PayloadChecksum: ChecksumFromPayload(oPayload),
  });
  aJob.RequestID = oRequestID;

  // Post the document(s):
  if (
    aJob.CdTypeQuickBooksSyncJob === "CycChannelJournal" ||
    aJob.CdTypeQuickBooksSyncJob === "CycMembershipJournal" ||
    aJob.CdTypeQuickBooksSyncJob === "DailyPaymentJournal" ||
    aJob.CdTypeQuickBooksSyncJob === "Reversal"
  ) {
    const oBody = await wJournalBody(oRealmID, oPayload);
    await wPostDoc(
      aJob,
      oRealmID,
      "JournalEntry",
      oPayload.DocNumber,
      oBody,
      oPayload.Lines.filter(o => o.PostingType === "Debit").reduce((oSum, o) => oSum + o.Amt, 0),
    );
  } else if (aJob.CdTypeQuickBooksSyncJob === "ProducerBill") {
    const oVendor = await wEnsureVendor(aJob.IDProducer);
    const oIDAcctAP = await wRoleID(oRealmID, "AcctAP");

    if (oPayload.Bill) {
      const oBody = {
        DocNumber: oPayload.Bill.DocNumber,
        TxnDate: oPayload.TxnDate,
        VendorRef: { value: oVendor.QuickBooksID },
        APAccountRef: { value: oIDAcctAP },
        PrivateNote: oPayload.Memo,
        Line: await wExpenseLines(oRealmID, oPayload.Bill.Lines),
      };
      await wPostDoc(
        aJob,
        oRealmID,
        "Bill",
        oPayload.Bill.DocNumber,
        oBody,
        oPayload.Bill.Total,
        "-b",
      );
    }
    if (oPayload.VendorCredit) {
      const oBody = {
        DocNumber: oPayload.VendorCredit.DocNumber,
        TxnDate: oPayload.TxnDate,
        VendorRef: { value: oVendor.QuickBooksID },
        APAccountRef: { value: oIDAcctAP },
        PrivateNote: oPayload.Memo,
        Line: await wExpenseLines(oRealmID, oPayload.VendorCredit.Lines),
      };
      await wPostDoc(
        aJob,
        oRealmID,
        "VendorCredit",
        oPayload.VendorCredit.DocNumber,
        oBody,
        oPayload.VendorCredit.Total,
        "-v",
      );
    }
  } else if (aJob.CdTypeQuickBooksSyncJob === "ProducerPayment") {
    const oVendor = await wEnsureVendor(aJob.IDProducer);
    const oIDAcctAP = await wRoleID(oRealmID, "AcctAP");
    const oIDAcctBank = await wRoleID(oRealmID, CdRoleClearing(oPayload.CdMethPay));

    // FIFO allocation across open posted documents. tValidationError from the
    // allocator blocks the job (e.g. payment exceeds the open balance because
    // the cycle Bill has not posted yet):
    const oDocs = await wProducerOpenDocs(aJob.IDProducer);
    let oAllocations;
    try {
      oAllocations = AllocatePayment(oPayload.Total, oDocs);
    } catch (aErr) {
      throw new tValidationError(aErr.message);
    }

    // Persist the allocations with the payload so future payments see them:
    oPayload.Allocations = oAllocations;
    await wUpd_SyncJob(aJob.IDQuickBooksSyncJob, {
      PayloadJSON: oPayload,
      PayloadChecksum: ChecksumFromPayload(oPayload),
    });

    const oBody = {
      DocNumber: oPayload.DocNumber,
      TxnDate: oPayload.TxnDate,
      VendorRef: { value: oVendor.QuickBooksID },
      APAccountRef: { value: oIDAcctAP },
      PayType: "Check",
      CheckPayment: { BankAccountRef: { value: oIDAcctBank } },
      TotalAmt: oPayload.Total,
      PrivateNote: oPayload.Memo,
      Line: oAllocations.map(oAlloc => ({
        Amount: oAlloc.Amt,
        LinkedTxn: [{ TxnId: oAlloc.QuickBooksID, TxnType: oAlloc.CdTypeQuickBooksDoc }],
      })),
    };
    await wPostDoc(aJob, oRealmID, "BillPayment", oPayload.DocNumber, oBody, oPayload.Total);
  }

  await wAdd_Event({
    CdTypeQuickBooksEvent: "JobPosted",
    RealmID: oRealmID,
    IDQuickBooksSyncJob: aJob.IDQuickBooksSyncJob,
    Detail: { SourceKey: aJob.SourceKey, DocNumber: oPayload.DocNumber || null },
  });
  return "Posted";
}
