-- QuickBooks Online integration
-- -----------------------------
-- Single-realm connection with encrypted rotating OAuth tokens, bootstrapped
-- entity mappings, a durable outbox of sync jobs, links from local documents
-- to created QuickBooks documents, and an audit event log.

CREATE TABLE IF NOT EXISTS `QuickBooksConnection` (
  `IDQuickBooksConnection` int NOT NULL AUTO_INCREMENT,
  `RealmID` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `EnvironmentName` enum('sandbox','production') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CompanyName` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CdStatusQuickBooksConnection` enum('Connected','Expired','Disconnected') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'Connected',
  -- AES-256-GCM ciphertext, 'iv:tag:data' base64:
  `EncAccessToken` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `EncRefreshToken` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `WhenAccessTokenExpires` datetime DEFAULT NULL,
  `WhenRefreshTokenExpires` datetime DEFAULT NULL,
  `IDCycCutover` int DEFAULT NULL,
  `CkPostingEnabled` tinyint NOT NULL DEFAULT '0',
  `CkBootstrapped` tinyint NOT NULL DEFAULT '0',
  `IDMembStaffConnect` int DEFAULT NULL,
  `WhenConnect` datetime DEFAULT NULL,
  `WhenDisconnect` datetime DEFAULT NULL,
  `WhenTokenRefresh` datetime DEFAULT NULL,
  `WhenCreate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `WhenUpdate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`IDQuickBooksConnection`),
  UNIQUE KEY `uqQuickBooksConnection-RealmID` (`RealmID`),
  KEY `kQuickBooksConnection-IDCycCutover` (`IDCycCutover`),
  KEY `kQuickBooksConnection-IDMembStaffConnect` (`IDMembStaffConnect`),
  CONSTRAINT `kQuickBooksConnection-IDCycCutover` FOREIGN KEY (`IDCycCutover`) REFERENCES `Cyc` (`IDCyc`),
  CONSTRAINT `kQuickBooksConnection-IDMembStaffConnect` FOREIGN KEY (`IDMembStaffConnect`) REFERENCES `Memb` (`IDMemb`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Local role -> QuickBooks entity ID. 'CdRole' identifies the accounting role
-- (e.g. 'AcctMembAR', 'ClassWeb', 'CustomerMembAR', 'Vendor'). 'LocalKey'
-- distinguishes instances within a role (payment method for clearing accounts,
-- IDProducer for vendors; empty string otherwise).
CREATE TABLE IF NOT EXISTS `QuickBooksEntityMap` (
  `IDQuickBooksEntityMap` int NOT NULL AUTO_INCREMENT,
  `RealmID` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CdRole` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `LocalKey` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT '',
  `CdTypeQuickBooksEntity` enum('Account','Class','Item','Customer','Vendor') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `QuickBooksID` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `WhenCreate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `WhenUpdate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`IDQuickBooksEntityMap`),
  UNIQUE KEY `uqQuickBooksEntityMap-Realm-Role-Key` (`RealmID`, `CdRole`, `LocalKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Durable outbox. 'SourceKey' uniquely identifies the logical accounting event
-- so enqueueing is idempotent. 'RequestID' is the persistent QuickBooks
-- 'requestid' idempotency root reused on every retry of this job.
CREATE TABLE IF NOT EXISTS `QuickBooksSyncJob` (
  `IDQuickBooksSyncJob` int NOT NULL AUTO_INCREMENT,
  `CdTypeQuickBooksSyncJob` enum('CycChannelJournal','CycMembershipJournal','DailyPaymentJournal','ProducerBill','ProducerPayment','Reversal') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `SourceKey` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CdStatusQuickBooksSyncJob` enum('Pending','Claimed','Posted','Blocked','Failed','Skipped') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'Pending',
  `IDCyc` int DEFAULT NULL,
  `CdChannel` enum('Web','OnsiteRetail','Wholesale') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `DateBatch` date DEFAULT NULL,
  `CdMethPay` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `IDProducer` int DEFAULT NULL,
  `IDTransact` int DEFAULT NULL,
  -- Reversal jobs reference the job whose documents they reverse:
  `IDQuickBooksSyncJobOrig` int DEFAULT NULL,
  `RequestID` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `PayloadJSON` json DEFAULT NULL,
  `PayloadChecksum` char(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CtAttempt` int NOT NULL DEFAULT '0',
  `WhenNextRetry` datetime DEFAULT NULL,
  `WhenLeaseExpires` datetime DEFAULT NULL,
  `Error` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `CkAlerted` tinyint NOT NULL DEFAULT '0',
  `WhenPosted` datetime DEFAULT NULL,
  `WhenCreate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `WhenUpdate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`IDQuickBooksSyncJob`),
  UNIQUE KEY `uqQuickBooksSyncJob-SourceKey` (`SourceKey`),
  KEY `kQuickBooksSyncJob-Status-Retry` (`CdStatusQuickBooksSyncJob`, `WhenNextRetry`),
  KEY `kQuickBooksSyncJob-IDCyc` (`IDCyc`),
  KEY `kQuickBooksSyncJob-IDProducer` (`IDProducer`),
  KEY `kQuickBooksSyncJob-IDTransact` (`IDTransact`),
  KEY `kQuickBooksSyncJob-Orig` (`IDQuickBooksSyncJobOrig`),
  CONSTRAINT `kQuickBooksSyncJob-Orig` FOREIGN KEY (`IDQuickBooksSyncJobOrig`) REFERENCES `QuickBooksSyncJob` (`IDQuickBooksSyncJob`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Documents created in QuickBooks for a sync job. A job can create multiple
-- documents (e.g. a producer Bill plus its fee VendorCredit). Successful links
-- are immutable.
CREATE TABLE IF NOT EXISTS `QuickBooksEntityLink` (
  `IDQuickBooksEntityLink` int NOT NULL AUTO_INCREMENT,
  `IDQuickBooksSyncJob` int NOT NULL,
  `RealmID` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CdTypeQuickBooksDoc` enum('JournalEntry','Bill','VendorCredit','BillPayment') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `QuickBooksID` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `DocNumber` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `AmtTotal` decimal(11,2) DEFAULT NULL,
  `WhenCreate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`IDQuickBooksEntityLink`),
  UNIQUE KEY `uqQuickBooksEntityLink-Doc` (`RealmID`, `CdTypeQuickBooksDoc`, `QuickBooksID`),
  KEY `kQuickBooksEntityLink-Job` (`IDQuickBooksSyncJob`),
  KEY `kQuickBooksEntityLink-DocNumber` (`DocNumber`),
  CONSTRAINT `kQuickBooksEntityLink-Job` FOREIGN KEY (`IDQuickBooksSyncJob`) REFERENCES `QuickBooksSyncJob` (`IDQuickBooksSyncJob`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Connection, bootstrap, and sync audit trail.
CREATE TABLE IF NOT EXISTS `QuickBooksEvent` (
  `IDQuickBooksEvent` int NOT NULL AUTO_INCREMENT,
  `CdTypeQuickBooksEvent` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `RealmID` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `IDQuickBooksSyncJob` int DEFAULT NULL,
  `DetailJSON` json DEFAULT NULL,
  `IDMembStaffCreate` int DEFAULT NULL,
  `WhenCreate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`IDQuickBooksEvent`),
  KEY `kQuickBooksEvent-Type` (`CdTypeQuickBooksEvent`),
  KEY `kQuickBooksEvent-Job` (`IDQuickBooksSyncJob`),
  KEY `kQuickBooksEvent-IDMembStaffCreate` (`IDMembStaffCreate`),
  CONSTRAINT `kQuickBooksEvent-Job` FOREIGN KEY (`IDQuickBooksSyncJob`) REFERENCES `QuickBooksSyncJob` (`IDQuickBooksSyncJob`),
  CONSTRAINT `kQuickBooksEvent-IDMembStaffCreate` FOREIGN KEY (`IDMembStaffCreate`) REFERENCES `Memb` (`IDMemb`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
