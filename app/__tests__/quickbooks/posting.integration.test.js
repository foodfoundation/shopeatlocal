// End-to-end posting and worker retry-policy tests. The local OAuth adapter
// is mocked with a scriptable fake Intuit transport, so Client.js (requestid,
// 401 refresh-retry, query building), Post.js (preflight, snapshots, document
// bodies, FIFO allocation, duplicate adoption), and Worker.js (claiming,
// backoff, blocking, alerts) all run for real against the development MySQL
// database. Fixture rows are committed and removed afterwards.

import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";

// ------------------------------
// Fake Intuit transport (scripted)
// ------------------------------

const EntityNameFromPath = {
  journalentry: "JournalEntry",
  bill: "Bill",
  vendorcredit: "VendorCredit",
  billpayment: "BillPayment",
  account: "Account",
  class: "Class",
  item: "Item",
  customer: "Customer",
  vendor: "Vendor",
};

const API = {
  Calls: [],
  CtRefreshForce: 0,
  Seq: 0,
  /** (aEntity, aQueryText) => row or null, for QBO 'select' queries. */
  QueryRow: () => null,
  /** (aEntity, aOpts) => error to throw on create, or null. */
  CreateErr: () => null,

  Reset() {
    this.Calls = [];
    this.QueryRow = () => null;
    this.CreateErr = () => null;
  },

  Creates(aEntity) {
    return this.Calls.filter(
      o => o.method === "POST" && EntityNameFromPath[o.url.split("/")[4]] === aEntity,
    );
  },

  async wCall(aOpts) {
    this.Calls.push(aOpts);
    const oKind = aOpts.url.split("/")[4];
    if (oKind === "query") {
      const oEntity = /from (\w+)/i.exec(aOpts.params.query)[1];
      const oRow = this.QueryRow(oEntity, aOpts.params.query);
      return { json: { QueryResponse: oRow ? { [oEntity]: [oRow] } : {} } };
    }
    if (oKind === "companyinfo") return { json: { CompanyInfo: { CompanyName: "Fake Co" } } };
    const oEntity = EntityNameFromPath[oKind];
    const oErr = this.CreateErr(oEntity, aOpts);
    if (oErr) throw oErr;
    return { json: { [oEntity]: { Id: `qb-${oEntity}-${++this.Seq}` } } };
  },
};

// Replace only the OAuth adapter; wConnection comes from the real database:
mock.module("../../src/QuickBooks/OAuth.js", () => ({
  OAuthClientNew: () => ({ makeApiCall: aOpts => API.wCall(aOpts) }),
  wFreshConnection: async aCkForceRefresh => {
    if (aCkForceRefresh) API.CtRefreshForce++;
    const oConnection = await wConnection();
    return { Connection: oConnection, AccessToken: "test-access-token" };
  },
  AuthorizeUri: () => {
    throw Error("not used in tests");
  },
  wHandleCallback: () => {
    throw Error("not used in tests");
  },
  wDisconnect: () => {
    throw Error("not used in tests");
  },
}));

import { Conn, wAdd_Transact } from "../../src/Db.js";
import { DateBusiness, WindowOfDate } from "../../src/QuickBooks/Accounting.js";
import { EnvironmentName } from "../../src/QuickBooks/Config.js";
import {
  wAdd_SyncJob,
  wConnection,
  wEntityLinksFromJob,
  wSyncJobFromSourceKey,
  wUpd_ConnectionSettings,
  wUpd_SyncJob,
  wUpsert_Connection,
  wUpsert_EntityMap,
} from "../../src/QuickBooks/Db.js";
import { SetupPlan } from "../../src/QuickBooks/Bootstrap.js";
import { wEnqueueCycEnd } from "../../src/QuickBooks/Outbox.js";
import { wRunBatch } from "../../src/QuickBooks/Worker.js";

const Realm = `test-realm-post-${Date.now()}`;
const Marker = "qbtest-post";
let Ck = false;
let IDCycPre = null;
let IDCycMain = null;
let IDMemb = null;
let IDProducer = null;
const SourceKeys = [];

/** Deletes every row this suite can create, keyed by the deterministic
 *  SourceKeys and test markers. Runs before setup (stale rows from an aborted
 *  run would otherwise satisfy INSERT IGNORE) and again after. */
async function wPurge() {
  const oKeys = [...new Set(SourceKeys)];
  if (oKeys.length) {
    const oIn = oKeys.map(() => "?").join(",");
    const oWhere = `Job.SourceKey IN (${oIn})
			OR Job.SourceKey IN (SELECT CONCAT('transact:', IDTransact) FROM Transact WHERE Note = '${Marker}')`;
    await Conn.wExec(
      `DELETE Link FROM QuickBooksEntityLink AS Link
				JOIN QuickBooksSyncJob AS Job USING (IDQuickBooksSyncJob)
				WHERE ${oWhere}`,
      oKeys,
    );
    await Conn.wExec(
      `DELETE Ev FROM QuickBooksEvent AS Ev
				JOIN QuickBooksSyncJob AS Job USING (IDQuickBooksSyncJob)
				WHERE ${oWhere}`,
      oKeys,
    );
    await Conn.wExec(
      `DELETE Job FROM QuickBooksSyncJob AS Job
				LEFT JOIN Transact
					ON Job.SourceKey = CONCAT('transact:', Transact.IDTransact)
				WHERE Job.SourceKey IN (${oIn}) OR Transact.Note = '${Marker}'`,
      oKeys,
    );
  }
  await Conn.wExec(`DELETE FROM QuickBooksEvent WHERE RealmID LIKE 'test-realm-post-%'`);
  await Conn.wExec(`DELETE FROM QuickBooksEntityMap WHERE RealmID LIKE 'test-realm-post-%'`);
  await Conn.wExec(`DELETE FROM QuickBooksConnection WHERE RealmID LIKE 'test-realm-post-%'`);
  await Conn.wExecPrep(`DELETE FROM Transact WHERE Note = :Marker`, { Marker });
  await Conn.wExec(`DELETE FROM InvcProducerWeb WHERE NameFileInvc = 'qbt-pw'`);
  await Conn.wExec(
    `DELETE InvcShopWeb FROM InvcShopWeb
			JOIN Cart USING (IDCart)
			WHERE InvcShopWeb.NameFileInvc = 'qbt-web'`,
  );
  if (IDCycMain)
    await Conn.wExecPrep(`DELETE FROM Cart WHERE IDCyc = :IDCyc AND IDMemb = :IDMemb`, {
      IDCyc: IDCycMain,
      IDMemb,
    });
}

/** Business date N days back, plus a UTC instant inside that local day. */
function dateDaysAgo(aCtDays) {
  const oDate = DateBusiness(new Date(Date.now() - aCtDays * 86_400_000));
  const oWindow = WindowOfDate(oDate);
  return { Date: oDate, When: new Date(oWindow.WhenStart.getTime() + 6 * 3_600_000) };
}

async function wInsertPayRecv(aCdMethPay, aAmt, aWhen) {
  await Conn.wExecPrep(
    `INSERT INTO Transact (IDMemb, CdTypeTransact, CdMethPay, AmtMoney, Note, WhenCreate)
			VALUES (:IDMemb, 'PayRecv', :CdMethPay, :Amt, :Note, :WhenCreate)`,
    { IDMemb, CdMethPay: aCdMethPay, Amt: aAmt, Note: Marker, WhenCreate: aWhen },
  );
}

async function wEnqueueDaily(aDate, aCdMethPay) {
  const oKey = `pay:${aDate}:${aCdMethPay}`;
  SourceKeys.push(oKey);
  await wAdd_SyncJob({
    CdTypeQuickBooksSyncJob: "DailyPaymentJournal",
    SourceKey: oKey,
    DateBatch: aDate,
    CdMethPay: aCdMethPay,
  });
  return oKey;
}

async function wRetryNow(aKey) {
  const oJob = await wSyncJobFromSourceKey(aKey);
  await wUpd_SyncJob(oJob.IDQuickBooksSyncJob, {
    CdStatusQuickBooksSyncJob: "Pending",
    WhenNextRetry: new Date(Date.now() - 1000),
  });
}

beforeAll(async () => {
  try {
    const [oCycRows] = await Conn.wExec(
      `SELECT Cyc.IDCyc
				FROM Cyc
				LEFT JOIN Cart ON Cart.IDCyc = Cyc.IDCyc
				LEFT JOIN InvcProducerWeb ON InvcProducerWeb.IDCyc = Cyc.IDCyc
				WHERE Cyc.WhenEndCyc < NOW()
					AND Cart.IDCart IS NULL AND InvcProducerWeb.IDInvcProducerWeb IS NULL
				ORDER BY Cyc.IDCyc LIMIT 2`,
    );
    if (oCycRows.length < 2) throw Error("Need two empty past cycles.");
    IDCycPre = oCycRows[0].IDCyc;
    IDCycMain = oCycRows[1].IDCyc;

    const [oMembRows] = await Conn.wExec("SELECT IDMemb FROM Memb LIMIT 1");
    const [oProducerRows] = await Conn.wExec("SELECT IDProducer FROM Producer LIMIT 1");
    const [oLocRows] = await Conn.wExec("SELECT CdLoc FROM Loc LIMIT 1");
    IDMemb = oMembRows[0].IDMemb;
    IDProducer = oProducerRows[0].IDProducer;

    // All deterministic keys this suite will create, so a purge can clear
    // stale rows left by an aborted earlier run:
    for (const oIDCyc of [IDCycMain, IDCycPre]) {
      for (const oCdChannel of ["Web", "OnsiteRetail", "Wholesale"])
        SourceKeys.push(`cyc:${oIDCyc}:sales:${oCdChannel}`);
      SourceKeys.push(`cyc:${oIDCyc}:membership`);
    }
    SourceKeys.push(`cyc:${IDCycMain}:bill:${IDProducer}`);
    const oMethsByDay = ["Cash", "Check", "PayPal", "Credit", "Debit", "EBTElec"];
    for (let oCtDays = 1; oCtDays <= oMethsByDay.length; oCtDays++)
      SourceKeys.push(`pay:${dateDaysAgo(oCtDays).Date}:${oMethsByDay[oCtDays - 1]}`);
    await wPurge();

    // Healthy bootstrapped connection with the cutover at the main cycle:
    const oConnection = await wUpsert_Connection({
      RealmID: Realm,
      EnvironmentName,
      CompanyName: "Fake Co",
      AccessToken: "at",
      RefreshToken: "rt",
      WhenAccessTokenExpires: new Date(Date.now() + 3_600_000),
      WhenRefreshTokenExpires: new Date(Date.now() + 100 * 86_400_000),
    });
    await wUpd_ConnectionSettings(oConnection.IDQuickBooksConnection, {
      CkBootstrapped: true,
      CkPostingEnabled: true,
      IDCycCutover: IDCycMain,
    });
    for (const oStep of SetupPlan)
      await wUpsert_EntityMap({
        RealmID: Realm,
        CdRole: oStep.CdRole,
        CdTypeQuickBooksEntity: oStep.Type,
        QuickBooksID: `map-${oStep.CdRole}`,
        Name: oStep.Name,
      });

    // Web shopper invoice and a producer invoice in the main cycle:
    await Conn.wExecPrep(
      `INSERT INTO Cart (IDCyc, IDMemb, CdLoc, CdStatCart)
				VALUES (:IDCyc, :IDMemb, :CdLoc, 'Pick')`,
      { IDCyc: IDCycMain, IDMemb, CdLoc: oLocRows[0].CdLoc },
    );
    const [oCartRows] = await Conn.wExecPrep(
      `SELECT IDCart FROM Cart WHERE IDCyc = :IDCyc AND IDMemb = :IDMemb`,
      { IDCyc: IDCycMain, IDMemb },
    );
    await Conn.wExecPrep(
      `INSERT INTO InvcShopWeb (IDCart, NameFileInvc, SaleNomNontaxab,
				FeeCoopShopNontaxab, SaleNomTaxab, FeeCoopShopTaxab, TaxSale,
				FeeCoopShopForgiv, FeeDelivTransfer, TtlMoney, TtlEBT, Ttl)
				VALUES (:IDCart, 'qbt-web', 100.00, 10.00, 0.00, 0.00, 0.00,
					0.00, 0.00, 110.00, 0.00, 110.00)`,
      { IDCart: oCartRows[0].IDCart },
    );
    await Conn.wExecPrep(
      `INSERT INTO InvcProducerWeb (IDCyc, IDProducer, NameFileInvc, SaleNom,
				FeeCoop, FeeInvt, Ttl)
				VALUES (:IDCyc, :IDProducer, 'qbt-pw', 100.00, 8.00, 2.00, 90.00)`,
      { IDCyc: IDCycMain, IDProducer },
    );

    Ck = true;
  } catch (aErr) {
    console.warn(`Skipping QuickBooks posting integration tests: ${aErr.message}`);
  }
});

afterAll(async () => {
  API.Reset();
  if (Ck) await wPurge();
});

describe("cycle-end posting through the worker", () => {
  it("posts the web channel journal and producer documents, skips empty channels and pre-cutover work", async () => {
    if (!Ck) return;
    API.Reset();

    await wEnqueueCycEnd(IDCycMain, [IDProducer]);
    await wEnqueueCycEnd(IDCycPre, []);

    const oResult = await wRunBatch();
    expect(oResult.Ck).toBe(true);

    // Web journal posted with the deterministic DocNumber and mapped refs:
    const oJobWeb = await wSyncJobFromSourceKey(`cyc:${IDCycMain}:sales:Web`);
    expect(oJobWeb.CdStatusQuickBooksSyncJob).toBe("Posted");
    expect(oJobWeb.WhenPosted).toBeTruthy();
    const oCallJournal = API.Creates("JournalEntry")[0];
    expect(oCallJournal.body.DocNumber).toBe(`SC${IDCycMain}-WEB`);
    expect(oCallJournal.params.requestid).toBe(oJobWeb.RequestID);
    const oLineAR = oCallJournal.body.Line.find(
      o => o.JournalEntryLineDetail.PostingType === "Debit",
    );
    expect(oLineAR.Amount).toBe(110);
    expect(oLineAR.JournalEntryLineDetail.AccountRef.value).toBe("map-AcctMembAR");
    expect(oLineAR.JournalEntryLineDetail.ClassRef.value).toBe("map-ClassWeb");
    expect(oLineAR.JournalEntryLineDetail.Entity.EntityRef.value).toBe("map-CustomerMembAR");

    // Channels without activity and the empty membership journal are skipped:
    for (const oKey of [
      `cyc:${IDCycMain}:sales:OnsiteRetail`,
      `cyc:${IDCycMain}:sales:Wholesale`,
      `cyc:${IDCycMain}:membership`,
    ]) {
      const oJob = await wSyncJobFromSourceKey(oKey);
      expect(oJob.CdStatusQuickBooksSyncJob).toBe("Skipped");
    }

    // Pre-cutover jobs are suppressed without touching the API:
    const oJobPre = await wSyncJobFromSourceKey(`cyc:${IDCycPre}:sales:Web`);
    expect(oJobPre.CdStatusQuickBooksSyncJob).toBe("Skipped");

    // Producer: vendor created on demand, then a gross Bill and fee credit:
    const oJobBill = await wSyncJobFromSourceKey(`cyc:${IDCycMain}:bill:${IDProducer}`);
    expect(oJobBill.CdStatusQuickBooksSyncJob).toBe("Posted");
    expect(API.Creates("Vendor")).toHaveLength(1);
    const oCallBill = API.Creates("Bill")[0];
    expect(oCallBill.body.DocNumber).toBe(`SB${IDCycMain}-${IDProducer}`);
    expect(oCallBill.body.APAccountRef.value).toBe("map-AcctAP");
    expect(oCallBill.params.requestid).toBe(`${oJobBill.RequestID}-b`);
    const oCallCredit = API.Creates("VendorCredit")[0];
    expect(oCallCredit.body.DocNumber).toBe(`SV${IDCycMain}-${IDProducer}`);
    expect(oCallCredit.params.requestid).toBe(`${oJobBill.RequestID}-v`);
    const oLinks = await wEntityLinksFromJob(oJobBill.IDQuickBooksSyncJob);
    expect(oLinks.map(o => o.CdTypeQuickBooksDoc).sort()).toEqual(["Bill", "VendorCredit"]);
  });

  it("allocates a producer payout FIFO across the bill and fee credit", async () => {
    if (!Ck) return;
    API.Reset();

    // Gross 100 - fees 10: a 90 payout settles the producer in full.
    const oIDTransact = await wAdd_Transact(IDMemb, "PaySent", 90.0, 0.0, null, {
      IDProducer,
      CdMethPay: "Check",
      Note: Marker,
    });
    SourceKeys.push(`transact:${oIDTransact}`);

    await wRunBatch();

    const oJob = await wSyncJobFromSourceKey(`transact:${oIDTransact}`);
    expect(oJob.CdStatusQuickBooksSyncJob).toBe("Posted");
    const oCall = API.Creates("BillPayment")[0];
    expect(oCall.body.DocNumber).toBe(`SPY-T${oIDTransact}`);
    expect(oCall.body.TotalAmt).toBe(90);
    expect(oCall.body.CheckPayment.BankAccountRef.value).toBe("map-AcctClearingCheck");
    const oLines = oCall.body.Line.map(o => ({
      Amt: o.Amount,
      Type: o.LinkedTxn[0].TxnType,
    }));
    expect(oLines).toContainEqual({ Amt: 100, Type: "Bill" });
    expect(oLines).toContainEqual({ Amt: 10, Type: "VendorCredit" });
  });

  it("blocks a payout that exceeds the producer's open balance", async () => {
    if (!Ck) return;
    API.Reset();

    const oIDTransact = await wAdd_Transact(IDMemb, "PaySent", 999.0, 0.0, null, {
      IDProducer,
      CdMethPay: "Check",
      Note: Marker,
    });
    SourceKeys.push(`transact:${oIDTransact}`);

    await wRunBatch();

    const oJob = await wSyncJobFromSourceKey(`transact:${oIDTransact}`);
    expect(oJob.CdStatusQuickBooksSyncJob).toBe("Blocked");
    expect(oJob.Error).toContain("exceeds the producer's open balance");
    expect(oJob.CkAlerted).toBe(1);
    expect(API.Creates("BillPayment")).toHaveLength(0);
  });

  it("posts a daily payment journal once its business date has passed", async () => {
    if (!Ck) return;
    API.Reset();

    const oDay = dateDaysAgo(1);
    await wInsertPayRecv("Cash", -30.0, oDay.When);
    await wEnqueueDaily(oDay.Date, "Cash");

    await wRunBatch();

    const oJob = await wSyncJobFromSourceKey(`pay:${oDay.Date}:Cash`);
    expect(oJob.CdStatusQuickBooksSyncJob).toBe("Posted");
    const oCall = API.Creates("JournalEntry")[0];
    expect(oCall.body.DocNumber).toBe(`SP${oDay.Date.replaceAll("-", "")}-CASH`);
    const oDebit = oCall.body.Line.find(o => o.JournalEntryLineDetail.PostingType === "Debit");
    expect(oDebit.Amount).toBe(30);
    expect(oDebit.JournalEntryLineDetail.AccountRef.value).toBe("map-AcctClearingCash");
  });
});

describe("worker retry policy", () => {
  it("backs off on throttling and reuses the same requestid on retry", async () => {
    if (!Ck) return;
    API.Reset();

    const oDay = dateDaysAgo(2);
    await wInsertPayRecv("Check", -40.0, oDay.When);
    const oKey = await wEnqueueDaily(oDay.Date, "Check");

    API.CreateErr = () => ({ code: "429", message: "ThrottleExceeded" });
    await wRunBatch();

    let oJob = await wSyncJobFromSourceKey(oKey);
    expect(oJob.CdStatusQuickBooksSyncJob).toBe("Pending");
    expect(oJob.CtAttempt).toBe(1);
    expect(new Date(oJob.WhenNextRetry) > new Date()).toBe(true);
    expect(oJob.Error).toContain("429");
    const oRequestIDFirst = API.Creates("JournalEntry")[0].params.requestid;
    expect(oRequestIDFirst).toBe(oJob.RequestID);

    API.CreateErr = () => null;
    await wRetryNow(oKey);
    await wRunBatch();

    oJob = await wSyncJobFromSourceKey(oKey);
    expect(oJob.CdStatusQuickBooksSyncJob).toBe("Posted");
    const oCreates = API.Creates("JournalEntry");
    expect(oCreates[oCreates.length - 1].params.requestid).toBe(oRequestIDFirst);
  });

  it("blocks permanent QuickBooks validation faults for review", async () => {
    if (!Ck) return;
    API.Reset();

    const oDay = dateDaysAgo(3);
    await wInsertPayRecv("PayPal", -25.0, oDay.When);
    const oKey = await wEnqueueDaily(oDay.Date, "PayPal");

    API.CreateErr = () => ({
      code: "6240",
      message: "Bad Request",
      fault: { errors: [{ code: "6240", message: "Duplicate Name Exists Error" }] },
    });
    await wRunBatch();

    const oJob = await wSyncJobFromSourceKey(oKey);
    expect(oJob.CdStatusQuickBooksSyncJob).toBe("Blocked");
    expect(oJob.Error).toContain("Duplicate Name Exists Error");
    expect(oJob.CkAlerted).toBe(1);
  });

  it("refreshes once on 401 and leaves the job pending for reauthorization", async () => {
    if (!Ck) return;
    API.Reset();
    API.CtRefreshForce = 0;

    const oDay = dateDaysAgo(4);
    await wInsertPayRecv("Credit", -15.0, oDay.When);
    const oKey = await wEnqueueDaily(oDay.Date, "Credit");

    API.CreateErr = () => ({ code: "401", message: "Unauthorized" });
    await wRunBatch();

    // Client.js retried once with a forced token refresh before giving up:
    expect(API.CtRefreshForce).toBe(1);
    const oJob = await wSyncJobFromSourceKey(oKey);
    expect(oJob.CdStatusQuickBooksSyncJob).toBe("Pending");
    expect(oJob.CtAttempt).toBe(1);
  });

  it("adopts a document applied before an ambiguous timeout instead of duplicating it", async () => {
    if (!Ck) return;
    API.Reset();

    const oDay = dateDaysAgo(5);
    await wInsertPayRecv("Debit", -35.0, oDay.When);
    const oKey = await wEnqueueDaily(oDay.Date, "Debit");
    const oDocNumber = `SP${oDay.Date.replaceAll("-", "")}-DBT`;

    // First attempt: the write is applied but the response never arrives.
    // Fail only this job's create so concurrently claimed jobs are unaffected:
    API.CreateErr = (aEntity, aOpts) =>
      aOpts.body?.DocNumber === oDocNumber ? { code: "TIMEOUT_ERROR", message: "timed out" } : null;
    await wRunBatch();
    let oJob = await wSyncJobFromSourceKey(oKey);
    expect(oJob.CdStatusQuickBooksSyncJob).toBe("Pending");

    // Retry: the DocNumber query finds the applied document and adopts it
    // instead of creating a duplicate:
    API.CreateErr = () => null;
    API.QueryRow = (aEntity, aQuery) =>
      aEntity === "JournalEntry" && aQuery.includes(oDocNumber) ? { Id: "qb-adopted-1" } : null;
    await wRetryNow(oKey);
    await wRunBatch();

    oJob = await wSyncJobFromSourceKey(oKey);
    expect(oJob.CdStatusQuickBooksSyncJob).toBe("Posted");
    // Only the first (timed-out) create attempt ever carried this DocNumber:
    expect(API.Creates("JournalEntry").filter(o => o.body.DocNumber === oDocNumber)).toHaveLength(
      1,
    );
    const oLinks = await wEntityLinksFromJob(oJob.IDQuickBooksSyncJob);
    expect(oLinks[0].QuickBooksID).toBe("qb-adopted-1");
  });

  it("blocks a retry when source totals drifted since the first attempt", async () => {
    if (!Ck) return;
    API.Reset();

    const oDay = dateDaysAgo(6);
    await wInsertPayRecv("EBTElec", -20.0, oDay.When);
    const oKey = await wEnqueueDaily(oDay.Date, "EBTElec");

    // First attempt fails transiently after the checksum is persisted:
    API.CreateErr = () => ({ code: "500", message: "server error" });
    await wRunBatch();
    let oJob = await wSyncJobFromSourceKey(oKey);
    expect(oJob.CdStatusQuickBooksSyncJob).toBe("Pending");
    expect(oJob.PayloadChecksum).toBeTruthy();

    // The source data changes before the retry:
    await wInsertPayRecv("EBTElec", -5.0, oDay.When);
    API.CreateErr = () => null;
    await wRetryNow(oKey);
    await wRunBatch();

    oJob = await wSyncJobFromSourceKey(oKey);
    expect(oJob.CdStatusQuickBooksSyncJob).toBe("Blocked");
    expect(oJob.Error).toContain("Source totals changed");
  });
});
