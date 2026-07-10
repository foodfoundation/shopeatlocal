// MySQL integration tests for the QuickBooks persistence layer: migration
// constraints, same-transaction enqueue atomicity, job leasing and recovery,
// unique source keys, and immutable document links. These run against the
// configured development database and skip when it is unreachable; test rows
// are prefixed and removed afterwards.

import { Conn, wConnNew, wAdd_Transact } from "../../src/Db.js";
import {
  TokensFromConnection,
  wAdd_EntityLink,
  wAdd_SyncJob,
  wClaim_SyncJobs,
  wEntityLinksFromJob,
  wSyncJobFromSourceKey,
  wUpd_SyncJob,
  wUpsert_Connection,
  wWithConnectionLock,
  wUpd_ConnectionTokens,
} from "../../src/QuickBooks/Db.js";
import { CkFeatureEnabled } from "../../src/QuickBooks/Config.js";

const Pref = `test:${Date.now()}`;
const RealmTest = `test-realm-${Date.now()}`;
let CkDb = false;

beforeAll(async () => {
  try {
    await Conn.wExec("SELECT 1 FROM QuickBooksSyncJob LIMIT 1");
    CkDb = true;
  } catch {
    console.warn("Skipping QuickBooks DB integration tests: database unavailable.");
  }
});

afterAll(async () => {
  if (!CkDb) return;
  await Conn.wExecPrep(
    `DELETE Link FROM QuickBooksEntityLink AS Link
			JOIN QuickBooksSyncJob AS Job USING (IDQuickBooksSyncJob)
			WHERE Job.SourceKey LIKE :Pref`,
    { Pref: `${Pref}%` },
  );
  await Conn.wExecPrep(`DELETE FROM QuickBooksSyncJob WHERE SourceKey LIKE :Pref`, {
    Pref: `${Pref}%`,
  });
  await Conn.wExecPrep(`DELETE FROM QuickBooksConnection WHERE RealmID = :Realm`, {
    Realm: RealmTest,
  });
});

describe("sync job outbox", () => {
  it("enforces unique source keys with idempotent enqueue", async () => {
    if (!CkDb) return;
    const oKey = `${Pref}:unique`;
    const oID1 = await wAdd_SyncJob({
      CdTypeQuickBooksSyncJob: "CycChannelJournal",
      SourceKey: oKey,
      IDCyc: null,
      CdChannel: "Web",
    });
    const oID2 = await wAdd_SyncJob({
      CdTypeQuickBooksSyncJob: "CycChannelJournal",
      SourceKey: oKey,
      IDCyc: null,
      CdChannel: "Web",
    });
    expect(oID1).toBeTruthy();
    expect(oID2).toBeNull();
  });

  it("claims jobs with a lease, blocks a second claimer, and recovers after expiry", async () => {
    if (!CkDb) return;
    const oKey = `${Pref}:lease`;
    await wAdd_SyncJob({ CdTypeQuickBooksSyncJob: "CycMembershipJournal", SourceKey: oKey });

    const oJobs1 = await wClaim_SyncJobs(50, 300, "1970-01-01");
    const oClaimed = oJobs1.find(o => o.SourceKey === oKey);
    expect(oClaimed).toBeTruthy();
    expect(oClaimed.CdStatusQuickBooksSyncJob).toBe("Claimed");
    expect(oClaimed.WhenLeaseExpires).toBeTruthy();

    // A second claim within the lease finds nothing:
    const oJobs2 = await wClaim_SyncJobs(50, 300, "1970-01-01");
    expect(oJobs2.find(o => o.SourceKey === oKey)).toBeUndefined();

    // A crashed worker's lease expires and the job becomes claimable again.
    // Well in the past: DATETIME rounds to whole seconds, so a 1s margin can
    // round up to the current second and flake:
    await wUpd_SyncJob(oClaimed.IDQuickBooksSyncJob, {
      WhenLeaseExpires: new Date(Date.now() - 60_000),
    });
    const oJobs3 = await wClaim_SyncJobs(50, 300, "1970-01-01");
    expect(oJobs3.find(o => o.SourceKey === oKey)).toBeTruthy();
  });

  it("holds daily batches until the business date has ended", async () => {
    if (!CkDb) return;
    const oKey = `${Pref}:daily`;
    await wAdd_SyncJob({
      CdTypeQuickBooksSyncJob: "DailyPaymentJournal",
      SourceKey: oKey,
      DateBatch: "2099-01-01",
      CdMethPay: "Cash",
    });
    const oJobs = await wClaim_SyncJobs(50, 300, "2099-01-01");
    expect(oJobs.find(o => o.SourceKey === oKey)).toBeUndefined();
    const oJobsAfter = await wClaim_SyncJobs(50, 300, "2099-01-02");
    expect(oJobsAfter.find(o => o.SourceKey === oKey)).toBeTruthy();
  });

  it("keeps successful links immutable and unique per document", async () => {
    if (!CkDb) return;
    const oKey = `${Pref}:link`;
    const oID = await wAdd_SyncJob({ CdTypeQuickBooksSyncJob: "ProducerBill", SourceKey: oKey });
    await wAdd_EntityLink({
      IDQuickBooksSyncJob: oID,
      RealmID: RealmTest,
      CdTypeQuickBooksDoc: "Bill",
      QuickBooksID: "qb-doc-1",
      DocNumber: "SB1-1",
      AmtTotal: 100.5,
    });
    // The same document cannot be linked twice:
    await wAdd_EntityLink({
      IDQuickBooksSyncJob: oID,
      RealmID: RealmTest,
      CdTypeQuickBooksDoc: "Bill",
      QuickBooksID: "qb-doc-1",
      DocNumber: "SB1-1",
      AmtTotal: 999,
    });
    const oLinks = await wEntityLinksFromJob(oID);
    expect(oLinks).toHaveLength(1);
    expect(Number(oLinks[0].AmtTotal)).toBe(100.5);
  });
});

describe("same-transaction enqueue", () => {
  it("rolls the sync job back with the business transaction", async () => {
    if (!CkDb) return;
    if (!CkFeatureEnabled()) return;

    const oConn = await wConnNew();
    try {
      await oConn.wTransact();
      // A producer PaySent enqueues an individual payout job in the same
      // transaction:
      const [oProducerRows] = await oConn.wExec(
        "SELECT IDProducer, IDMemb FROM Producer LIMIT 1",
      );
      if (!oProducerRows.length) return;

      const oIDTransact = await wAdd_Transact(
        oProducerRows[0].IDMemb,
        "PaySent",
        123.45,
        0.0,
        null,
        { IDProducer: oProducerRows[0].IDProducer, CdMethPay: "Check" },
        oConn,
      );
      const [oJobRows] = await oConn.wExecPrep(
        `SELECT * FROM QuickBooksSyncJob WHERE SourceKey = :Key`,
        { Key: `transact:${oIDTransact}` },
      );
      expect(oJobRows).toHaveLength(1);
      expect(oJobRows[0].IDProducer).toBe(oProducerRows[0].IDProducer);

      await oConn.wRollback();

      // Both the ledger row and the job are gone after rollback:
      const oJob = await wSyncJobFromSourceKey(`transact:${oIDTransact}`);
      expect(oJob).toBeNull();
      const [oTransactRows] = await Conn.wExecPrep(
        `SELECT * FROM Transact WHERE IDTransact = :ID`,
        { ID: oIDTransact },
      );
      expect(oTransactRows).toHaveLength(0);
    } finally {
      oConn.Release();
    }
  });
});

describe("connection storage", () => {
  it("stores tokens encrypted and round-trips them", async () => {
    if (!CkDb) return;
    const oConnection = await wUpsert_Connection({
      RealmID: RealmTest,
      EnvironmentName: "sandbox",
      CompanyName: "Test Co",
      AccessToken: "access-token-plain",
      RefreshToken: "refresh-token-plain",
      WhenAccessTokenExpires: new Date(Date.now() + 3600_000),
      WhenRefreshTokenExpires: new Date(Date.now() + 100 * 24 * 3600_000),
    });
    expect(oConnection.EncAccessToken).not.toContain("access-token-plain");
    const oTokens = TokensFromConnection(oConnection);
    expect(oTokens.AccessToken).toBe("access-token-plain");
    expect(oTokens.RefreshToken).toBe("refresh-token-plain");
  });

  it("persists rotated tokens atomically under the row lock", async () => {
    if (!CkDb) return;
    const [oRows] = await Conn.wExecPrep(
      `SELECT * FROM QuickBooksConnection WHERE RealmID = :Realm`,
      { Realm: RealmTest },
    );
    const oID = oRows[0].IDQuickBooksConnection;

    const oResult = await wWithConnectionLock(oID, async (aRow, aConn) => {
      await wUpd_ConnectionTokens(
        oID,
        {
          AccessToken: "rotated-access",
          RefreshToken: "rotated-refresh",
          WhenAccessTokenExpires: new Date(Date.now() + 3600_000),
          WhenRefreshTokenExpires: new Date(Date.now() + 100 * 24 * 3600_000),
        },
        aConn,
      );
      return aRow.RealmID;
    });
    expect(oResult).toBe(RealmTest);

    const [oAfter] = await Conn.wExecPrep(
      `SELECT * FROM QuickBooksConnection WHERE IDQuickBooksConnection = :ID`,
      { ID: oID },
    );
    expect(TokensFromConnection(oAfter[0]).RefreshToken).toBe("rotated-refresh");
  });
});
