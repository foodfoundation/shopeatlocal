// Bootstrap-service scenarios backing the quickbooks:bootstrap CLI (the CLI
// is a thin wrapper around wBootstrap): dry-run, clean company, idempotent
// rerun, partially configured company with adoption, conflicting-account
// abort, and wrong-realm/environment rejection. The OAuth adapter is mocked
// with a scripted transport; persistence runs against the real database.

import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";

const API = {
  Calls: [],
  Seq: 0,
  QueryRow: () => null,

  Creates(aEntity) {
    return this.Calls.filter(
      o => o.method === "POST" && o.url.split("/")[4] === aEntity.toLowerCase(),
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
    const oEntity = oKind.charAt(0).toUpperCase() + oKind.slice(1);
    return { json: { [oEntity]: { Id: `qb-new-${++this.Seq}` } } };
  },
};

mock.module("../../src/QuickBooks/OAuth.js", () => ({
  OAuthClientNew: () => ({ makeApiCall: aOpts => API.wCall(aOpts) }),
  wFreshConnection: async () => ({
    Connection: await wConnection(),
    AccessToken: "test-access-token",
  }),
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

import { Conn } from "../../src/Db.js";
import { EnvironmentName } from "../../src/QuickBooks/Config.js";
import { SetupPlan, wBootstrap, wValidateSetup } from "../../src/QuickBooks/Bootstrap.js";
import {
  wConnection,
  wEntityMap,
  wEntityMaps,
  wUpsert_Connection,
} from "../../src/QuickBooks/Db.js";

const Realm = `test-realm-boot-${Date.now()}`;
let Ck = false;

async function wPurge() {
  await Conn.wExec(`DELETE FROM QuickBooksEvent WHERE RealmID LIKE 'test-realm-boot-%'`);
  await Conn.wExec(`DELETE FROM QuickBooksEntityMap WHERE RealmID LIKE 'test-realm-boot-%'`);
  await Conn.wExec(`DELETE FROM QuickBooksConnection WHERE RealmID LIKE 'test-realm-boot-%'`);
}

beforeAll(async () => {
  try {
    await wPurge();
    await wUpsert_Connection({
      RealmID: Realm,
      EnvironmentName,
      CompanyName: "Fake Co",
      AccessToken: "at",
      RefreshToken: "rt",
      WhenAccessTokenExpires: new Date(Date.now() + 3_600_000),
      WhenRefreshTokenExpires: new Date(Date.now() + 100 * 86_400_000),
    });
    Ck = true;
  } catch (aErr) {
    console.warn(`Skipping QuickBooks bootstrap integration tests: ${aErr.message}`);
  }
});

afterAll(async () => {
  if (Ck) await wPurge();
});

describe("wBootstrap", () => {
  it("reports every step as WouldCreate in dry-run without touching anything", async () => {
    if (!Ck) return;
    API.Calls = [];
    API.QueryRow = () => null;

    const oResult = await wBootstrap({ CkDryRun: true });
    expect(oResult.CkDryRun).toBe(true);
    expect(oResult.CkComplete).toBe(false);
    expect(oResult.Steps).toHaveLength(SetupPlan.length);
    expect(oResult.Steps.every(o => o.Action === "WouldCreate")).toBe(true);

    // Only queries were issued and no mappings were stored:
    expect(API.Calls.every(o => o.method !== "POST")).toBe(true);
    expect(await wEntityMaps(Realm)).toHaveLength(0);
    expect((await wValidateSetup()).CkValid).toBe(false);
  });

  it("creates the full setup on a clean company and marks it bootstrapped", async () => {
    if (!Ck) return;
    API.Calls = [];
    API.QueryRow = () => null;

    const oResult = await wBootstrap({});
    expect(oResult.CkComplete).toBe(true);
    expect(oResult.Steps.every(o => o.Action === "Created" && o.QuickBooksID)).toBe(true);

    const oMaps = await wEntityMaps(Realm);
    expect(oMaps).toHaveLength(SetupPlan.length);
    expect((await wValidateSetup()).CkValid).toBe(true);
    expect((await wConnection()).CkBootstrapped).toBe(1);

    // The service item wires income/expense refs to the accounts created in
    // the same run:
    const oCallItem = API.Creates("Item")[0];
    const oMapSales = await wEntityMap(Realm, "AcctIncomeSales", "");
    const oMapCOGS = await wEntityMap(Realm, "AcctCOGSProducer", "");
    expect(oCallItem.body.IncomeAccountRef.value).toBe(oMapSales.QuickBooksID);
    expect(oCallItem.body.ExpenseAccountRef.value).toBe(oMapCOGS.QuickBooksID);
  });

  it("is idempotent: a rerun maps every step without creating anything", async () => {
    if (!Ck) return;
    API.Calls = [];

    const oResult = await wBootstrap({});
    expect(oResult.CkComplete).toBe(true);
    expect(oResult.Steps.every(o => o.Action === "Mapped")).toBe(true);
    expect(API.Calls.filter(o => o.method === "POST")).toHaveLength(0);
  });

  it("adopts existing same-name entities in a partially configured company", async () => {
    if (!Ck) return;
    // Simulate lost mappings for two roles whose entities already exist:
    await Conn.wExecPrep(
      `DELETE FROM QuickBooksEntityMap
				WHERE RealmID = :Realm AND CdRole IN ('AcctIncomeSales', 'ClassWeb')`,
      { Realm },
    );
    API.Calls = [];
    API.QueryRow = (aEntity, aQuery) => {
      if (aEntity === "Account" && aQuery.includes("ShopEatLocal Product Sales"))
        return { Id: "qb-existing-sales", AccountType: "Income" };
      if (aEntity === "Class" && aQuery.includes("'Web'")) return { Id: "qb-existing-web" };
      return null;
    };

    const oResult = await wBootstrap({});
    expect(oResult.CkComplete).toBe(true);
    const oActions = Object.fromEntries(oResult.Steps.map(o => [o.CdRole, o.Action]));
    expect(oActions.AcctIncomeSales).toBe("Adopted");
    expect(oActions.ClassWeb).toBe("Adopted");
    expect(oActions.AcctMembAR).toBe("Mapped");
    expect(API.Calls.filter(o => o.method === "POST")).toHaveLength(0);
    expect((await wEntityMap(Realm, "AcctIncomeSales", "")).QuickBooksID).toBe(
      "qb-existing-sales",
    );
  });

  it("aborts on a same-name account with a conflicting type", async () => {
    if (!Ck) return;
    await Conn.wExecPrep(
      `DELETE FROM QuickBooksEntityMap
				WHERE RealmID = :Realm AND CdRole = 'AcctLiabTaxSale'`,
      { Realm },
    );
    API.Calls = [];
    API.QueryRow = (aEntity, aQuery) =>
      aEntity === "Account" && aQuery.includes("Sales Tax Payable")
        ? { Id: "qb-conflict", AccountType: "Expense" }
        : null;

    await expect(wBootstrap({})).rejects.toThrow(/Resolve the conflict manually/);
    // Nothing was created and the bad entity was not adopted:
    expect(API.Calls.filter(o => o.method === "POST")).toHaveLength(0);
    expect(await wEntityMap(Realm, "AcctLiabTaxSale", "")).toBeNull();

    // Repair for completeness:
    API.QueryRow = () => null;
    await wBootstrap({});
    expect((await wValidateSetup()).CkValid).toBe(true);
  });

  it("refuses a realm whose environment does not match the runtime", async () => {
    if (!Ck) return;
    const oNameOther = EnvironmentName === "sandbox" ? "production" : "sandbox";
    await Conn.wExecPrep(
      `UPDATE QuickBooksConnection SET EnvironmentName = :Name WHERE RealmID = :Realm`,
      { Name: oNameOther, Realm },
    );
    await expect(wBootstrap({})).rejects.toThrow(/Realm\/environment mismatch/);
    await Conn.wExecPrep(
      `UPDATE QuickBooksConnection SET EnvironmentName = :Name WHERE RealmID = :Realm`,
      { Name: EnvironmentName, Realm },
    );
  });
});
