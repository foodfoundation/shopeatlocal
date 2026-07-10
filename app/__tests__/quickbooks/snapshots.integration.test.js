// Snapshot integration tests against the real schema. Fixture invoices,
// membership fees, and payments are inserted inside a transaction that is
// rolled back afterwards, so the tests are deterministic and leave no data
// behind. Covers web/on-site/wholesale sales, taxable/non-taxable and EBT
// splits, forgiven fees, membership fees and refunds, zero-value cycles,
// producer fee credits, and daily payment batching with cutover suppression.

import { Conn, wConnNew } from "../../src/Db.js";
import {
  Cents,
  WindowOfDate,
  wSnapshotChannelJournal,
  wSnapshotDailyPaymentJournal,
  wSnapshotMembershipJournal,
  wSnapshotProducerBill,
  wProducersInCyc,
} from "../../src/QuickBooks/Accounting.js";

let oConn = null;
let IDCycTest = null;
let IDCycEmpty = null;
let IDMemb = null;
let IDProducer = null;

const DateBatchTest = "2026-01-15";
const WhenCutoverOld = new Date("2000-01-01T00:00:00Z");

beforeAll(async () => {
  let oCyc;
  try {
    // Two past cycles with no existing invoices; the second stays empty to
    // prove zero-value cycles produce no snapshot:
    const [oCycRows] = await Conn.wExec(
      `SELECT Cyc.IDCyc, Cyc.WhenStartCyc, Cyc.WhenEndCyc
				FROM Cyc
				LEFT JOIN Cart ON Cart.IDCyc = Cyc.IDCyc
				LEFT JOIN InvcProducerWeb ON InvcProducerWeb.IDCyc = Cyc.IDCyc
				WHERE Cyc.WhenEndCyc < NOW()
					AND Cart.IDCart IS NULL AND InvcProducerWeb.IDInvcProducerWeb IS NULL
				ORDER BY Cyc.IDCyc LIMIT 2`,
    );
    if (oCycRows.length < 2) throw Error("Need two empty past cycles.");
    oCyc = oCycRows[0];
    IDCycTest = oCyc.IDCyc;
    IDCycEmpty = oCycRows[1].IDCyc;

    const [oMembRows] = await Conn.wExec("SELECT IDMemb FROM Memb LIMIT 1");
    const [oProducerRows] = await Conn.wExec("SELECT IDProducer FROM Producer LIMIT 1");
    const [oLocRows] = await Conn.wExec("SELECT CdLoc FROM Loc LIMIT 1");
    IDMemb = oMembRows[0].IDMemb;
    IDProducer = oProducerRows[0].IDProducer;
    const oCdLoc = oLocRows[0].CdLoc;

    oConn = await wConnNew();
    await oConn.wTransact();

    // --- Web shopper invoice with taxable/non-taxable, EBT, forgiven fee,
    // and delivery fee. Ttl = 40 + 60 + 4 + 6 + 5.50 + 3 = 118.50:
    await oConn.wExecPrep(
      `INSERT INTO Cart (IDCyc, IDMemb, CdLoc, CdStatCart)
				VALUES (:IDCyc, :IDMemb, :CdLoc, 'Pick')`,
      { IDCyc: IDCycTest, IDMemb, CdLoc: oCdLoc },
    );
    const [oCartRows] = await oConn.wExecPrep(
      `SELECT IDCart FROM Cart WHERE IDCyc = :IDCyc AND IDMemb = :IDMemb`,
      { IDCyc: IDCycTest, IDMemb },
    );
    await oConn.wExecPrep(
      `INSERT INTO InvcShopWeb (IDCart, NameFileInvc, SaleNomNontaxab,
				FeeCoopShopNontaxab, SaleNomTaxab, FeeCoopShopTaxab, TaxSale,
				FeeCoopShopForgiv, FeeDelivTransfer, TtlMoney, TtlEBT, Ttl)
				VALUES (:IDCart, 'test-web', 40.00, 4.00, 60.00, 6.00, 5.50,
					2.00, 3.00, 98.50, 20.00, 118.50)`,
      { IDCart: oCartRows[0].IDCart },
    );

    // --- On-site retail and wholesale invoices:
    await oConn.wExecPrep(
      `INSERT INTO CartOnsite (IDCyc, IDMembShop, IDMembStaffCreate)
				VALUES (:IDCyc, :IDMemb, :IDMemb), (:IDCyc, :IDMemb, :IDMemb)`,
      { IDCyc: IDCycTest, IDMemb },
    );
    const [oCartsOnsite] = await oConn.wExecPrep(
      `SELECT IDCartOnsite FROM CartOnsite WHERE IDCyc = :IDCyc ORDER BY IDCartOnsite`,
      { IDCyc: IDCycTest },
    );
    // Retail: Ttl = 10 + 20 + 1 + 2 + 1.75 = 34.75, EBT 10:
    await oConn.wExecPrep(
      `INSERT INTO InvcShopOnsite (IDCartOnsite, NameFileInvc, SaleNomNontaxab,
				FeeCoopShopNontaxab, SaleNomTaxab, FeeCoopShopTaxab, TaxSale,
				FeeCoopShopForgiv, TtlMoney, TtlEBT, Ttl, CdInvcType)
				VALUES (:IDCart1, 'test-ret', 10.00, 1.00, 20.00, 2.00, 1.75,
					0.00, 24.75, 10.00, 34.75, 'Retail'),
				(:IDCart2, 'test-whl', 200.00, 0.00, 0.00, 0.00, 0.00,
					0.00, 200.00, 0.00, 200.00, 'Wholesale')`,
      { IDCart1: oCartsOnsite[0].IDCartOnsite, IDCart2: oCartsOnsite[1].IDCartOnsite },
    );

    // --- Producer invoices with co-op and inventory fee credits.
    // Web: gross 100, fees 10, earnings 90. Retail: 30/3/27.
    // Wholesale: 100/5/95:
    await oConn.wExecPrep(
      `INSERT INTO InvcProducerWeb (IDCyc, IDProducer, NameFileInvc, SaleNom,
				FeeCoop, FeeInvt, Ttl)
				VALUES (:IDCyc, :IDProducer, 'test-pw', 100.00, 8.00, 2.00, 90.00)`,
      { IDCyc: IDCycTest, IDProducer },
    );
    await oConn.wExecPrep(
      `INSERT INTO InvcProducerOnsite (IDCyc, IDProducer, NameFileInvc, SaleNom,
				FeeCoop, FeeInvt, Ttl, CdInvcType)
				VALUES (:IDCyc, :IDProducer, 'test-pr', 30.00, 3.00, 0.00, 27.00, 'Retail'),
				(:IDCyc, :IDProducer, 'test-pl', 100.00, 5.00, 0.00, 95.00, 'Wholesale')`,
      { IDCyc: IDCycTest, IDProducer },
    );

    // --- Membership fees and a refund inside the cycle window:
    const oWhenInCyc = new Date(new Date(oCyc.WhenStartCyc).getTime() + 3600_000);
    await oConn.wExecPrep(
      `INSERT INTO Transact (IDMemb, CdTypeTransact, AmtMoney, WhenCreate)
				VALUES (:IDMemb, 'FeeMembInit', 50.00, :WhenInCyc),
				(:IDMemb, 'FeeMembRenew', 25.00, :WhenInCyc),
				(:IDMemb, 'RefundFeeMembInit', -10.00, :WhenInCyc)`,
      { IDMemb, WhenInCyc: oWhenInCyc },
    );

    // --- Daily cash payments on the fixture business date, plus one row on
    // the next date that must not leak into the batch:
    const oWindow = WindowOfDate(DateBatchTest);
    const oWhenInDay = new Date(oWindow.WhenStart.getTime() + 5 * 3600_000);
    const oWhenNextDay = new Date(oWindow.WhenEnd.getTime() + 3600_000);
    await oConn.wExecPrep(
      `INSERT INTO Transact (IDMemb, CdTypeTransact, CdMethPay, AmtMoney, WhenCreate)
				VALUES (:IDMemb, 'PayRecv', 'Cash', -30.00, :WhenInDay),
				(:IDMemb, 'PayRecv', 'Cash', -20.50, :WhenInDay),
				(:IDMemb, 'PayRecv', 'Cash', -99.00, :WhenNextDay)`,
      { IDMemb, WhenInDay: oWhenInDay, WhenNextDay: oWhenNextDay },
    );
  } catch (aErr) {
    console.warn(`Skipping QuickBooks snapshot integration tests: ${aErr.message}`);
    if (oConn) {
      await oConn.wRollback();
      oConn.Release();
      oConn = null;
    }
  }
});

afterAll(async () => {
  if (oConn) {
    await oConn.wRollback();
    oConn.Release();
  }
});

describe("channel journals", () => {
  it("reconciles the web channel with EBT split and delivery fees", async () => {
    if (!oConn) return;
    const oSnapshot = await wSnapshotChannelJournal(IDCycTest, "Web", oConn);
    expect(oSnapshot.DocNumber).toBe(`SC${IDCycTest}-WEB`);
    expect(oSnapshot.Control.Charge).toBe(118.5);
    expect(oSnapshot.Control.ChargeMoney).toBe(98.5);
    expect(oSnapshot.Control.ChargeEBT).toBe(20);
    expect(oSnapshot.Control.FeeCoopShopForgiv).toBe(2);

    const oAmtOfRole = oCdRole =>
      oSnapshot.Lines.find(o => o.CdRoleAcct === oCdRole)?.Amt;
    expect(oAmtOfRole("AcctMembAR")).toBe(118.5);
    expect(oAmtOfRole("AcctIncomeSales")).toBe(100);
    expect(oAmtOfRole("AcctIncomeFeeCoopShop")).toBe(10);
    expect(oAmtOfRole("AcctIncomeDeliv")).toBe(3);
    expect(oAmtOfRole("AcctLiabTaxSale")).toBe(5.5);
  });

  it("reconciles on-site retail separately from wholesale", async () => {
    if (!oConn) return;
    const oRetail = await wSnapshotChannelJournal(IDCycTest, "OnsiteRetail", oConn);
    expect(oRetail.DocNumber).toBe(`SC${IDCycTest}-RET`);
    expect(oRetail.Control.Charge).toBe(34.75);
    expect(oRetail.Control.ChargeEBT).toBe(10);
    expect(oRetail.Lines.every(o => o.CdRoleClass === "ClassOnsiteRetail" || !o.CdRoleClass)).toBe(
      true,
    );

    const oWholesale = await wSnapshotChannelJournal(IDCycTest, "Wholesale", oConn);
    expect(oWholesale.DocNumber).toBe(`SC${IDCycTest}-WHL`);
    expect(oWholesale.Control.Charge).toBe(200);
    expect(oWholesale.Lines.find(o => o.CdRoleAcct === "AcctIncomeSales").Amt).toBe(200);
  });

  it("returns null for a zero-value cycle", async () => {
    if (!oConn) return;
    for (const oCdChannel of ["Web", "OnsiteRetail", "Wholesale"])
      expect(await wSnapshotChannelJournal(IDCycEmpty, oCdChannel, oConn)).toBeNull();
  });
});

describe("membership journal", () => {
  it("aggregates fees and refunds into a balanced journal", async () => {
    if (!oConn) return;
    const oSnapshot = await wSnapshotMembershipJournal(IDCycTest, oConn);
    expect(oSnapshot.Control.FeeMembInit).toBe(50);
    expect(oSnapshot.Control.FeeMembRenew).toBe(25);
    expect(oSnapshot.Control.RefundFeeMembInit).toBe(10);

    const oDebitAR = oSnapshot.Lines.find(
      o => o.PostingType === "Debit" && o.CdRoleAcct === "AcctMembAR",
    );
    expect(oDebitAR.Amt).toBe(75);
    const oDebitRefund = oSnapshot.Lines.find(
      o => o.PostingType === "Debit" && o.CdRoleAcct === "AcctIncomeMembership",
    );
    expect(oDebitRefund.Amt).toBe(10);
  });

  it("returns null when the cycle window had no membership activity", async () => {
    if (!oConn) return;
    expect(await wSnapshotMembershipJournal(IDCycEmpty, oConn)).toBeNull();
  });
});

describe("producer bills and fee credits", () => {
  it("lists producers active in the cycle", async () => {
    if (!oConn) return;
    expect(await wProducersInCyc(IDCycTest, oConn)).toContain(IDProducer);
    expect(await wProducersInCyc(IDCycEmpty, oConn)).toEqual([]);
  });

  it("builds a gross bill and fee credit across all three channels", async () => {
    if (!oConn) return;
    const oSnapshot = await wSnapshotProducerBill(IDCycTest, IDProducer, oConn);
    expect(oSnapshot.Control).toMatchObject({ Gross: 230, Fees: 18, Earnings: 212 });

    expect(oSnapshot.Bill.DocNumber).toBe(`SB${IDCycTest}-${IDProducer}`);
    expect(oSnapshot.Bill.Total).toBe(230);
    expect(oSnapshot.Bill.Lines.map(o => o.CdRoleClass).sort()).toEqual([
      "ClassOnsiteRetail",
      "ClassWeb",
      "ClassWholesale",
    ]);

    expect(oSnapshot.VendorCredit.DocNumber).toBe(`SV${IDCycTest}-${IDProducer}`);
    expect(oSnapshot.VendorCredit.Total).toBe(18);
    const oFeeInvt = oSnapshot.VendorCredit.Lines.find(
      o => o.CdRoleAcct === "AcctIncomeFeeInvt",
    );
    expect(oFeeInvt.Amt).toBe(2);
    expect(oFeeInvt.CdRoleClass).toBe("ClassWeb");
  });
});

describe("daily payment journal", () => {
  it("batches one business date and method, excluding later days", async () => {
    if (!oConn) return;
    const oSnapshot = await wSnapshotDailyPaymentJournal(
      DateBatchTest,
      "Cash",
      WhenCutoverOld,
      oConn,
    );
    expect(oSnapshot.DocNumber).toBe("SP20260115-CASH");
    expect(oSnapshot.Control.CtTransact).toBe(2);
    // Received payments are negative in the ledger; the journal debits the
    // clearing account and credits member A/R with the positive sum:
    expect(oSnapshot.Control.Net).toBe(-50.5);
    const oDebit = oSnapshot.Lines.find(o => o.PostingType === "Debit");
    expect(oDebit.CdRoleAcct).toBe("AcctClearingCash");
    expect(oDebit.Amt).toBe(50.5);
    const oCredit = oSnapshot.Lines.find(o => o.PostingType === "Credit");
    expect(oCredit.CdRoleAcct).toBe("AcctMembAR");
    expect(oCredit.Amt).toBe(50.5);
  });

  it("suppresses batches entirely before the cutover", async () => {
    if (!oConn) return;
    const oSnapshot = await wSnapshotDailyPaymentJournal(
      DateBatchTest,
      "Cash",
      new Date("2027-01-01T00:00:00Z"),
      oConn,
    );
    expect(oSnapshot).toBeNull();
  });

  it("returns null for a method with no activity", async () => {
    if (!oConn) return;
    expect(
      await wSnapshotDailyPaymentJournal(DateBatchTest, "Square", WhenCutoverOld, oConn),
    ).toBeNull();
  });
});
