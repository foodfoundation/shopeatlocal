// Unit fixtures for the QuickBooks accounting snapshot logic: money math,
// balance validation, clearing-account routing, FIFO payout allocation with
// partial payments and fee credits, reversals, and checksum determinism.

import {
  AllocatePayment,
  Amt,
  Cents,
  ChecksumFromPayload,
  CkBalanced,
  CdMethShort,
  CdRoleClearing,
  DateBusiness,
  SnapshotReversalJournal,
  WindowOfDate,
} from "../../src/QuickBooks/Accounting.js";

describe("money math", () => {
  it("converts decimals to cents without float drift", () => {
    expect(Cents(19.99)).toBe(1999);
    expect(Cents("10.10")).toBe(1010);
    expect(Cents(0.1 + 0.2)).toBe(30);
    expect(Cents(null)).toBe(0);
  });

  it("round-trips cents to two-decimal amounts", () => {
    expect(Amt(1999)).toBe(19.99);
    expect(Amt(0)).toBe(0);
    expect(Amt(Cents(1234.56))).toBe(1234.56);
  });
});

describe("CkBalanced", () => {
  it("accepts balanced debits and credits and returns the total", () => {
    const oTotal = CkBalanced([
      { PostingType: "Debit", Amt: 100.5 },
      { PostingType: "Credit", Amt: 90.25 },
      { PostingType: "Credit", Amt: 10.25 },
    ]);
    expect(oTotal).toBe(10050);
  });

  it("throws on unbalanced journals", () => {
    expect(() =>
      CkBalanced([
        { PostingType: "Debit", Amt: 100 },
        { PostingType: "Credit", Amt: 99.99 },
      ]),
    ).toThrow(/Unbalanced/);
  });
});

describe("payment method routing", () => {
  it("routes gift certificates to the liability account", () => {
    expect(CdRoleClearing("GiftCert")).toBe("AcctLiabGiftCert");
  });

  it("routes coupons to contra income", () => {
    expect(CdRoleClearing("Coupon")).toBe("AcctContraCoupon");
  });

  it("routes settlement methods to per-method clearing accounts", () => {
    expect(CdRoleClearing("Cash")).toBe("AcctClearingCash");
    expect(CdRoleClearing("Square")).toBe("AcctClearingSquare");
    expect(CdRoleClearing("EBTVouch")).toBe("AcctClearingEBTVouch");
  });

  it("has a short document-number code for every method", () => {
    for (const oCd of [
      "Cash", "Check", "Credit", "Debit", "PayPal", "Square",
      "GiftCert", "Coupon", "EBTElec", "EBTVouch", "Adj",
    ])
      expect(CdMethShort[oCd]).toBeTruthy();
  });
});

describe("AllocatePayment (FIFO producer payouts)", () => {
  function oDoc(aID, aType, aTotal, aApplied = 0, aIDCyc = 1) {
    return {
      IDQuickBooksEntityLink: aID,
      CdTypeQuickBooksDoc: aType,
      QuickBooksID: `qb-${aID}`,
      AmtTotal: aTotal,
      AmtApplied: aApplied,
      IDCyc: aIDCyc,
    };
  }

  it("pays a single open bill in full", () => {
    const oAllocs = AllocatePayment(100, [oDoc(1, "Bill", 100)]);
    expect(oAllocs).toEqual([
      { IDQuickBooksEntityLink: 1, CdTypeQuickBooksDoc: "Bill", QuickBooksID: "qb-1", Amt: 100 },
    ]);
  });

  it("allows partial payments", () => {
    const oAllocs = AllocatePayment(40, [oDoc(1, "Bill", 100)]);
    expect(oAllocs[0].Amt).toBe(40);
  });

  it("walks bills oldest-first across cycles", () => {
    const oAllocs = AllocatePayment(150, [
      oDoc(1, "Bill", 100, 0, 1),
      oDoc(2, "Bill", 100, 0, 2),
    ]);
    expect(oAllocs).toHaveLength(2);
    expect(oAllocs[0]).toMatchObject({ IDQuickBooksEntityLink: 1, Amt: 100 });
    expect(oAllocs[1]).toMatchObject({ IDQuickBooksEntityLink: 2, Amt: 50 });
  });

  it("skips amounts already applied by earlier payouts", () => {
    const oAllocs = AllocatePayment(60, [oDoc(1, "Bill", 100, 40)]);
    expect(oAllocs[0].Amt).toBe(60);
  });

  it("absorbs fee vendor credits so bills receive payment plus credits", () => {
    // Gross bill 100, fee credit 10: a 90 payout settles the producer:
    const oAllocs = AllocatePayment(90, [
      oDoc(1, "Bill", 100),
      oDoc(2, "VendorCredit", 10),
    ]);
    const oCredit = oAllocs.find(o => o.CdTypeQuickBooksDoc === "VendorCredit");
    const oBill = oAllocs.find(o => o.CdTypeQuickBooksDoc === "Bill");
    expect(oCredit.Amt).toBe(10);
    expect(oBill.Amt).toBe(100);
    // BillPayment total = bills applied - credits applied:
    expect(oBill.Amt - oCredit.Amt).toBe(90);
  });

  it("rejects payments above the open net balance", () => {
    expect(() =>
      AllocatePayment(95, [oDoc(1, "Bill", 100), oDoc(2, "VendorCredit", 10)]),
    ).toThrow(/exceeds the producer's open balance/);
  });

  it("rejects any payment when no bills have posted", () => {
    expect(() => AllocatePayment(10, [])).toThrow(/exceeds the producer's open balance/);
  });
});

describe("SnapshotReversalJournal", () => {
  const oPayloadOrig = {
    CdTypeDoc: "JournalEntry",
    DocNumber: "SC12-WEB",
    TxnDate: "2026-06-30",
    Lines: [
      { Desc: "charges", CdRoleAcct: "AcctMembAR", PostingType: "Debit", Amt: 100 },
      { Desc: "sales", CdRoleAcct: "AcctIncomeSales", PostingType: "Credit", Amt: 100 },
    ],
  };

  it("swaps debits and credits and references the original", () => {
    const oReversal = SnapshotReversalJournal(oPayloadOrig, 42);
    expect(oReversal.DocNumber).toBe("SR-42");
    expect(oReversal.Lines[0].PostingType).toBe("Credit");
    expect(oReversal.Lines[1].PostingType).toBe("Debit");
    expect(oReversal.Lines[0].Amt).toBe(100);
    expect(oReversal.Memo).toContain("SC12-WEB");
    CkBalanced(oReversal.Lines);
  });

  it("refuses to reverse non-journal documents", () => {
    expect(() => SnapshotReversalJournal({ CdTypeDoc: "Bill" }, 1)).toThrow(/journal/);
  });
});

describe("business dates", () => {
  it("renders ISO business dates", () => {
    expect(DateBusiness("2026-07-10T12:00:00Z")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("builds a 24-hour UTC window for a local date", () => {
    const oWindow = WindowOfDate("2026-03-02");
    expect(oWindow.WhenEnd.getTime() - oWindow.WhenStart.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(DateBusiness(oWindow.WhenStart)).toBe("2026-03-02");
    expect(DateBusiness(new Date(oWindow.WhenEnd.getTime() - 1000))).toBe("2026-03-02");
  });

  it("handles the DST spring-forward date", () => {
    // 2026-03-08 has 23 hours in America/Chicago:
    const oWindow = WindowOfDate("2026-03-08");
    expect(DateBusiness(oWindow.WhenStart)).toBe("2026-03-08");
    expect(DateBusiness(new Date(oWindow.WhenEnd.getTime() - 1000))).toBe("2026-03-08");
  });
});

describe("ChecksumFromPayload", () => {
  it("is deterministic and drift-sensitive", () => {
    const oPayload = { DocNumber: "SC1-WEB", Lines: [{ Amt: 10 }] };
    expect(ChecksumFromPayload(oPayload)).toBe(ChecksumFromPayload({ ...oPayload }));
    expect(ChecksumFromPayload(oPayload)).not.toBe(
      ChecksumFromPayload({ ...oPayload, Lines: [{ Amt: 10.01 }] }),
    );
  });
});
