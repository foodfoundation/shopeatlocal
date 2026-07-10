#!/usr/bin/env node
// bootstrap-quickbooks.js
// -----------------------
// Idempotent CLI for the initial QuickBooks Online company setup. Reuses the
// same setup service as the admin UI and operates against the realm that was
// already authorized through the staff dashboard.
//
// Usage:
//   npm run quickbooks:bootstrap -- [--dry-run] [--cutover-cycle <IDCyc>]
//
// Exits nonzero on validation or API failure. Output is a machine-readable
// JSON summary with no tokens or secrets.

import { wBootstrap, wValidateSetup } from "../src/QuickBooks/Bootstrap.js";
import { CkConfigured } from "../src/QuickBooks/Config.js";
import { wConnection, wUpd_ConnectionSettings, wAdd_Event } from "../src/QuickBooks/Db.js";
import { Conn } from "../src/Db.js";

function argValue(aName) {
  const oIdx = process.argv.indexOf(aName);
  return oIdx >= 0 ? process.argv[oIdx + 1] : undefined;
}

function fail(aSummary) {
  console.log(JSON.stringify(aSummary, null, 2));
  process.exit(1);
}

const oCkDryRun = process.argv.includes("--dry-run");
const oCutoverArg = argValue("--cutover-cycle");

try {
  if (!CkConfigured())
    fail({
      ok: false,
      error:
        "QuickBooks is not configured. Set QuickBooksClientId, QuickBooksClientSecret, " +
        "QuickBooksRedirectUri, and a 64-hex-character QuickBooksTokenKey.",
    });

  const oConnection = await wConnection();
  if (!oConnection)
    fail({
      ok: false,
      error: "No authorized QuickBooks realm. Connect through the staff dashboard first.",
    });

  let oIDCycCutover;
  if (oCutoverArg !== undefined) {
    oIDCycCutover = Number(oCutoverArg);
    if (!Number.isInteger(oIDCycCutover) || oIDCycCutover <= 0)
      fail({ ok: false, error: `Invalid --cutover-cycle '${oCutoverArg}'.` });
    const [oCycRows] = await Conn.wExecPrep(
      `SELECT IDCyc, WhenStartCyc, WhenEndCyc FROM Cyc WHERE IDCyc = :IDCyc`,
      { IDCyc: oIDCycCutover },
    );
    if (!oCycRows.length)
      fail({ ok: false, error: `Cutover cycle ${oIDCycCutover} does not exist.` });
  }

  const oResult = await wBootstrap({ CkDryRun: oCkDryRun });

  if (oIDCycCutover !== undefined && !oCkDryRun) {
    await wUpd_ConnectionSettings(oConnection.IDQuickBooksConnection, {
      IDCycCutover: oIDCycCutover,
    });
    await wAdd_Event({
      CdTypeQuickBooksEvent: "CutoverSet",
      RealmID: oConnection.RealmID,
      Detail: { IDCycCutover: oIDCycCutover, Source: "CLI" },
    });
  }

  const oValidation = await wValidateSetup();

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: oCkDryRun,
        realmId: oResult.RealmID,
        environment: oResult.EnvironmentName,
        companyName: oResult.CompanyName,
        setupComplete: oResult.CkComplete,
        setupValid: oValidation.CkValid,
        missingRoles: oValidation.Missing,
        cutoverCycle: oIDCycCutover ?? oConnection.IDCycCutover ?? null,
        steps: oResult.Steps,
      },
      null,
      2,
    ),
  );
  process.exit(oValidation.CkValid || oCkDryRun ? 0 : 1);
} catch (aErr) {
  fail({ ok: false, error: aErr.message || String(aErr) });
}
