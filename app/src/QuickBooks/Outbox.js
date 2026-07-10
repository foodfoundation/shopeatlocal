// QuickBooks/Outbox.js
// --------------------
// Durable enqueue paths. These run inside the caller's database transaction so
// a committed business event and its sync job are atomic; a rolled-back
// transaction discards both. SourceKeys make every enqueue idempotent.

import { wAdd_SyncJob } from "./Db.js";
import { DateBusiness } from "./Accounting.js";
import { CkFeatureEnabled } from "./Config.js";

export const Channels = ["Web", "OnsiteRetail", "Wholesale"];

/** Enqueues all sync work for a completed cycle: one channel journal per
 *  sales channel, the membership journal, and one Bill/VendorCredit job per
 *  producer with invoices. Call inside the cycle-end transaction, after all
 *  producer invoices and earnings exist and before the cycle advances. */
export async function wEnqueueCycEnd(aIDCyc, aIDsProducer, aConn) {
  if (!CkFeatureEnabled()) return;

  for (const oCdChannel of Channels)
    await wAdd_SyncJob(
      {
        CdTypeQuickBooksSyncJob: "CycChannelJournal",
        SourceKey: `cyc:${aIDCyc}:sales:${oCdChannel}`,
        IDCyc: aIDCyc,
        CdChannel: oCdChannel,
      },
      aConn,
    );

  await wAdd_SyncJob(
    {
      CdTypeQuickBooksSyncJob: "CycMembershipJournal",
      SourceKey: `cyc:${aIDCyc}:membership`,
      IDCyc: aIDCyc,
    },
    aConn,
  );

  for (const oIDProducer of aIDsProducer)
    await wAdd_SyncJob(
      {
        CdTypeQuickBooksSyncJob: "ProducerBill",
        SourceKey: `cyc:${aIDCyc}:bill:${oIDProducer}`,
        IDCyc: aIDCyc,
        IDProducer: oIDProducer,
      },
      aConn,
    );
}

/** Enqueues sync work for a newly recorded ledger transaction, in the same
 *  transaction as the Transact insert. PayRecv, member PaySent, and Adj roll
 *  up into daily batches; producer PaySent gets an individual FIFO payout
 *  job. Charge/Earn/Fee types are covered by the cycle jobs. */
export async function wEnqueueTransact(aIDTransact, aData, aConn) {
  if (!CkFeatureEnabled()) return;

  const oCdType = aData.CdTypeTransact;
  const oDateBatch = DateBusiness(aData.WhenCreate || new Date());

  if (oCdType === "PaySent" && aData.IDProducer) {
    await wAdd_SyncJob(
      {
        CdTypeQuickBooksSyncJob: "ProducerPayment",
        SourceKey: `transact:${aIDTransact}`,
        IDProducer: aData.IDProducer,
        IDTransact: aIDTransact,
      },
      aConn,
    );
    return;
  }

  if (oCdType === "Adj") {
    await wAdd_SyncJob(
      {
        CdTypeQuickBooksSyncJob: "DailyPaymentJournal",
        SourceKey: `adj:${oDateBatch}`,
        DateBatch: oDateBatch,
        CdMethPay: "Adj",
      },
      aConn,
    );
    return;
  }

  if ((oCdType === "PayRecv" || oCdType === "PaySent") && aData.CdMethPay) {
    await wAdd_SyncJob(
      {
        CdTypeQuickBooksSyncJob: "DailyPaymentJournal",
        SourceKey: `pay:${oDateBatch}:${aData.CdMethPay}`,
        DateBatch: oDateBatch,
        CdMethPay: aData.CdMethPay,
      },
      aConn,
    );
  }
}
