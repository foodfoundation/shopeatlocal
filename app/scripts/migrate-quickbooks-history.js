#!/usr/bin/env node
// migrate-quickbooks-history.js
// --------------------------------
// Plans or stages an idempotent historical QuickBooks backfill. The command
// never posts directly; --apply atomically queues normal durable sync jobs,
// which remain paused until staff explicitly enables posting.
//
// Preview:
//   bun run quickbooks:migrate-history -- \
//     --from-cycle 12 --to-cycle 30 --dry-run
//
// Stage after reviewing the preview:
//   bun run quickbooks:migrate-history -- \
//     --from-cycle 12 --to-cycle 30 --apply --set-cutover

import { CkConfigured } from "../src/QuickBooks/Config.js";
import {
  tHistoryMigrationError,
  wPlanHistoryMigration,
  wQueueHistoryMigration,
} from "../src/QuickBooks/History.js";

const Usage = `Usage:
  bun run quickbooks:migrate-history -- \\
    --from-cycle <IDCyc> --to-cycle <IDCyc> --dry-run

  bun run quickbooks:migrate-history -- \\
    --from-cycle <IDCyc> --to-cycle <IDCyc> --apply [--set-cutover]

Options:
  --from-cycle   First completed cycle to migrate (required)
  --to-cycle     Last completed cycle to migrate, inclusive (required)
  --dry-run      Validate sources and check QBO DocNumber conflicts; write nothing
  --apply        Atomically queue the validated migration; never posts directly
  --set-cutover  Set the connection cutover to --from-cycle when required
  --help         Show this help

Safety:
  Posting must be disabled while --apply stages the jobs. Existing SourceKeys
  are left unchanged, so rerunning the same range is idempotent. Unlinked QBO
  documents with matching deterministic DocNumbers abort the migration.`;

function argValue(aName) {
  const oIdx = process.argv.indexOf(aName);
  return oIdx >= 0 ? process.argv[oIdx + 1] : undefined;
}

function intArg(aName) {
  const oRaw = argValue(aName);
  const oVal = Number(oRaw);
  if (!Number.isInteger(oVal) || oVal <= 0)
    throw new tHistoryMigrationError(`${aName} is required and must be a positive cycle ID.`);
  return oVal;
}

function printAndExit(aSummary, aCode) {
  console.log(JSON.stringify(aSummary, null, 2));
  process.exit(aCode);
}

if (process.argv.includes("--help")) {
  console.log(Usage);
  process.exit(0);
}

try {
  const oCkDryRun = process.argv.includes("--dry-run");
  const oCkApply = process.argv.includes("--apply");
  if (oCkDryRun === oCkApply)
    throw new tHistoryMigrationError("Choose exactly one of --dry-run or --apply.");

  if (!CkConfigured())
    throw new tHistoryMigrationError(
      "QuickBooks is not configured. Set QuickBooksClientId, QuickBooksClientSecret, " +
        "QuickBooksRedirectUri, and a 64-hex-character QuickBooksTokenKey.",
    );

  const oOpts = {
    IDCycFrom: intArg("--from-cycle"),
    IDCycTo: intArg("--to-cycle"),
    CkSetCutover: process.argv.includes("--set-cutover"),
  };
  const oResult = oCkApply
    ? await wQueueHistoryMigration(oOpts)
    : await wPlanHistoryMigration(oOpts);

  printAndExit(
    {
      ok: !oResult.Conflicts.length,
      dryRun: oCkDryRun,
      applied: Boolean(oResult.Applied),
      realmId: oResult.RealmID,
      environment: oResult.EnvironmentName,
      companyName: oResult.CompanyName,
      fromCycle: oResult.IDCycFrom,
      toCycle: oResult.IDCycTo,
      cycleCount: oResult.CtCycles,
      sourceWindow: { start: oResult.WhenStart, end: oResult.WhenEnd },
      paymentDateWindow: {
        from: oResult.PaymentDateFrom,
        to: oResult.PaymentDateTo,
        wholeBusinessDates: oResult.CkPaymentBatchesAreWholeBusinessDates,
      },
      postingEnabled: oResult.CkPostingEnabled,
      cutoverCycleCurrent: oResult.IDCycCutoverCurrent,
      cutoverChangeRequired: oResult.CkCutoverChangeRequired,
      cutoverCycleAfterApply: oResult.IDCycCutover ?? null,
      jobCount: oResult.CtJobs,
      jobsNew: oResult.CtJobsNew,
      jobsQueued: oResult.CtJobsQueued ?? 0,
      jobsExisting: oResult.CtJobsExisting,
      countsByType: oResult.CountsByType,
      conflicts: oResult.Conflicts,
      jobs: oResult.Jobs,
      nextStep: oCkDryRun
        ? oResult.Conflicts.length
          ? "Resolve the reported QuickBooks document conflicts; do not apply."
          : "Review this output, then rerun with --apply and --set-cutover if required."
        : "Review the queued jobs in the staff dashboard, then enable posting and monitor each cycle.",
    },
    oResult.Conflicts.length ? 2 : 0,
  );
} catch (aErr) {
  printAndExit(
    {
      ok: false,
      error: aErr.message || String(aErr),
      details: aErr.Details || null,
    },
    1,
  );
}
