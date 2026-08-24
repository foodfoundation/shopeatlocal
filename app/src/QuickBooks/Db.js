// QuickBooks/Db.js
// ----------------
// Persistence for the QuickBooks Online integration: connection/token storage,
// entity mappings, the durable sync-job outbox, document links, and audit
// events. Uses the shared pool and transactional connection conventions from
// src/Db.js.

import { Conn, wConnNew } from "../Db.js";
import { Encrypt, Decrypt } from "./Crypto.js";

function jsonText(aVal) {
  return aVal === null || aVal === undefined ? null : JSON.stringify(aVal);
}

// ----------
// Connection
// ----------

/** Returns the active (non-disconnected) connection row, or null. Tokens
 *  remain encrypted; use wTokensFromConnection to read them. */
export async function wConnection(aConn) {
  if (!aConn) aConn = Conn;
  const oSQL = `SELECT *
		FROM QuickBooksConnection
		WHERE CdStatusQuickBooksConnection != 'Disconnected'
		ORDER BY IDQuickBooksConnection DESC
		LIMIT 1`;
  const [oRows] = await aConn.wExecPrep(oSQL);
  return oRows.length ? oRows[0] : null;
}

export async function wConnectionFromID(aID, aConn) {
  if (!aConn) aConn = Conn;
  const oSQL = `SELECT *
		FROM QuickBooksConnection
		WHERE IDQuickBooksConnection = :ID`;
  const [oRows] = await aConn.wExecPrep(oSQL, { ID: aID });
  return oRows.length ? oRows[0] : null;
}

export function TokensFromConnection(aConnection) {
  return {
    AccessToken: Decrypt(aConnection.EncAccessToken),
    RefreshToken: Decrypt(aConnection.EncRefreshToken),
  };
}

/** Creates or replaces the connection for a realm after OAuth authorization.
 *  Reconnecting an existing realm updates it in place so mappings, jobs, and
 *  cutover survive reauthorization. */
export async function wUpsert_Connection(aData, aConn) {
  if (!aConn) aConn = Conn;
  const oSQL = `INSERT INTO QuickBooksConnection (
			RealmID, EnvironmentName, CompanyName, CdStatusQuickBooksConnection,
			EncAccessToken, EncRefreshToken, WhenAccessTokenExpires,
			WhenRefreshTokenExpires, IDMembStaffConnect, WhenConnect, WhenTokenRefresh
		)
		VALUES (
			:RealmID, :EnvironmentName, :CompanyName, 'Connected',
			:EncAccessToken, :EncRefreshToken, :WhenAccessTokenExpires,
			:WhenRefreshTokenExpires, :IDMembStaffConnect, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
		)
		ON DUPLICATE KEY UPDATE
			EnvironmentName = VALUES(EnvironmentName),
			CompanyName = COALESCE(VALUES(CompanyName), CompanyName),
			CdStatusQuickBooksConnection = 'Connected',
			EncAccessToken = VALUES(EncAccessToken),
			EncRefreshToken = VALUES(EncRefreshToken),
			WhenAccessTokenExpires = VALUES(WhenAccessTokenExpires),
			WhenRefreshTokenExpires = VALUES(WhenRefreshTokenExpires),
			IDMembStaffConnect = VALUES(IDMembStaffConnect),
			WhenConnect = CURRENT_TIMESTAMP,
			WhenDisconnect = NULL,
			WhenTokenRefresh = CURRENT_TIMESTAMP`;
  const oParams = {
    RealmID: aData.RealmID,
    EnvironmentName: aData.EnvironmentName,
    CompanyName: aData.CompanyName || null,
    EncAccessToken: Encrypt(aData.AccessToken),
    EncRefreshToken: Encrypt(aData.RefreshToken),
    WhenAccessTokenExpires: aData.WhenAccessTokenExpires,
    WhenRefreshTokenExpires: aData.WhenRefreshTokenExpires,
    IDMembStaffConnect: aData.IDMembStaffConnect || null,
  };
  await aConn.wExecPrep(oSQL, oParams);
  return await wConnection(aConn);
}

/** Atomically persists rotated tokens. Must be called with the connection row
 *  locked (see wWithConnectionLock). */
export async function wUpd_ConnectionTokens(aIDConnection, aTokens, aConn) {
  if (!aConn) aConn = Conn;
  const oSQL = `UPDATE QuickBooksConnection
		SET EncAccessToken = :EncAccessToken,
			EncRefreshToken = :EncRefreshToken,
			WhenAccessTokenExpires = :WhenAccessTokenExpires,
			WhenRefreshTokenExpires = :WhenRefreshTokenExpires,
			CdStatusQuickBooksConnection = 'Connected',
			WhenTokenRefresh = CURRENT_TIMESTAMP
		WHERE IDQuickBooksConnection = :ID`;
  await aConn.wExecPrep(oSQL, {
    ID: aIDConnection,
    EncAccessToken: Encrypt(aTokens.AccessToken),
    EncRefreshToken: Encrypt(aTokens.RefreshToken),
    WhenAccessTokenExpires: aTokens.WhenAccessTokenExpires,
    WhenRefreshTokenExpires: aTokens.WhenRefreshTokenExpires,
  });
}

export async function wUpd_ConnectionStatus(aIDConnection, aStatus, aConn) {
  if (!aConn) aConn = Conn;
  const oSQL = `UPDATE QuickBooksConnection
		SET CdStatusQuickBooksConnection = :Status,
			WhenDisconnect = IF(:Status = 'Disconnected', CURRENT_TIMESTAMP, WhenDisconnect)
		WHERE IDQuickBooksConnection = :ID`;
  await aConn.wExecPrep(oSQL, { ID: aIDConnection, Status: aStatus });
}

export async function wUpd_ConnectionSettings(aIDConnection, aData, aConn) {
  if (!aConn) aConn = Conn;
  const oSets = [];
  const oParams = { ID: aIDConnection };
  if (aData.IDCycCutover !== undefined) {
    oSets.push("IDCycCutover = :IDCycCutover");
    oParams.IDCycCutover = aData.IDCycCutover;
  }
  if (aData.CkPostingEnabled !== undefined) {
    oSets.push("CkPostingEnabled = :CkPostingEnabled");
    oParams.CkPostingEnabled = aData.CkPostingEnabled ? 1 : 0;
  }
  if (aData.CkBootstrapped !== undefined) {
    oSets.push("CkBootstrapped = :CkBootstrapped");
    oParams.CkBootstrapped = aData.CkBootstrapped ? 1 : 0;
  }
  if (aData.CompanyName !== undefined) {
    oSets.push("CompanyName = :CompanyName");
    oParams.CompanyName = aData.CompanyName;
  }
  if (!oSets.length) return;
  const oSQL = `UPDATE QuickBooksConnection
		SET ${oSets.join(", ")}
		WHERE IDQuickBooksConnection = :ID`;
  await aConn.wExecPrep(oSQL, oParams);
}

/** Runs aWork with the connection row locked in a dedicated transaction. Used
 *  to serialize token refreshes: Intuit rotates refresh tokens, and concurrent
 *  refreshes with a stale token invalidate the connection. aWork receives the
 *  freshly-read row and the transactional connection. */
export async function wWithConnectionLock(aIDConnection, aWork) {
  const oConn = await wConnNew();
  try {
    await oConn.wTransact();
    const oSQL = `SELECT *
			FROM QuickBooksConnection
			WHERE IDQuickBooksConnection = :ID
			FOR UPDATE`;
    const [oRows] = await oConn.wExecPrep(oSQL, { ID: aIDConnection });
    if (!oRows.length) throw Error("QuickBooks Db: Connection not found");
    const oResult = await aWork(oRows[0], oConn);
    await oConn.wCommit();
    return oResult;
  } catch (aErr) {
    try {
      await oConn.wRollback();
    } catch {
      // Rollback failures are eclipsed by the original error.
    }
    throw aErr;
  } finally {
    oConn.Release();
  }
}

// --------------
// Entity mapping
// --------------

export async function wEntityMaps(aRealmID, aConn) {
  if (!aConn) aConn = Conn;
  const oSQL = `SELECT *
		FROM QuickBooksEntityMap
		WHERE RealmID = :RealmID
		ORDER BY CdRole, LocalKey`;
  const [oRows] = await aConn.wExecPrep(oSQL, { RealmID: aRealmID });
  return oRows;
}

export async function wEntityMap(aRealmID, aCdRole, aLocalKey, aConn) {
  if (!aConn) aConn = Conn;
  const oSQL = `SELECT *
		FROM QuickBooksEntityMap
		WHERE RealmID = :RealmID AND CdRole = :CdRole AND LocalKey = :LocalKey`;
  const [oRows] = await aConn.wExecPrep(oSQL, {
    RealmID: aRealmID,
    CdRole: aCdRole,
    LocalKey: aLocalKey ?? "",
  });
  return oRows.length ? oRows[0] : null;
}

export async function wUpsert_EntityMap(aData, aConn) {
  if (!aConn) aConn = Conn;
  const oSQL = `INSERT INTO QuickBooksEntityMap (
			RealmID, CdRole, LocalKey, CdTypeQuickBooksEntity, QuickBooksID, Name
		)
		VALUES (:RealmID, :CdRole, :LocalKey, :CdTypeQuickBooksEntity, :QuickBooksID, :Name)
		ON DUPLICATE KEY UPDATE
			QuickBooksID = VALUES(QuickBooksID),
			Name = VALUES(Name)`;
  await aConn.wExecPrep(oSQL, {
    RealmID: aData.RealmID,
    CdRole: aData.CdRole,
    LocalKey: aData.LocalKey ?? "",
    CdTypeQuickBooksEntity: aData.CdTypeQuickBooksEntity,
    QuickBooksID: aData.QuickBooksID,
    Name: aData.Name || null,
  });
}

// ---------
// Sync jobs
// ---------

/** Enqueues a sync job if its SourceKey has not been seen. Safe to call inside
 *  a business transaction: an INSERT IGNORE on the unique SourceKey makes the
 *  enqueue idempotent. */
export async function wAdd_SyncJob(aData, aConn) {
  if (!aConn) aConn = Conn;
  const oSQL = `INSERT IGNORE INTO QuickBooksSyncJob (
			CdTypeQuickBooksSyncJob, SourceKey, IDCyc, CdChannel, DateBatch,
			CdMethPay, IDProducer, IDTransact, IDQuickBooksSyncJobOrig
		)
		VALUES (
			:CdTypeQuickBooksSyncJob, :SourceKey, :IDCyc, :CdChannel, :DateBatch,
			:CdMethPay, :IDProducer, :IDTransact, :IDQuickBooksSyncJobOrig
		)`;
  const oParams = {
    IDCyc: null,
    CdChannel: null,
    DateBatch: null,
    CdMethPay: null,
    IDProducer: null,
    IDTransact: null,
    IDQuickBooksSyncJobOrig: null,
    ...aData,
  };
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  return oRows.affectedRows === 1 ? oRows.insertId : null;
}

export async function wSyncJobFromID(aID, aConn) {
  if (!aConn) aConn = Conn;
  const oSQL = `SELECT *
		FROM QuickBooksSyncJob
		WHERE IDQuickBooksSyncJob = :ID`;
  const [oRows] = await aConn.wExecPrep(oSQL, { ID: aID });
  return oRows.length ? oRows[0] : null;
}

export async function wSyncJobFromSourceKey(aSourceKey, aConn) {
  if (!aConn) aConn = Conn;
  const oSQL = `SELECT *
		FROM QuickBooksSyncJob
		WHERE SourceKey = :SourceKey`;
  const [oRows] = await aConn.wExecPrep(oSQL, { SourceKey: aSourceKey });
  return oRows.length ? oRows[0] : null;
}

/** Claims up to aCt runnable jobs for processing. Daily payment batches are
 *  only claimable after their business date has ended (aDateBatchMax, local
 *  business date). Uses SKIP LOCKED so a competing claimer never blocks. */
export async function wClaim_SyncJobs(aCt, aLeaseSec, aDateBatchMax) {
  const oConn = await wConnNew();
  try {
    await oConn.wTransact();
    // UTC_TIMESTAMP, not NOW: the pool writes datetimes as UTC (timezone 'Z'),
    // so comparisons must not depend on the server's local time zone:
    const oSQLSel = `SELECT IDQuickBooksSyncJob
			FROM QuickBooksSyncJob
			WHERE CdStatusQuickBooksSyncJob IN ('Pending', 'Claimed')
				AND (WhenNextRetry IS NULL OR WhenNextRetry <= UTC_TIMESTAMP())
				AND (WhenLeaseExpires IS NULL OR WhenLeaseExpires < UTC_TIMESTAMP())
			ORDER BY IDQuickBooksSyncJob
			LIMIT ${Number(aCt)}
			FOR UPDATE SKIP LOCKED`;
    const [oRows] = await oConn.wExecPrep(oSQLSel, { DateBatchMax: aDateBatchMax });
    const oIDs = oRows.map(o => o.IDQuickBooksSyncJob);
    if (oIDs.length) {
      const oSQLUpd = `UPDATE QuickBooksSyncJob
				SET CdStatusQuickBooksSyncJob = 'Claimed',
					WhenLeaseExpires = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${Number(aLeaseSec)} SECOND)
				WHERE IDQuickBooksSyncJob IN (${oIDs.join(",")})`;
      await oConn.wExecPrep(oSQLUpd);
    }
    await oConn.wCommit();

    if (!oIDs.length) return [];
    const oSQLJobs = `SELECT *
			FROM QuickBooksSyncJob
			WHERE IDQuickBooksSyncJob IN (${oIDs.join(",")})
			ORDER BY IDQuickBooksSyncJob`;
    const [oJobs] = await Conn.wExecPrep(oSQLJobs);
    return oJobs;
  } catch (aErr) {
    try {
      await oConn.wRollback();
    } catch {
      // Rollback failures are eclipsed by the original error.
    }
    throw aErr;
  } finally {
    oConn.Release();
  }
}

export async function wUpd_SyncJob(aID, aData, aConn) {
  if (!aConn) aConn = Conn;
  const oSets = [];
  const oParams = { ID: aID };
  const oFlds = {
    CdStatusQuickBooksSyncJob: aData.CdStatusQuickBooksSyncJob,
    RequestID: aData.RequestID,
    PayloadJSON: aData.PayloadJSON === undefined ? undefined : jsonText(aData.PayloadJSON),
    PayloadChecksum: aData.PayloadChecksum,
    CtAttempt: aData.CtAttempt,
    WhenNextRetry: aData.WhenNextRetry,
    WhenLeaseExpires: aData.WhenLeaseExpires,
    Error: aData.Error,
    CkAlerted: aData.CkAlerted,
    WhenPosted: aData.WhenPosted,
  };
  for (const oName in oFlds) {
    if (oFlds[oName] === undefined) continue;
    oSets.push(`${oName} = :${oName}`);
    oParams[oName] = oFlds[oName];
  }
  if (!oSets.length) return;
  const oSQL = `UPDATE QuickBooksSyncJob
		SET ${oSets.join(", ")}
		WHERE IDQuickBooksSyncJob = :ID`;
  await aConn.wExecPrep(oSQL, oParams);
}

export async function wSyncJobs(aOpts, aConn) {
  if (!aConn) aConn = Conn;
  const oWhere = [];
  const oParams = {};
  if (aOpts?.Status) {
    oWhere.push("CdStatusQuickBooksSyncJob = :Status");
    oParams.Status = aOpts.Status;
  }
  const oSQL = `SELECT *
		FROM QuickBooksSyncJob
		${oWhere.length ? "WHERE " + oWhere.join(" AND ") : ""}
		ORDER BY IDQuickBooksSyncJob DESC
		LIMIT ${Number(aOpts?.Limit || 100)}`;
  const [oRows] = await aConn.wExecPrep(oSQL, oParams);
  return oRows;
}

export async function wSyncJobCounts(aConn) {
  if (!aConn) aConn = Conn;
  const oSQL = `SELECT CdStatusQuickBooksSyncJob, COUNT(*) AS Ct
		FROM QuickBooksSyncJob
		GROUP BY CdStatusQuickBooksSyncJob`;
  const [oRows] = await aConn.wExecPrep(oSQL);
  const oCounts = { Pending: 0, Claimed: 0, Posted: 0, Blocked: 0, Failed: 0, Skipped: 0 };
  for (const oRow of oRows) oCounts[oRow.CdStatusQuickBooksSyncJob] = oRow.Ct;
  return oCounts;
}

// --------------
// Document links
// --------------

export async function wAdd_EntityLink(aData, aConn) {
  if (!aConn) aConn = Conn;
  const oSQL = `INSERT IGNORE INTO QuickBooksEntityLink (
			IDQuickBooksSyncJob, RealmID, CdTypeQuickBooksDoc, QuickBooksID, DocNumber, AmtTotal
		)
		VALUES (:IDQuickBooksSyncJob, :RealmID, :CdTypeQuickBooksDoc, :QuickBooksID, :DocNumber, :AmtTotal)`;
  await aConn.wExecPrep(oSQL, {
    DocNumber: null,
    AmtTotal: null,
    ...aData,
  });
}

export async function wEntityLinksFromJob(aIDJob, aConn) {
  if (!aConn) aConn = Conn;
  const oSQL = `SELECT *
		FROM QuickBooksEntityLink
		WHERE IDQuickBooksSyncJob = :ID
		ORDER BY IDQuickBooksEntityLink`;
  const [oRows] = await aConn.wExecPrep(oSQL, { ID: aIDJob });
  return oRows;
}

/** Open producer documents for FIFO payout allocation: posted Bills and
 *  VendorCredits for a producer, oldest first, with the amount already applied
 *  by previously posted ProducerPayment jobs. */
export async function wProducerOpenDocs(aIDProducer, aConn) {
  if (!aConn) aConn = Conn;

  const oSQLDocs = `SELECT Link.IDQuickBooksEntityLink, Link.CdTypeQuickBooksDoc,
			Link.QuickBooksID, Link.DocNumber, Link.AmtTotal, Job.IDCyc
		FROM QuickBooksEntityLink AS Link
		JOIN QuickBooksSyncJob AS Job USING (IDQuickBooksSyncJob)
		WHERE Job.IDProducer = :IDProducer
			AND Job.CdTypeQuickBooksSyncJob = 'ProducerBill'
			AND Job.CdStatusQuickBooksSyncJob = 'Posted'
			AND Link.CdTypeQuickBooksDoc IN ('Bill', 'VendorCredit')
		ORDER BY Job.IDCyc, Link.IDQuickBooksEntityLink`;
  const [oDocs] = await aConn.wExecPrep(oSQLDocs, { IDProducer: aIDProducer });

  const oSQLPays = `SELECT PayloadJSON
		FROM QuickBooksSyncJob
		WHERE IDProducer = :IDProducer
			AND CdTypeQuickBooksSyncJob = 'ProducerPayment'
			AND CdStatusQuickBooksSyncJob = 'Posted'`;
  const [oPays] = await aConn.wExecPrep(oSQLPays, { IDProducer: aIDProducer });

  const oApplied = {};
  for (const oPay of oPays) {
    const oPayload =
      typeof oPay.PayloadJSON === "string" ? JSON.parse(oPay.PayloadJSON) : oPay.PayloadJSON;
    for (const oAlloc of oPayload?.Allocations || []) {
      const oID = oAlloc.IDQuickBooksEntityLink;
      oApplied[oID] = (oApplied[oID] || 0) + Number(oAlloc.Amt);
    }
  }

  return oDocs.map(oDoc => ({
    ...oDoc,
    AmtApplied: Number((oApplied[oDoc.IDQuickBooksEntityLink] || 0).toFixed(2)),
  }));
}

// ------------
// Audit events
// ------------

export async function wAdd_Event(aData, aConn) {
  if (!aConn) aConn = Conn;
  const oSQL = `INSERT INTO QuickBooksEvent (
			CdTypeQuickBooksEvent, RealmID, IDQuickBooksSyncJob, DetailJSON, IDMembStaffCreate
		)
		VALUES (:CdTypeQuickBooksEvent, :RealmID, :IDQuickBooksSyncJob, :DetailJSON, :IDMembStaffCreate)`;
  await aConn.wExecPrep(oSQL, {
    CdTypeQuickBooksEvent: aData.CdTypeQuickBooksEvent,
    RealmID: aData.RealmID || null,
    IDQuickBooksSyncJob: aData.IDQuickBooksSyncJob || null,
    DetailJSON: jsonText(aData.Detail),
    IDMembStaffCreate: aData.IDMembStaffCreate || null,
  });
}

export async function wEvents(aLimit, aConn) {
  if (!aConn) aConn = Conn;
  const oSQL = `SELECT *
		FROM QuickBooksEvent
		ORDER BY IDQuickBooksEvent DESC
		LIMIT ${Number(aLimit || 50)}`;
  const [oRows] = await aConn.wExecPrep(oSQL);
  return oRows;
}
