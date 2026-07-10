// QuickBooks/Accounting.js
// ------------------------
// Canonical, immutable posting snapshots calculated directly from Cyc,
// Transact, and the Invc* source documents. Amounts are computed in integer
// cents and rendered as decimal strings, and every snapshot is validated for
// balanced debits and credits before it may post. These aggregates reconcile
// to the fields shown by Page/Cashier/accounting-summary.js.

import { createHash } from "node:crypto";
import { Conn } from "../Db.js";
import { TimeZone } from "./Config.js";

// ---------------
// Money utilities
// ---------------

/** Converts a decimal amount to integer cents. */
export function Cents(aAmt) {
  return Math.round(Number(aAmt || 0) * 100);
}

/** Converts integer cents to a decimal number with two places. */
export function Amt(aCents) {
  return Number((aCents / 100).toFixed(2));
}

export function ChecksumFromPayload(aPayload) {
  return createHash("sha256").update(JSON.stringify(aPayload)).digest("hex");
}

/** Returns the local business date (YYYY-MM-DD) of a Date in the co-op's
 *  time zone. */
export function DateBusiness(aWhen) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TimeZone }).format(new Date(aWhen));
}

function msOffset(aWhen) {
  const oParts = new Intl.DateTimeFormat("en-US", {
    timeZone: TimeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(aWhen);
  const oMap = {};
  for (const oPart of oParts) oMap[oPart.type] = oPart.value;
  const oAsUTC = Date.UTC(
    Number(oMap.year),
    Number(oMap.month) - 1,
    Number(oMap.day),
    Number(oMap.hour) % 24,
    Number(oMap.minute),
    Number(oMap.second),
  );
  return oAsUTC - aWhen.getTime();
}

/** UTC instant at which the given local business date begins. Two correction
 *  passes handle DST transitions. */
export function WhenStartOfDate(aDateBusiness) {
  const oMidnightUTC = Date.parse(`${aDateBusiness}T00:00:00Z`);
  let oGuess = new Date(oMidnightUTC);
  for (let oPass = 0; oPass < 2; oPass++) oGuess = new Date(oMidnightUTC - msOffset(oGuess));
  return oGuess;
}

/** UTC window [Start, End) covering one local business date. */
export function WindowOfDate(aDateBusiness) {
  const oNext = new Date(Date.parse(`${aDateBusiness}T00:00:00Z`) + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return { WhenStart: WhenStartOfDate(aDateBusiness), WhenEnd: WhenStartOfDate(oNext) };
}

function dateCompact(aDateBusiness) {
  return String(aDateBusiness).replaceAll("-", "");
}

/** Validates that journal debits equal credits. Returns the shared total in
 *  cents; throws with a reconciliation message when out of balance. */
export function CkBalanced(aLines) {
  let oDebits = 0;
  let oCredits = 0;
  for (const oLine of aLines) {
    if (oLine.PostingType === "Debit") oDebits += Cents(oLine.Amt);
    else oCredits += Cents(oLine.Amt);
  }
  if (oDebits !== oCredits)
    throw Error(
      `Unbalanced journal: debits ${Amt(oDebits)} != credits ${Amt(oCredits)}. ` +
        "Source documents do not reconcile.",
    );
  return oDebits;
}

// -------------
// Method labels
// -------------

/** Short payment-method codes used in deterministic document numbers. */
export const CdMethShort = {
  Cash: "CASH",
  Check: "CHK",
  Credit: "CC",
  Debit: "DBT",
  PayPal: "PP",
  Square: "SQ",
  GiftCert: "GC",
  Coupon: "CPN",
  EBTElec: "EBTE",
  EBTVouch: "EBTV",
  Adj: "ADJ",
};

/** Entity-map roles for the account that a payment method settles into. */
export function CdRoleClearing(aCdMethPay) {
  switch (aCdMethPay) {
    case "GiftCert":
      return "AcctLiabGiftCert";
    case "Coupon":
      return "AcctContraCoupon";
    default:
      return `AcctClearing${aCdMethPay}`;
  }
}

// ------------------------
// Cycle channel sales data
// ------------------------

async function wSumsShopWeb(aIDCyc, aConn) {
  const oSQL = `SELECT IFNULL(SUM(InvcShopWeb.SaleNomNontaxab), 0) AS SaleNomNontaxab,
			IFNULL(SUM(InvcShopWeb.SaleNomTaxab), 0) AS SaleNomTaxab,
			IFNULL(SUM(InvcShopWeb.FeeCoopShopNontaxab + InvcShopWeb.FeeCoopShopTaxab), 0)
				AS FeeCoopShop,
			IFNULL(SUM(InvcShopWeb.FeeCoopShopForgiv), 0) AS FeeCoopShopForgiv,
			IFNULL(SUM(InvcShopWeb.FeeDelivTransfer), 0) AS FeeDelivTransfer,
			IFNULL(SUM(InvcShopWeb.TaxSale), 0) AS TaxSale,
			IFNULL(SUM(InvcShopWeb.TtlMoney), 0) AS ChargeMoney,
			IFNULL(SUM(InvcShopWeb.TtlEBT), 0) AS ChargeEBT,
			IFNULL(SUM(InvcShopWeb.Ttl), 0) AS Charge,
			COUNT(InvcShopWeb.IDInvcShopWeb) AS CtInvc
		FROM Cart
		JOIN InvcShopWeb USING (IDCart)
		WHERE Cart.IDCyc = :IDCyc`;
  const [oRows] = await aConn.wExecPrep(oSQL, { IDCyc: aIDCyc });
  return oRows[0];
}

async function wSumsShopOnsite(aIDCyc, aCdInvcType, aConn) {
  const oSQL = `SELECT IFNULL(SUM(InvcShopOnsite.SaleNomNontaxab), 0) AS SaleNomNontaxab,
			IFNULL(SUM(InvcShopOnsite.SaleNomTaxab), 0) AS SaleNomTaxab,
			IFNULL(SUM(InvcShopOnsite.FeeCoopShopNontaxab + InvcShopOnsite.FeeCoopShopTaxab), 0)
				AS FeeCoopShop,
			IFNULL(SUM(InvcShopOnsite.FeeCoopShopForgiv), 0) AS FeeCoopShopForgiv,
			0 AS FeeDelivTransfer,
			IFNULL(SUM(InvcShopOnsite.TaxSale), 0) AS TaxSale,
			IFNULL(SUM(InvcShopOnsite.TtlMoney), 0) AS ChargeMoney,
			IFNULL(SUM(InvcShopOnsite.TtlEBT), 0) AS ChargeEBT,
			IFNULL(SUM(InvcShopOnsite.Ttl), 0) AS Charge,
			COUNT(InvcShopOnsite.IDInvcShopOnsite) AS CtInvc
		FROM CartOnsite
		JOIN InvcShopOnsite USING (IDCartOnsite)
		WHERE CartOnsite.IDCyc = :IDCyc
			AND InvcShopOnsite.CdInvcType = :CdInvcType`;
  const [oRows] = await aConn.wExecPrep(oSQL, { IDCyc: aIDCyc, CdInvcType: aCdInvcType });
  return oRows[0];
}

async function wCycFromID(aIDCyc, aConn) {
  const oSQL = `SELECT *
		FROM Cyc
		WHERE IDCyc = :IDCyc`;
  const [oRows] = await aConn.wExecPrep(oSQL, { IDCyc: aIDCyc });
  if (!oRows.length) throw Error(`Cycle ${aIDCyc} not found.`);
  return oRows[0];
}

/** Builds the posting snapshot for one cycle sales channel ('Web',
 *  'OnsiteRetail', 'Wholesale'). Returns null when the channel had no
 *  activity. Lines reference entity-map roles, not QuickBooks IDs, so the
 *  snapshot stays valid across re-bootstraps. */
export async function wSnapshotChannelJournal(aIDCyc, aCdChannel, aConn) {
  if (!aConn) aConn = Conn;
  const oCyc = await wCycFromID(aIDCyc, aConn);

  let oSums;
  if (aCdChannel === "Web") oSums = await wSumsShopWeb(aIDCyc, aConn);
  else if (aCdChannel === "OnsiteRetail") oSums = await wSumsShopOnsite(aIDCyc, "Retail", aConn);
  else if (aCdChannel === "Wholesale") oSums = await wSumsShopOnsite(aIDCyc, "Wholesale", aConn);
  else throw Error(`Unknown sales channel '${aCdChannel}'.`);

  if (!oSums.CtInvc || !Cents(oSums.Charge)) return null;

  const oCdRoleClass = {
    Web: "ClassWeb",
    OnsiteRetail: "ClassOnsiteRetail",
    Wholesale: "ClassWholesale",
  }[aCdChannel];
  const oSuffix = { Web: "WEB", OnsiteRetail: "RET", Wholesale: "WHL" }[aCdChannel];

  const oLines = [];
  oLines.push({
    Desc: `Cycle ${aIDCyc} ${aCdChannel} shopper charges`,
    CdRoleAcct: "AcctMembAR",
    CdRoleClass: oCdRoleClass,
    CdRoleEntity: "CustomerMembAR",
    PostingType: "Debit",
    Amt: Amt(Cents(oSums.Charge)),
  });
  const oSaleNom = Cents(oSums.SaleNomNontaxab) + Cents(oSums.SaleNomTaxab);
  if (oSaleNom)
    oLines.push({
      Desc: `Cycle ${aIDCyc} ${aCdChannel} product sales`,
      CdRoleAcct: "AcctIncomeSales",
      CdRoleClass: oCdRoleClass,
      PostingType: "Credit",
      Amt: Amt(oSaleNom),
    });
  if (Cents(oSums.FeeCoopShop))
    oLines.push({
      Desc: `Cycle ${aIDCyc} ${aCdChannel} shopper co-op fees`,
      CdRoleAcct: "AcctIncomeFeeCoopShop",
      CdRoleClass: oCdRoleClass,
      PostingType: "Credit",
      Amt: Amt(Cents(oSums.FeeCoopShop)),
    });
  if (Cents(oSums.FeeDelivTransfer))
    oLines.push({
      Desc: `Cycle ${aIDCyc} delivery/transfer fees`,
      CdRoleAcct: "AcctIncomeDeliv",
      CdRoleClass: oCdRoleClass,
      PostingType: "Credit",
      Amt: Amt(Cents(oSums.FeeDelivTransfer)),
    });
  if (Cents(oSums.TaxSale))
    oLines.push({
      Desc: `Cycle ${aIDCyc} ${aCdChannel} sales tax collected`,
      CdRoleAcct: "AcctLiabTaxSale",
      CdRoleClass: oCdRoleClass,
      PostingType: "Credit",
      Amt: Amt(Cents(oSums.TaxSale)),
    });

  CkBalanced(oLines.map(o => ({ PostingType: o.PostingType, Amt: o.Amt })));

  return {
    CdTypeDoc: "JournalEntry",
    DocNumber: `SC${aIDCyc}-${oSuffix}`,
    TxnDate: DateBusiness(oCyc.WhenEndCyc),
    Memo: `shopeatlocal cycle ${aIDCyc} ${aCdChannel} sales`,
    Lines: oLines,
    Control: {
      IDCyc: aIDCyc,
      CdChannel: aCdChannel,
      CtInvc: Number(oSums.CtInvc),
      Charge: Amt(Cents(oSums.Charge)),
      ChargeMoney: Amt(Cents(oSums.ChargeMoney)),
      ChargeEBT: Amt(Cents(oSums.ChargeEBT)),
      FeeCoopShopForgiv: Amt(Cents(oSums.FeeCoopShopForgiv)),
    },
  };
}

// -------------------------
// Cycle membership journals
// -------------------------

/** Membership fees and refunds recorded during the cycle window, matching the
 *  accounting-summary aggregation. Returns null when there was no activity. */
export async function wSnapshotMembershipJournal(aIDCyc, aConn) {
  if (!aConn) aConn = Conn;
  const oCyc = await wCycFromID(aIDCyc, aConn);

  const oSQL = `SELECT
			IFNULL(SUM(IF(CdTypeTransact = 'FeeMembInit', AmtMoney, 0)), 0) AS FeeMembInit,
			IFNULL(SUM(IF(CdTypeTransact = 'FeeMembRenew', AmtMoney, 0)), 0) AS FeeMembRenew,
			IFNULL(SUM(IF(CdTypeTransact = 'RefundFeeMembInit', -AmtMoney, 0)), 0)
				AS RefundFeeMembInit
		FROM Transact
		WHERE WhenCreate >= :WhenStart AND WhenCreate < :WhenEnd
			AND CdTypeTransact IN ('FeeMembInit', 'FeeMembRenew', 'RefundFeeMembInit')`;
  const [oRows] = await aConn.wExecPrep(oSQL, {
    WhenStart: oCyc.WhenStartCyc,
    WhenEnd: oCyc.WhenEndCyc,
  });
  const oSums = oRows[0];

  const oFees = Cents(oSums.FeeMembInit) + Cents(oSums.FeeMembRenew);
  const oRefunds = Cents(oSums.RefundFeeMembInit);
  if (!oFees && !oRefunds) return null;

  const oLines = [];
  if (oFees) {
    oLines.push({
      Desc: `Cycle ${aIDCyc} membership fees assessed`,
      CdRoleAcct: "AcctMembAR",
      CdRoleEntity: "CustomerMembAR",
      PostingType: "Debit",
      Amt: Amt(oFees),
    });
    oLines.push({
      Desc: `Cycle ${aIDCyc} membership fee income`,
      CdRoleAcct: "AcctIncomeMembership",
      PostingType: "Credit",
      Amt: Amt(oFees),
    });
  }
  if (oRefunds) {
    oLines.push({
      Desc: `Cycle ${aIDCyc} membership fees refunded`,
      CdRoleAcct: "AcctIncomeMembership",
      PostingType: "Debit",
      Amt: Amt(oRefunds),
    });
    oLines.push({
      Desc: `Cycle ${aIDCyc} membership refunds receivable offset`,
      CdRoleAcct: "AcctMembAR",
      CdRoleEntity: "CustomerMembAR",
      PostingType: "Credit",
      Amt: Amt(oRefunds),
    });
  }

  CkBalanced(oLines.map(o => ({ PostingType: o.PostingType, Amt: o.Amt })));

  return {
    CdTypeDoc: "JournalEntry",
    DocNumber: `SM${aIDCyc}`,
    TxnDate: DateBusiness(oCyc.WhenEndCyc),
    Memo: `shopeatlocal cycle ${aIDCyc} membership fees`,
    Lines: oLines,
    Control: {
      IDCyc: aIDCyc,
      FeeMembInit: Amt(Cents(oSums.FeeMembInit)),
      FeeMembRenew: Amt(Cents(oSums.FeeMembRenew)),
      RefundFeeMembInit: Amt(oRefunds),
    },
  };
}

// ----------------------
// Daily payment journals
// ----------------------

/** Received payments, member disbursements, and adjustments for one local
 *  business date and payment method (or 'Adj'). Cutover-aware: rows before
 *  aWhenCutover are excluded. Returns null when nothing qualifies. PayRecv
 *  amounts are stored negative in the ledger; received cash therefore equals
 *  the negated sum. */
export async function wSnapshotDailyPaymentJournal(aDateBatch, aCdMethPay, aWhenCutover, aConn) {
  if (!aConn) aConn = Conn;

  const oCkAdj = aCdMethPay === "Adj";
  const oWindow = WindowOfDate(aDateBatch);
  const oSQL = oCkAdj
    ? `SELECT IDTransact, CdTypeTransact, AmtMoney, AmtEBT
			FROM Transact
			WHERE CdTypeTransact = 'Adj'
				AND WhenCreate >= :WhenStart AND WhenCreate < :WhenEnd
				AND WhenCreate >= :WhenCutover
			ORDER BY IDTransact`
    : `SELECT IDTransact, CdTypeTransact, AmtMoney, AmtEBT
			FROM Transact
			WHERE CdTypeTransact IN ('PayRecv', 'PaySent')
				AND IDProducer IS NULL
				AND CdMethPay = :CdMethPay
				AND WhenCreate >= :WhenStart AND WhenCreate < :WhenEnd
				AND WhenCreate >= :WhenCutover
			ORDER BY IDTransact`;
  const oParams = {
    WhenStart: oWindow.WhenStart,
    WhenEnd: oWindow.WhenEnd,
    WhenCutover: aWhenCutover,
    ...(oCkAdj ? {} : { CdMethPay: aCdMethPay }),
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  if (!oRows.length) return null;

  // Net movement on the member ledger. Negative = balances reduced (payments
  // received); positive = balances increased (disbursements/adjustments).
  let oNet = 0;
  for (const oRow of oRows) oNet += Cents(oRow.AmtMoney) + Cents(oRow.AmtEBT);
  if (!oNet) return null;

  const oCdRoleOther = oCkAdj ? "AcctSuspenseAdj" : CdRoleClearing(aCdMethPay);
  const oLabel = oCkAdj ? "adjustments" : `${aCdMethPay} payments`;

  const oLines =
    oNet < 0
      ? [
          {
            Desc: `${aDateBatch} ${oLabel} received`,
            CdRoleAcct: oCdRoleOther,
            PostingType: "Debit",
            Amt: Amt(-oNet),
          },
          {
            Desc: `${aDateBatch} member receivable settled`,
            CdRoleAcct: "AcctMembAR",
            CdRoleEntity: "CustomerMembAR",
            PostingType: "Credit",
            Amt: Amt(-oNet),
          },
        ]
      : [
          {
            Desc: `${aDateBatch} member receivable increased`,
            CdRoleAcct: "AcctMembAR",
            CdRoleEntity: "CustomerMembAR",
            PostingType: "Debit",
            Amt: Amt(oNet),
          },
          {
            Desc: `${aDateBatch} ${oLabel} disbursed`,
            CdRoleAcct: oCdRoleOther,
            PostingType: "Credit",
            Amt: Amt(oNet),
          },
        ];

  CkBalanced(oLines.map(o => ({ PostingType: o.PostingType, Amt: o.Amt })));

  return {
    CdTypeDoc: "JournalEntry",
    DocNumber: `SP${dateCompact(aDateBatch)}-${CdMethShort[aCdMethPay] || "OTH"}`,
    TxnDate: aDateBatch,
    Memo: `shopeatlocal ${aDateBatch} ${oLabel}`,
    Lines: oLines,
    Control: {
      DateBatch: aDateBatch,
      CdMethPay: aCdMethPay,
      CtTransact: oRows.length,
      IDTransactMax: oRows[oRows.length - 1].IDTransact,
      Net: Amt(oNet),
    },
  };
}

// -------------------------------
// Producer bills and fee credits
// -------------------------------

/** Gross Bill plus fee VendorCredit data for one producer and cycle, with one
 *  line per active channel. Returns null when the producer had no sales. */
export async function wSnapshotProducerBill(aIDCyc, aIDProducer, aConn) {
  if (!aConn) aConn = Conn;
  const oCyc = await wCycFromID(aIDCyc, aConn);

  const oSQL = `SELECT 'Web' AS CdChannel, SaleNom, FeeCoop, FeeInvt, Ttl
		FROM InvcProducerWeb
		WHERE IDCyc = :IDCyc AND IDProducer = :IDProducer
		UNION ALL
		SELECT IF(CdInvcType = 'Wholesale', 'Wholesale', 'OnsiteRetail') AS CdChannel,
			SaleNom, FeeCoop, FeeInvt, Ttl
		FROM InvcProducerOnsite
		WHERE IDCyc = :IDCyc AND IDProducer = :IDProducer`;
  const [oRows] = await aConn.wExecPrep(oSQL, { IDCyc: aIDCyc, IDProducer: aIDProducer });
  if (!oRows.length) return null;

  const oCdRoleClassByChannel = {
    Web: "ClassWeb",
    OnsiteRetail: "ClassOnsiteRetail",
    Wholesale: "ClassWholesale",
  };

  const oBillLines = [];
  const oCreditLines = [];
  let oGross = 0;
  let oFees = 0;
  let oEarn = 0;

  for (const oRow of oRows) {
    const oCdRoleClass = oCdRoleClassByChannel[oRow.CdChannel];
    oGross += Cents(oRow.SaleNom);
    oFees += Cents(oRow.FeeCoop) + Cents(oRow.FeeInvt);
    oEarn += Cents(oRow.Ttl);

    if (Cents(oRow.SaleNom))
      oBillLines.push({
        Desc: `Cycle ${aIDCyc} ${oRow.CdChannel} producer sales`,
        CdRoleAcct: "AcctCOGSProducer",
        CdRoleClass: oCdRoleClass,
        Amt: Amt(Cents(oRow.SaleNom)),
      });
    if (Cents(oRow.FeeCoop))
      oCreditLines.push({
        Desc: `Cycle ${aIDCyc} ${oRow.CdChannel} producer co-op fee`,
        CdRoleAcct: "AcctIncomeFeeCoopProducer",
        CdRoleClass: oCdRoleClass,
        Amt: Amt(Cents(oRow.FeeCoop)),
      });
    if (Cents(oRow.FeeInvt))
      oCreditLines.push({
        Desc: `Cycle ${aIDCyc} ${oRow.CdChannel} managed inventory fee`,
        CdRoleAcct: "AcctIncomeFeeInvt",
        CdRoleClass: oCdRoleClass,
        Amt: Amt(Cents(oRow.FeeInvt)),
      });
  }

  if (oGross - oFees !== oEarn)
    throw Error(
      `Producer ${aIDProducer} cycle ${aIDCyc} does not reconcile: ` +
        `gross ${Amt(oGross)} - fees ${Amt(oFees)} != earnings ${Amt(oEarn)}.`,
    );
  if (!oGross && !oFees) return null;

  return {
    CdTypeDoc: "Bill",
    IDProducer: aIDProducer,
    TxnDate: DateBusiness(oCyc.WhenEndCyc),
    Bill: oGross
      ? {
          DocNumber: `SB${aIDCyc}-${aIDProducer}`,
          Lines: oBillLines,
          Total: Amt(oGross),
        }
      : null,
    VendorCredit: oFees
      ? {
          DocNumber: `SV${aIDCyc}-${aIDProducer}`,
          Lines: oCreditLines,
          Total: Amt(oFees),
        }
      : null,
    Memo: `shopeatlocal cycle ${aIDCyc} producer ${aIDProducer}`,
    Control: {
      IDCyc: aIDCyc,
      IDProducer: aIDProducer,
      Gross: Amt(oGross),
      Fees: Amt(oFees),
      Earnings: Amt(oEarn),
    },
  };
}

/** Producers with any invoice in the cycle, for job fan-out at cycle end. */
export async function wProducersInCyc(aIDCyc, aConn) {
  if (!aConn) aConn = Conn;
  const oSQL = `SELECT DISTINCT IDProducer
		FROM (
			SELECT IDProducer FROM InvcProducerWeb WHERE IDCyc = :IDCyc
			UNION
			SELECT IDProducer FROM InvcProducerOnsite WHERE IDCyc = :IDCyc
		) AS zProducers
		ORDER BY IDProducer`;
  const [oRows] = await aConn.wExecPrep(oSQL, { IDCyc: aIDCyc });
  return oRows.map(o => o.IDProducer);
}

// -----------------
// Producer payments
// -----------------

/** Snapshot for a PaySent disbursement to a producer. FIFO allocation across
 *  open documents happens at posting time (Post.js), because it depends on
 *  which earlier documents have posted. */
export async function wSnapshotProducerPayment(aIDTransact, aConn) {
  if (!aConn) aConn = Conn;
  const oSQL = `SELECT Transact.*, Producer.IDProducer AS IDProducerCk
		FROM Transact
		JOIN Producer USING (IDProducer)
		WHERE IDTransact = :IDTransact`;
  const [oRows] = await aConn.wExecPrep(oSQL, { IDTransact: aIDTransact });
  if (!oRows.length) throw Error(`Transaction ${aIDTransact} not found or has no producer.`);
  const oTransact = oRows[0];
  if (oTransact.CdTypeTransact !== "PaySent")
    throw Error(`Transaction ${aIDTransact} is not a PaySent disbursement.`);

  const oAmt = Cents(oTransact.AmtMoney) + Cents(oTransact.AmtEBT);
  if (oAmt <= 0) return null;

  return {
    CdTypeDoc: "BillPayment",
    IDProducer: oTransact.IDProducer,
    IDTransact: aIDTransact,
    DocNumber: `SPY-T${aIDTransact}`,
    TxnDate: DateBusiness(oTransact.WhenCreate),
    CdMethPay: oTransact.CdMethPay || "Check",
    Memo: `shopeatlocal payout T${aIDTransact}`,
    Total: Amt(oAmt),
    Control: {
      IDTransact: aIDTransact,
      IDProducer: oTransact.IDProducer,
      Amt: Amt(oAmt),
    },
  };
}

/** Allocates a payment FIFO across open producer documents. aDocs come from
 *  Db.wProducerOpenDocs (posted Bills/VendorCredits with amounts already
 *  applied). All open credits are absorbed with this payment; bills are then
 *  paid oldest-first for payment + credits. Throws when the payment exceeds
 *  the producer's open net balance. */
export function AllocatePayment(aAmtPayment, aDocs) {
  const oPayment = Cents(aAmtPayment);

  let oOpenBills = 0;
  let oOpenCredits = 0;
  for (const oDoc of aDocs) {
    const oOpen = Cents(oDoc.AmtTotal) - Cents(oDoc.AmtApplied);
    if (oOpen <= 0) continue;
    if (oDoc.CdTypeQuickBooksDoc === "Bill") oOpenBills += oOpen;
    else oOpenCredits += oOpen;
  }
  if (oPayment > oOpenBills - oOpenCredits)
    throw Error(
      `Payment ${Amt(oPayment)} exceeds the producer's open balance ` +
        `${Amt(oOpenBills - oOpenCredits)}. Have all cycle Bills posted?`,
    );

  const oAllocations = [];
  let oToApplyBills = oPayment;

  // Absorb every open credit; each credit frees the same amount of bill
  // principal, so bills receive payment + credits in total:
  for (const oDoc of aDocs) {
    if (oDoc.CdTypeQuickBooksDoc !== "VendorCredit") continue;
    const oOpen = Cents(oDoc.AmtTotal) - Cents(oDoc.AmtApplied);
    if (oOpen <= 0) continue;
    oAllocations.push({
      IDQuickBooksEntityLink: oDoc.IDQuickBooksEntityLink,
      CdTypeQuickBooksDoc: "VendorCredit",
      QuickBooksID: oDoc.QuickBooksID,
      Amt: Amt(oOpen),
    });
    oToApplyBills += oOpen;
  }

  for (const oDoc of aDocs) {
    if (!oToApplyBills) break;
    if (oDoc.CdTypeQuickBooksDoc !== "Bill") continue;
    const oOpen = Cents(oDoc.AmtTotal) - Cents(oDoc.AmtApplied);
    if (oOpen <= 0) continue;
    const oApply = Math.min(oOpen, oToApplyBills);
    oAllocations.push({
      IDQuickBooksEntityLink: oDoc.IDQuickBooksEntityLink,
      CdTypeQuickBooksDoc: "Bill",
      QuickBooksID: oDoc.QuickBooksID,
      Amt: Amt(oApply),
    });
    oToApplyBills -= oApply;
  }

  if (oToApplyBills)
    throw Error(`Payout allocation failed: ${Amt(oToApplyBills)} could not be applied.`);
  return oAllocations;
}

// ---------
// Reversals
// ---------

/** Builds a reversing journal snapshot from a posted journal payload: same
 *  lines with debit/credit swapped, dated today, numbered from the original. */
export function SnapshotReversalJournal(aPayloadOrig, aIDJobOrig) {
  if (aPayloadOrig?.CdTypeDoc !== "JournalEntry")
    throw Error("Only posted journal entries can be reversed automatically.");
  const oLines = aPayloadOrig.Lines.map(oLine => ({
    ...oLine,
    PostingType: oLine.PostingType === "Debit" ? "Credit" : "Debit",
    Desc: `REVERSAL: ${oLine.Desc}`,
  }));
  return {
    CdTypeDoc: "JournalEntry",
    DocNumber: `SR-${aIDJobOrig}`,
    TxnDate: DateBusiness(new Date()),
    Memo: `Reversal of ${aPayloadOrig.DocNumber} (job ${aIDJobOrig})`,
    Lines: oLines,
    Control: { IDQuickBooksSyncJobOrig: aIDJobOrig, DocNumberOrig: aPayloadOrig.DocNumber },
  };
}
