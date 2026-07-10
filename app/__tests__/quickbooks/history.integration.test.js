// Historical migration service integration tests. Canonical snapshots and the
// durable outbox run against MySQL; only QBO DocNumber lookups are mocked.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";

const QBO = {
  Docs: new Map(),
  Calls: [],
};

import { Conn } from "../../src/Db.js";
import { DateBusiness } from "../../src/QuickBooks/Accounting.js";
import { SetupPlan } from "../../src/QuickBooks/Bootstrap.js";
import { EnvironmentName } from "../../src/QuickBooks/Config.js";
import {
  wConnection,
  wSyncJobFromSourceKey,
  wUpd_ConnectionSettings,
  wUpd_SyncJob,
  wUpsert_Connection,
  wUpsert_EntityMap,
} from "../../src/QuickBooks/Db.js";
import {
  wPlanHistoryMigration,
  wQueueHistoryMigration,
} from "../../src/QuickBooks/History.js";

const Realm = `test-realm-history-${Date.now()}`;
const Marker = `qb-history-${Date.now()}`;
let Ck = false;
let IDCyc = null;
let IDMemb = null;
let SourceKeys = [];

async function wFindDocument(aType, aDocNumber) {
  QBO.Calls.push({ Type: aType, DocNumber: aDocNumber });
  return QBO.Docs.get(`${aType}:${aDocNumber}`) || null;
}

function opts(aExtra = {}) {
  return {
    IDCycFrom: IDCyc,
    IDCycTo: IDCyc,
    wFindDocument,
    ...aExtra,
  };
}

async function wPurge() {
  if (SourceKeys.length) {
    const oMarks = SourceKeys.map(() => "?").join(",");
    await Conn.wExec(
      `DELETE Ev FROM QuickBooksEvent AS Ev
			JOIN QuickBooksSyncJob AS Job USING (IDQuickBooksSyncJob)
			WHERE Job.SourceKey IN (${oMarks})`,
      SourceKeys,
    );
    await Conn.wExec(
      `DELETE Link FROM QuickBooksEntityLink AS Link
			JOIN QuickBooksSyncJob AS Job USING (IDQuickBooksSyncJob)
			WHERE Job.SourceKey IN (${oMarks})`,
      SourceKeys,
    );
    await Conn.wExec(
      `DELETE FROM QuickBooksSyncJob WHERE SourceKey IN (${oMarks})`,
      SourceKeys,
    );
  }
  await Conn.wExec(`DELETE FROM QuickBooksEvent WHERE RealmID LIKE 'test-realm-history-%'`);
  await Conn.wExec(
    `DELETE FROM QuickBooksEntityMap WHERE RealmID LIKE 'test-realm-history-%'`,
  );
  await Conn.wExec(
    `DELETE FROM QuickBooksConnection WHERE RealmID LIKE 'test-realm-history-%'`,
  );
  await Conn.wExecPrep(`DELETE FROM Transact WHERE Note = :Marker`, { Marker });
}

beforeAll(async () => {
  try {
    await wPurge();
    const [oCycRows] = await Conn.wExec(
      `SELECT Cyc.IDCyc, Cyc.WhenStartCyc, Cyc.WhenEndCyc
			FROM Cyc
			LEFT JOIN Cart USING (IDCyc)
			LEFT JOIN InvcProducerWeb USING (IDCyc)
			LEFT JOIN InvcProducerOnsite USING (IDCyc)
			WHERE Cyc.WhenEndCyc < UTC_TIMESTAMP()
				AND Cart.IDCart IS NULL
				AND InvcProducerWeb.IDInvcProducerWeb IS NULL
				AND InvcProducerOnsite.IDInvcProducerOnsite IS NULL
			ORDER BY Cyc.IDCyc DESC
			LIMIT 1`,
    );
    const [oMembRows] = await Conn.wExec(`SELECT IDMemb FROM Memb LIMIT 1`);
    if (!oCycRows.length || !oMembRows.length) throw Error("Missing fixture cycle or member.");
    const oCyc = oCycRows[0];
    IDCyc = oCyc.IDCyc;
    IDMemb = oMembRows[0].IDMemb;
    const oWhen = new Date(new Date(oCyc.WhenStartCyc).getTime() + 6 * 3_600_000);
    const oDateBatch = DateBusiness(oWhen);
    SourceKeys = [
      `cyc:${IDCyc}:membership`,
      `adj:${oDateBatch}`,
      `pay:${oDateBatch}:Coupon`,
    ];
    await wPurge();

    await Conn.wExecPrep(
      `INSERT INTO Transact (
				IDMemb, CdTypeTransact, CdMethPay, AmtMoney, Note, WhenCreate
			)
			VALUES
				(:IDMemb, 'FeeMembInit', NULL, 50.00, :Marker, :WhenCreate),
				(:IDMemb, 'PayRecv', 'Coupon', -12.00, :Marker, :WhenCreate),
				(:IDMemb, 'Adj', NULL, 3.00, :Marker, :WhenCreate)`,
      { IDMemb, Marker, WhenCreate: oWhen },
    );

    const oConnection = await wUpsert_Connection({
      RealmID: Realm,
      EnvironmentName,
      CompanyName: "History Test Co",
      AccessToken: "test-access",
      RefreshToken: "test-refresh",
      WhenAccessTokenExpires: new Date(Date.now() + 3_600_000),
      WhenRefreshTokenExpires: new Date(Date.now() + 100 * 86_400_000),
    });
    await wUpd_ConnectionSettings(oConnection.IDQuickBooksConnection, {
      CkBootstrapped: true,
      CkPostingEnabled: false,
      IDCycCutover: null,
    });
    for (const oStep of SetupPlan)
      await wUpsert_EntityMap({
        RealmID: Realm,
        CdRole: oStep.CdRole,
        CdTypeQuickBooksEntity: oStep.Type,
        QuickBooksID: `history-${oStep.CdRole}`,
        Name: oStep.Name,
      });
    Ck = true;
  } catch (aErr) {
    console.warn(`Skipping QuickBooks history integration tests: ${aErr.message}`);
  }
});

beforeEach(() => {
  QBO.Docs.clear();
  QBO.Calls = [];
});

afterAll(async () => {
  if (Ck) await wPurge();
});

describe("historical migration", () => {
  it("previews canonical jobs without writing to the outbox", async () => {
    if (!Ck) return;
    const oPlan = await wPlanHistoryMigration(opts());

    expect(oPlan.CtCycles).toBe(1);
    expect(oPlan.CtJobs).toBe(3);
    expect(oPlan.CountsByType).toEqual({
      CycMembershipJournal: 1,
      DailyPaymentJournal: 2,
    });
    expect(oPlan.CkCutoverChangeRequired).toBe(true);
    expect(oPlan.Conflicts).toEqual([]);
    expect(QBO.Calls).toHaveLength(3);
    for (const oKey of SourceKeys)
      expect(await wSyncJobFromSourceKey(oKey)).toBeNull();
  });

  it("rejects an unlinked QBO document with the same deterministic number", async () => {
    if (!Ck) return;
    const oDocNumber = `SM${IDCyc}`;
    QBO.Docs.set(`JournalEntry:${oDocNumber}`, { Id: "qbo-existing-history" });

    const oPlan = await wPlanHistoryMigration(opts());
    expect(oPlan.Conflicts).toContainEqual({
      SourceKey: `cyc:${IDCyc}:membership`,
      Type: "QuickBooksDocument",
      CdTypeQuickBooksDoc: "JournalEntry",
      DocNumber: oDocNumber,
      QuickBooksID: "qbo-existing-history",
    });
    await expect(
      wQueueHistoryMigration(opts({ CkSetCutover: true })),
    ).rejects.toThrow(/conflicts must be resolved/);
  });

  it("requires explicit cutover consent, then atomically queues the range", async () => {
    if (!Ck) return;
    await expect(
      wQueueHistoryMigration(opts()),
    ).rejects.toThrow(/--set-cutover/);

    const oResult = await wQueueHistoryMigration(opts({ CkSetCutover: true }));
    expect(oResult.CtJobsQueued).toBe(3);
    expect(oResult.IDCycCutover).toBe(IDCyc);
    expect((await wConnection()).IDCycCutover).toBe(IDCyc);
    for (const oKey of SourceKeys)
      expect((await wSyncJobFromSourceKey(oKey)).CdStatusQuickBooksSyncJob).toBe("Pending");
  });

  it("is idempotent when the same range is queued again", async () => {
    if (!Ck) return;
    const oResult = await wQueueHistoryMigration(opts());
    expect(oResult.CtJobsQueued).toBe(0);
    expect(oResult.CtJobsExisting).toBe(3);
  });

  it("requires terminal local jobs to be resolved before a rerun", async () => {
    if (!Ck) return;
    const oJob = await wSyncJobFromSourceKey(SourceKeys[0]);
    await wUpd_SyncJob(oJob.IDQuickBooksSyncJob, {
      CdStatusQuickBooksSyncJob: "Blocked",
    });

    const oPlan = await wPlanHistoryMigration(opts());
    expect(oPlan.Conflicts).toContainEqual({
      SourceKey: SourceKeys[0],
      Type: "LocalJobStatus",
      Status: "Blocked",
      Message: "Resolve or retry this existing local job before migration.",
    });
    await wUpd_SyncJob(oJob.IDQuickBooksSyncJob, {
      CdStatusQuickBooksSyncJob: "Pending",
    });
  });

  it("refuses to stage while posting is enabled", async () => {
    if (!Ck) return;
    const oConnection = await wConnection();
    await wUpd_ConnectionSettings(oConnection.IDQuickBooksConnection, {
      CkPostingEnabled: true,
    });
    await expect(
      wQueueHistoryMigration(opts()),
    ).rejects.toThrow(/Disable QuickBooks posting/);
    await wUpd_ConnectionSettings(oConnection.IDQuickBooksConnection, {
      CkPostingEnabled: false,
    });
  });
});
