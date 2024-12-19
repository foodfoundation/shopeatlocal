-- SQL Schema definition for the shopeatlocal database

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for shopeatlocal
CREATE DATABASE IF NOT EXISTS `shopeatlocal` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `shopeatlocal`;

CREATE TABLE IF NOT EXISTS `Cart` (
  `IDCart` int NOT NULL AUTO_INCREMENT,
  `IDCyc` int NOT NULL,
  `IDMemb` int NOT NULL,
  `CdLoc` varchar(12) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CdStatCart` enum('Pend','Undeliv','Pick','NoShow','Miss') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'Pend',
  PRIMARY KEY (`IDCart`),
  UNIQUE KEY `IDCyc_IDMemb` (`IDCyc`,`IDMemb`),
  KEY `kCart-IDMemb` (`IDMemb`),
  KEY `kCart-CdLoc` (`CdLoc`) USING BTREE,
  CONSTRAINT `kCart-CdLoc` FOREIGN KEY (`CdLoc`) REFERENCES `Loc` (`CdLoc`),
  CONSTRAINT `kCart-IDCyc` FOREIGN KEY (`IDCyc`) REFERENCES `Cyc` (`IDCyc`),
  CONSTRAINT `kCart-IDMemb` FOREIGN KEY (`IDMemb`) REFERENCES `Memb` (`IDMemb`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `CartOnsite` (
  `IDCartOnsite` int NOT NULL AUTO_INCREMENT,
  `IDCyc` int NOT NULL,
  `IDMembShop` int DEFAULT NULL,
  `IDMembStaffCreate` int NOT NULL,
  `WhenCreate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`IDCartOnsite`),
  KEY `kCartOnsite-IDMembShop` (`IDMembShop`),
  KEY `kCartOnsite-IDMembStaffCreate` (`IDMembStaffCreate`),
  KEY `kCartOnsite-IDCyc` (`IDCyc`),
  CONSTRAINT `kCartOnsite-IDCyc` FOREIGN KEY (`IDCyc`) REFERENCES `Cyc` (`IDCyc`),
  CONSTRAINT `kCartOnsite-IDMembShop` FOREIGN KEY (`IDMembShop`) REFERENCES `Memb` (`IDMemb`),
  CONSTRAINT `kCartOnsite-IDMembStaffCreate` FOREIGN KEY (`IDMembStaffCreate`) REFERENCES `Memb` (`IDMemb`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `CartOnsitePend` (
  `IDSess` varchar(128) NOT NULL,
  `IDMembStaffCreate` int NOT NULL,
  `IDMembShop` int DEFAULT NULL,
  `CkEBTNonMemb` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`IDSess`) USING BTREE,
  KEY `kCartOnsitePend-IDMembStaffCreate` (`IDMembStaffCreate`),
  KEY `kCartOnsitePend-IDMembShop` (`IDMembShop`),
  CONSTRAINT `kCartOnsitePend-IDMembShop` FOREIGN KEY (`IDMembShop`) REFERENCES `Memb` (`IDMemb`),
  CONSTRAINT `kCartOnsitePend-IDMembStaffCreate` FOREIGN KEY (`IDMembStaffCreate`) REFERENCES `Memb` (`IDMemb`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `Cat` (
  `IDCat` int NOT NULL AUTO_INCREMENT,
  `NameCat` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`IDCat`) USING BTREE,
  UNIQUE KEY `NameCat-Uniq` (`NameCat`) USING BTREE,
  FULLTEXT KEY `NameCat` (`NameCat`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `CatProducer` (
  `IDProducer` int NOT NULL,
  `IDCat` int NOT NULL,
  PRIMARY KEY (`IDProducer`,`IDCat`) USING BTREE,
  KEY `kCatProducer-IDCat` (`IDCat`) USING BTREE,
  CONSTRAINT `kCatProducer-IDCat` FOREIGN KEY (`IDCat`) REFERENCES `Cat` (`IDCat`),
  CONSTRAINT `kCatProducer-IDProducer` FOREIGN KEY (`IDProducer`) REFERENCES `Producer` (`IDProducer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `Cyc` (
  `IDCyc` int NOT NULL AUTO_INCREMENT,
  `WhenStartCyc` datetime NOT NULL,
  `WhenStartShop` datetime NOT NULL,
  `WhenEndShop` datetime NOT NULL,
  `WhenStartDeliv` datetime NOT NULL,
  `WhenEndDeliv` datetime NOT NULL,
  `WhenStartPickup` datetime NOT NULL,
  `WhenEndPickup` datetime NOT NULL,
  `WhenEndCyc` datetime NOT NULL,
  PRIMARY KEY (`IDCyc`),
  UNIQUE KEY `WhenStart` (`WhenStartCyc`) USING BTREE,
  CONSTRAINT `cCyc_OrderDates` CHECK (((`WhenStartShop` >= `WhenStartCyc`) and (`WhenEndShop` > `WhenStartShop`) and (`WhenStartDeliv` >= `WhenEndShop`) and (`WhenEndDeliv` > `WhenStartDeliv`) and (`WhenStartPickup` >= `WhenEndDeliv`) and (`WhenEndPickup` > `WhenStartPickup`) and (`WhenEndCyc` >= `WhenEndPickup`)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `EvtApp` (
  `IDEvtApp` int NOT NULL AUTO_INCREMENT,
  `CdEvtApp` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `IDMemb` int DEFAULT NULL,
  `IDProducer` int DEFAULT NULL,
  `IDMembStaffCreate` int DEFAULT NULL,
  `zWhen` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`IDEvtApp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `FailLogin` (
  `IDFailLogin` int NOT NULL AUTO_INCREMENT,
  `zWhen` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `IP` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `NameLogin` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`IDFailLogin`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `FlashMemb` (
  `IDFlashMemb` int NOT NULL AUTO_INCREMENT,
  `IDMemb` int NOT NULL,
  `Sty` varchar(12) DEFAULT NULL,
  `Head` varchar(200) DEFAULT NULL,
  `Msg` varchar(500) DEFAULT NULL,
  `zWhen` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`IDFlashMemb`),
  KEY `kFlashMemb-IDMemb` (`IDMemb`),
  CONSTRAINT `kFlashMemb-IDMemb` FOREIGN KEY (`IDMemb`) REFERENCES `Memb` (`IDMemb`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `InvcProducerOnsite` (
  `IDInvcProducerOnsite` int NOT NULL AUTO_INCREMENT,
  `IDCyc` int NOT NULL,
  `IDProducer` int NOT NULL,
  `NameFileInvc` varchar(25) NOT NULL,
  `SaleNom` decimal(9,2) NOT NULL,
  `FeeCoop` decimal(9,2) NOT NULL,
  `FeeInvt` decimal(9,2) NOT NULL,
  `Ttl` decimal(9,2) NOT NULL,
  `WhenCreate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`IDInvcProducerOnsite`),
  UNIQUE KEY `IDCyc_IDProducer` (`IDCyc`,`IDProducer`),
  KEY `kInvcProducerOnsite-IDProducer` (`IDProducer`),
  CONSTRAINT `kInvcProducerOnsite-IDCyc` FOREIGN KEY (`IDCyc`) REFERENCES `Cyc` (`IDCyc`),
  CONSTRAINT `kInvcProducerOnsite-IDProducer` FOREIGN KEY (`IDProducer`) REFERENCES `Producer` (`IDProducer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `InvcProducerWeb` (
  `IDInvcProducerWeb` int NOT NULL AUTO_INCREMENT,
  `IDCyc` int NOT NULL,
  `IDProducer` int NOT NULL,
  `NameFileInvc` varchar(25) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `SaleNom` decimal(9,2) NOT NULL,
  `FeeCoop` decimal(9,2) NOT NULL,
  `FeeInvt` decimal(9,2) NOT NULL,
  `Ttl` decimal(9,2) NOT NULL,
  `WhenUpd` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`IDInvcProducerWeb`),
  UNIQUE KEY `kInvcProducerWeb-IDCyc_IDProducer` (`IDCyc`,`IDProducer`),
  KEY `kInvcProducerWeb-IDProducer` (`IDProducer`),
  CONSTRAINT `kInvcProducerWeb-IDCyc` FOREIGN KEY (`IDCyc`) REFERENCES `Cyc` (`IDCyc`),
  CONSTRAINT `kInvcProducerWeb-IDProducer` FOREIGN KEY (`IDProducer`) REFERENCES `Producer` (`IDProducer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `InvcShopOnsite` (
  `IDInvcShopOnsite` int NOT NULL AUTO_INCREMENT,
  `IDCartOnsite` int NOT NULL,
  `NameFileInvc` varchar(25) NOT NULL,
  `SaleNomNontaxab` decimal(9,2) NOT NULL,
  `FeeCoopShopNontaxab` decimal(9,2) NOT NULL,
  `SaleNomTaxab` decimal(9,2) NOT NULL,
  `FeeCoopShopTaxab` decimal(9,2) NOT NULL,
  `TaxSale` decimal(9,2) NOT NULL,
  `FeeCoopShopForgiv` decimal(9,2) NOT NULL,
  `TtlMoney` decimal(9,2) NOT NULL,
  `TtlEBT` decimal(9,2) NOT NULL,
  `Ttl` decimal(9,2) NOT NULL,
  `WhenCreate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`IDInvcShopOnsite`),
  KEY `kInvcShopOnsite-IDMemb` (`IDCartOnsite`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `InvcShopWeb` (
  `IDInvcShopWeb` int NOT NULL AUTO_INCREMENT,
  `IDCart` int NOT NULL,
  `NameFileInvc` varchar(25) NOT NULL,
  `SaleNomNontaxab` decimal(9,2) NOT NULL,
  `FeeCoopShopNontaxab` decimal(9,2) NOT NULL,
  `SaleNomTaxab` decimal(9,2) NOT NULL,
  `FeeCoopShopTaxab` decimal(9,2) NOT NULL,
  `TaxSale` decimal(9,2) NOT NULL,
  `FeeCoopShopForgiv` decimal(9,2) NOT NULL,
  `FeeDelivTransfer` decimal(9,2) NOT NULL,
  `TtlMoney` decimal(9,2) NOT NULL,
  `TtlEBT` decimal(9,2) NOT NULL,
  `Ttl` decimal(9,2) NOT NULL,
  `WhenUpd` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`IDInvcShopWeb`),
  UNIQUE KEY `IDCart` (`IDCart`),
  CONSTRAINT `kInvcShopWeb-IDCart` FOREIGN KEY (`IDCart`) REFERENCES `Cart` (`IDCart`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `ItCart` (
  `IDItCart` int NOT NULL AUTO_INCREMENT,
  `IDCart` int NOT NULL,
  `IDVty` int NOT NULL,
  `NoteShop` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `NoteShopDenied` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `QtyOrd` smallint unsigned NOT NULL,
  `QtyWithdr` smallint unsigned NOT NULL DEFAULT '0',
  `QtyProm` smallint unsigned NOT NULL,
  `QtyTruant` smallint unsigned DEFAULT NULL,
  `QtyDeliv` smallint unsigned DEFAULT NULL,
  `QtyLost` smallint unsigned DEFAULT NULL,
  `QtyReject` smallint unsigned DEFAULT NULL,
  `QtySold` smallint unsigned DEFAULT NULL,
  `SaleNom` decimal(9,2) unsigned DEFAULT NULL,
  `FeeCoop` decimal(9,2) unsigned DEFAULT NULL,
  `FeeCoopForgiv` decimal(9,2) unsigned DEFAULT NULL,
  `TaxSale` decimal(9,2) unsigned DEFAULT NULL,
  `WhenCreate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`IDItCart`) USING BTREE,
  KEY `kItCart-IDCart` (`IDCart`),
  KEY `kItCart-IDVty` (`IDVty`),
  CONSTRAINT `kItCart-IDCart` FOREIGN KEY (`IDCart`) REFERENCES `Cart` (`IDCart`),
  CONSTRAINT `kItCart-IDVty` FOREIGN KEY (`IDVty`) REFERENCES `Vty` (`IDVty`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `ItCartOnsite` (
  `IDItCartOnsite` int NOT NULL AUTO_INCREMENT,
  `IDCartOnsite` int NOT NULL,
  `IDVty` int NOT NULL,
  `Qty` smallint NOT NULL DEFAULT '1',
  `WgtTtl` float DEFAULT NULL,
  `PriceNom` decimal(9,2) NOT NULL,
  `SaleNom` decimal(9,2) NOT NULL,
  `FeeCoopProducer` decimal(9,2) NOT NULL,
  `FeeInvt` decimal(9,2) NOT NULL,
  `FeeCoopShop` decimal(9,2) NOT NULL,
  `FeeCoopShopForgiv` decimal(9,2) NOT NULL,
  `TaxSale` decimal(9,2) NOT NULL,
  PRIMARY KEY (`IDItCartOnsite`),
  UNIQUE KEY `kIDCartOnsite-IDCartOnsite-IDVty-Uniq` (`IDCartOnsite`,`IDVty`) USING BTREE,
  KEY `kItCartOnsite-IDVty` (`IDVty`),
  CONSTRAINT `kItCartOnsite-IDCartOnsite` FOREIGN KEY (`IDCartOnsite`) REFERENCES `CartOnsite` (`IDCartOnsite`),
  CONSTRAINT `kItCartOnsite-IDVty` FOREIGN KEY (`IDVty`) REFERENCES `Vty` (`IDVty`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `ItCartOnsitePend` (
  `IDSess` varchar(128) NOT NULL,
  `IDVty` int NOT NULL,
  `WgtPer` float NOT NULL DEFAULT '0',
  `Qty` smallint NOT NULL DEFAULT '1',
  PRIMARY KEY (`IDSess`,`IDVty`,`WgtPer`) USING BTREE,
  KEY `kItCartOnsitePend-IDVty` (`IDVty`),
  CONSTRAINT `kItCartOnsitePend-IDSess` FOREIGN KEY (`IDSess`) REFERENCES `CartOnsitePend` (`IDSess`),
  CONSTRAINT `kItCartOnsitePend-IDVty` FOREIGN KEY (`IDVty`) REFERENCES `Vty` (`IDVty`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


DELIMITER //
CREATE PROCEDURE IF NOT EXISTS `ItCart_Add` (
	IN `aIDCart` INT,
	IN `aIDVty` INT
)
Proc: BEGIN
	DECLARE oExcept CONDITION FOR SQLSTATE '45000';

	DECLARE oQtyOffer INT;
	DECLARE oQtyPromAll INT;
	DECLARE oQtyOrdCartOrig INT;
	DECLARE oQtyPromCartOrig INT;

	START TRANSACTION;

	-- Get offer and promise quantities
	-- --------------------------------

	SELECT Vty.QtyOffer,
		IFNULL(zItCartVty.QtyProm, 0) AS QtyProm
	FROM Vty
	LEFT JOIN (
		SELECT Vty.IDVty, SUM(ItCart.QtyProm) AS QtyProm
		FROM Vty
		JOIN ItCart USING (IDVty)
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		GROUP BY Vty.IDVty
		FOR UPDATE
	) AS zItCartVty USING (IDVty)
	WHERE IDVty = aIDVty
	FOR UPDATE
	INTO oQtyOffer, oQtyPromAll;

	IF (oQtyOffer IS NULL) OR (oQtyPromAll IS NULL) THEN
		ROLLBACK;
		SIGNAL oExcept SET MESSAGE_TEXT = 'BAD_VTY';
		LEAVE Proc;
	END IF;

	-- Get original cart quantities
	-- ----------------------------
	-- It would be nice to upsert the record with INSERT INTO / ON DUPLICATE KEY
	-- UPDATE, but SQL, garbage that it is, ignores NULL values when checking for
	-- duplicates, so there is no primary or unique index for this table that
	-- would cause the update to be triggered.

	SELECT QtyOrd, QtyProm
	FROM ItCart
	WHERE IDCart = aIDCart AND IDVty = aIDVty
	FOR UPDATE
	INTO oQtyOrdCartOrig, oQtyPromCartOrig;

	-- Confirm availability
	-- --------------------

	IF (oQtyPromAll >= oQtyOffer) THEN
		ROLLBACK;
		-- Because of race conditions, this isn't an exceptional outcome:
		SELECT 0 AS QtyAdd, IFNULL(oQtyPromCartOrig, 0) AS QtyProm;
		LEAVE Proc;
	END IF;

	-- Insert cart item or update quantities
	-- -------------------------------------

	IF (oQtyOrdCartOrig IS NULL) THEN
		INSERT INTO ItCart (IDCart, IDVty, QtyOrd, QtyProm)
		VALUES (aIDCart, aIDVty, 1, 1);

		COMMIT;
		SELECT 1 AS QtyAdd, 1 AS QtyProm;
		LEAVE Proc;
	END IF;

	UPDATE ItCart
	SET QtyOrd = (oQtyOrdCartOrig + 1), QtyProm = (oQtyPromCartOrig + 1)
	WHERE IDCart = aIDCart AND IDVty = aIDVty;

	COMMIT;
	SELECT 1 AS QtyAdd, (oQtyPromCartOrig + 1) AS QtyProm;
END//
DELIMITER ;

DELIMITER //
CREATE PROCEDURE IF NOT EXISTS `ItCart_Upd` (
	IN `aIDItCart` INT,
	IN `aQtyOrd` INT,
	IN `aNoteShop` VARCHAR(500)
)
Proc: BEGIN
	DECLARE oExcept CONDITION FOR SQLSTATE '45000';

	DECLARE oIDVty INT;
	DECLARE oNoteShopDeniedOrig VARCHAR(200);
	DECLARE oQtyOrdCartOrig INT;
	DECLARE oQtyPromCartOrig INT;
	DECLARE oQtyWithdrCartOrig INT;
	DECLARE oQtyOffer INT;
	DECLARE oQtyPromAll INT;
	DECLARE oQtyAvail INT;
	DECLARE oQtyPromCart INT;
	DECLARE oQtyWithdrCart INT;

	START TRANSACTION;

	-- Get original cart data
	-- ----------------------

	SELECT IDVty, NoteShopDenied, QtyOrd, QtyProm, QtyWithdr
	FROM ItCart
	WHERE IDItCart = aIDItCart
	FOR UPDATE
	INTO oIDVty, oNoteShopDeniedOrig, oQtyOrdCartOrig, oQtyPromCartOrig, 
		oQtyWithdrCartOrig;

	IF (oIDVty IS NULL) THEN
		ROLLBACK;
		SIGNAL oExcept SET MESSAGE_TEXT = 'BAD_IT_CART';
		LEAVE Proc;
	END IF;

	-- Delete cart item
	-- ----------------

	IF (aQtyOrd < 1) THEN
		DELETE FROM ItCart
		WHERE IDItCart = aIDItCart;

		COMMIT;
		SELECT oQtyOrdCartOrig AS QtyOrdOrig, 0 AS QtyProm;
		LEAVE Proc;
	END IF;

	-- Store note
	-- ----------
	-- Update the note separately so that note changes are applied
	-- even if the quantities are wrong.

	-- Don't store the note if the same note has already been denied:
	IF ((aNoteShop IS NULL)
		OR (oNoteShopDeniedOrig IS NULL)
		OR (aNoteShop != oNoteShopDeniedOrig)) THEN

		UPDATE ItCart
		SET NoteShop = aNoteShop, NoteShopDenied = NULL
		WHERE IDItCart = aIDItCart;
	END IF;

	-- Get variety quantities
	-- ----------------------

	SELECT Vty.QtyOffer,
		IFNULL(zItCartVty.QtyProm, 0) AS QtyProm
	FROM Vty
	LEFT JOIN (
		SELECT Vty.IDVty, SUM(ItCart.QtyProm) AS QtyProm
		FROM Vty
		JOIN ItCart USING (IDVty)
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		GROUP BY Vty.IDVty
		FOR UPDATE
	) AS zItCartVty USING (IDVty)
	WHERE Vty.IDVty = oIDVty
	FOR UPDATE
	INTO oQtyOffer, oQtyPromAll;

	IF (oQtyOffer IS NULL) THEN
		ROLLBACK;
		SIGNAL oExcept SET MESSAGE_TEXT = 'BAD_VTY';
		LEAVE Proc;
	END IF;

	-- Check availability
	-- ------------------

	SET oQtyAvail = oQtyOffer - oQtyPromAll + oQtyPromCartOrig;

	IF ((aQtyOrd >= oQtyOrdCartOrig) AND (aQtyOrd > oQtyAvail)) THEN
		SET oQtyPromCart = oQtyAvail;
		-- Keep the original order amount so it can be re-stocked. Do not allow the
		-- amount to be increased, however, if nothing is available:
		SET aQtyOrd = GREATEST(oQtyOrdCartOrig, oQtyPromCart);
	ELSE
		SET oQtyPromCart = aQtyOrd;
	END IF;

	SET oQtyWithdrCart = aQtyOrd - oQtyPromCart;

	-- Update quantities
	-- -----------------

	UPDATE ItCart
	SET QtyOrd = aQtyOrd, QtyProm = oQtyPromCart, QtyWithdr = oQtyWithdrCart
	WHERE IDItCart = aIDItCart;

	COMMIT;
	SELECT oQtyOrdCartOrig AS QtyOrdOrig, oQtyPromCart AS QtyProm;
END//
DELIMITER ;

CREATE TABLE IF NOT EXISTS `ItDeliv` (
  `IDItDeliv` int NOT NULL AUTO_INCREMENT,
  `IDCyc` int NOT NULL,
  `IDVty` int NOT NULL,
  `IDItCart` int DEFAULT NULL,
  `WgtPer` float DEFAULT NULL,
  `QtyProm` smallint NOT NULL DEFAULT '0',
  `QtyTruant` smallint DEFAULT NULL,
  `QtyDeliv` smallint DEFAULT NULL,
  `SaleNom` decimal(9,2) unsigned DEFAULT NULL,
  `FeeCoop` decimal(9,2) unsigned DEFAULT NULL,
  PRIMARY KEY (`IDItDeliv`),
  KEY `kItDeliv-IDCyc` (`IDCyc`),
  KEY `kItDeliv-IDVty` (`IDVty`),
  KEY `kItDeliv-IDItCart` (`IDItCart`),
  CONSTRAINT `kItDeliv-IDCyc` FOREIGN KEY (`IDCyc`) REFERENCES `Cyc` (`IDCyc`),
  CONSTRAINT `kItDeliv-IDItCart` FOREIGN KEY (`IDItCart`) REFERENCES `ItCart` (`IDItCart`),
  CONSTRAINT `kItDeliv-IDVty` FOREIGN KEY (`IDVty`) REFERENCES `Vty` (`IDVty`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `ItPickup` (
  `IDItPickup` int NOT NULL AUTO_INCREMENT,
  `IDItCart` int NOT NULL,
  `WgtPer` float DEFAULT NULL,
  `QtyDeliv` smallint NOT NULL,
  `QtyLost` smallint DEFAULT NULL,
  `QtyReject` smallint DEFAULT NULL,
  `QtySold` smallint DEFAULT NULL,
  PRIMARY KEY (`IDItPickup`),
  KEY `kItPickup-IDItCart` (`IDItCart`),
  CONSTRAINT `kItPickup-IDItCart` FOREIGN KEY (`IDItCart`) REFERENCES `ItCart` (`IDItCart`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


DELIMITER //
CREATE PROCEDURE IF NOT EXISTS `ItsCartFromIDCart` (
	IN `aIDCart` INT
)
BEGIN
	SELECT ItCart.IDItCart, ItCart.QtyOrd, ItCart.QtyProm, ItCart.NoteShop, ItCart.NoteShopDenied,
		Producer.IDProducer, Producer.NameBus,
		Product.IDProduct, Product.NameProduct,
		Vty.IDVty, Vty.CkListWeb, Vty.CkListOnsite, Vty.CkArchiv, Vty.CkInvtMgd, 
		Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax,
		Vty.PriceNomWeb, Vty.QtyOffer,
		zItCartVty.QtyProm AS QtyPromVty,
		IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
		Subcat.CkTaxSale, Subcat.CkEBT
	FROM ItCart
	JOIN Vty USING (IDVty)
	JOIN Product USING (IDProduct)
	JOIN Producer USING (IDProducer)
	JOIN Subcat USING (IDSubcat)
	LEFT JOIN (
		SELECT Vty.IDVty, SUM(ItCart.QtyProm) AS QtyProm
		FROM Vty
		JOIN ItCart USING (IDVty)
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		GROUP BY Vty.IDVty
	) AS zItCartVty USING (IDVty)
	WHERE IDCart = aIDCart
	ORDER BY Producer.NameBus, Producer.IDProducer, 
		Product.NameProduct, Product.IDProduct,
		Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty;
END//
DELIMITER ;

CREATE TABLE IF NOT EXISTS `Loc` (
  `CdLoc` varchar(12) NOT NULL,
  `NameLoc` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CdTypeLoc` enum('Central','Satel','Deliv') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'Satel',
  `Addr` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `Instruct` varchar(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CkActiv` tinyint NOT NULL,
  `CkReqDeactiv` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`CdLoc`),
  UNIQUE KEY `NameLoc` (`NameLoc`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `Login` (
  `IDLogin` int NOT NULL AUTO_INCREMENT,
  `zWhen` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `IP` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `NameLogin` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `IDMemb` int DEFAULT NULL,
  PRIMARY KEY (`IDLogin`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `Memb` (
  `IDMemb` int NOT NULL AUTO_INCREMENT,
  `NameLogin` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `HashPass` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `HashPassLeg` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CkLock` tinyint NOT NULL DEFAULT '0',
  `CdRegMemb` enum('Avail','Pend','Approv','Susp') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'Pend',
  `CkFounder` tinyint(1) NOT NULL DEFAULT '0',
  `CdRegEBT` enum('Avail','Pend','Approv','Susp') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'Avail',
  `CdRegVolun` enum('Avail','Pend','Approv','Susp') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'Avail',
  `CkShowProducer` tinyint NOT NULL DEFAULT '0',
  `CdStaff` enum('StaffSuper','StaffMgr','StaffAccts','StaffDistrib','NotStaff') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'NotStaff',
  `WhenFeeMembLast` datetime DEFAULT NULL,
  `CdLocLast` varchar(12) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'FRAN',
  `NameBus` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `Name1First` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Name1Last` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Name2First` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `Name2Last` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `Addr1` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Addr2` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `City` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `St` varchar(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Zip` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `InstructDeliv` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CkAllowMail` tinyint(1) NOT NULL DEFAULT '0',
  `DistDeliv` float DEFAULT NULL,
  `Phone1` varchar(13) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CkAllowPhone1MsgCart` tinyint(1) NOT NULL DEFAULT '0',
  `Phone2` varchar(13) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CkAllowPhone2MsgCart` tinyint(1) DEFAULT NULL,
  `Email1` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CkAllowEmail1RemindShop` tinyint(1) NOT NULL DEFAULT '0',
  `CkAllowEmail1News` tinyint(1) NOT NULL DEFAULT '0',
  `Email2` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CkAllowEmail2RemindShop` tinyint(1) DEFAULT NULL,
  `CkAllowEmail2News` tinyint(1) DEFAULT NULL,
  `HowHear` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `DtlHowHear` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `Notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `CkMigrate` tinyint NOT NULL DEFAULT '0',
  `WhenReg` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `CkAllowPublicName` tinyint(1) NOT NULL DEFAULT '1',
  `CyclesUsed` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`IDMemb`) USING BTREE,
  UNIQUE KEY `kMemb-NameLogin-Uniq` (`NameLogin`) USING BTREE,
  KEY `kMemb-CdLocLast` (`CdLocLast`) USING BTREE,
  CONSTRAINT `kMemb-CdLocLast` FOREIGN KEY (`CdLocLast`) REFERENCES `Loc` (`CdLoc`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `Producer` (
  `IDProducer` int NOT NULL AUTO_INCREMENT,
  `IDMemb` int NOT NULL,
  `CdProducer` varchar(5) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CdRegProducer` enum('Avail','Pend','Approv','Susp') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'Pend',
  `CkListProducer` tinyint NOT NULL DEFAULT '0',
  `NameImgProducer` varchar(25) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `NameBus` varchar(80) DEFAULT NULL,
  `Addr1` varchar(80) NOT NULL,
  `Addr2` varchar(80) DEFAULT NULL,
  `City` varchar(50) NOT NULL,
  `St` varchar(2) NOT NULL,
  `Zip` varchar(10) NOT NULL,
  `InstructDeliv` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `CkShowAddr` tinyint NOT NULL DEFAULT '0',
  `Phone1` varchar(13) NOT NULL,
  `CkShowPhone1` tinyint NOT NULL DEFAULT '0',
  `Phone2` varchar(13) DEFAULT NULL,
  `CkShowPhone2` tinyint NOT NULL DEFAULT '0',
  `Email` varchar(80) NOT NULL,
  `Web` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `AboutStory` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `AboutProducts` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `AboutPract` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `PractGen` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `CdProductMeat` enum('None','Live','Cuts') NOT NULL DEFAULT 'None',
  `DtlProcessMeatCut` text,
  `DtlPestDiseaseLandSoil` text,
  `DtlLivestockFeed` text,
  `CkFeedsByprodAnimal` tinyint NOT NULL DEFAULT '0',
  `CkHormone` tinyint NOT NULL DEFAULT '0',
  `CkAntibiotic` tinyint NOT NULL DEFAULT '0',
  `DtlAcquisAnimal` text,
  `DtlInfoAddition` text,
  `CkCertOrganic` tinyint NOT NULL DEFAULT '0',
  `CkCertNaturGrown` tinyint NOT NULL DEFAULT '0',
  `CkCertAnimalWelfare` tinyint NOT NULL DEFAULT '0',
  `CkCertFairTrade` tinyint NOT NULL DEFAULT '0',
  `CkLicenseEggHand` tinyint NOT NULL DEFAULT '0',
  `CkLicenseHomeFoodEstab` tinyint NOT NULL DEFAULT '0',
  `CkLicenseKitch` tinyint NOT NULL DEFAULT '0',
  `CkInsurLiab` tinyint NOT NULL DEFAULT '0',
  `DtlCertOther` text,
  `Notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `CkMigrate` tinyint NOT NULL DEFAULT '0',
  `WhenReg` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `WhenEdit` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `Facebook` varchar(200) DEFAULT NULL,
  `Instagram` varchar(200) DEFAULT NULL,
  `YourWebsite` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`IDProducer`) USING BTREE,
  UNIQUE KEY `IDMemb` (`IDMemb`),
  UNIQUE KEY `CdProducer` (`CdProducer`),
  UNIQUE KEY `NameBusUNIQUE` (`NameBus`) USING BTREE,
  FULLTEXT KEY `NameBusFULLTEXT` (`NameBus`),
  CONSTRAINT `kProducer-IDMemb` FOREIGN KEY (`IDMemb`) REFERENCES `Memb` (`IDMemb`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE `ProducerLabelHistory` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `ProducerId` int DEFAULT NULL,
  `LabelType` tinyint DEFAULT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `Product` (
  `IDProduct` int NOT NULL AUTO_INCREMENT,
  `IDProducer` int NOT NULL,
  `NameProduct` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Descrip` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `NameImgProduct` varchar(25) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `IDSubcat` int NOT NULL,
  `CdStor` enum('NON','REF','DAIR','EGGS','FROZ','PLNT') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CkAttrVegan` tinyint NOT NULL DEFAULT '0',
  `CkAttrVeget` tinyint NOT NULL DEFAULT '0',
  `CkAttrGlutenFreeCert` tinyint NOT NULL DEFAULT '0',
  `CkAttrFairTradeCert` tinyint NOT NULL DEFAULT '0',
  `CkAttrOrganCert` tinyint NOT NULL DEFAULT '0',
  `CkAttrNaturGrownCert` tinyint NOT NULL DEFAULT '0',
  `CkAttrNaturGrownSelf` tinyint NOT NULL DEFAULT '0',
  `CkAttrIntegPestMgmtSelf` tinyint NOT NULL DEFAULT '0',
  `CkAttrAnimWelfareCert` tinyint NOT NULL DEFAULT '0',
  `CkAttrFreeRgSelf` tinyint NOT NULL DEFAULT '0',
  `CkAttrCageFreeSelf` tinyint NOT NULL DEFAULT '0',
  `CkAttrGrassFedSelf` tinyint NOT NULL DEFAULT '0',
  `CkAttrHormAntibFreeSelf` tinyint NOT NULL DEFAULT '0',
  `CkMigrate` tinyint NOT NULL DEFAULT '0',
  `WhenCreate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `WhenEdit` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `CkExcludeProducerFee` tinyint NOT NULL DEFAULT '0',
  `CkExcludeConsumerFee` tinyint NOT NULL DEFAULT '0',
  `CkAttrLocalSelf` tinyint NOT NULL DEFAULT '0',
  `CkAttrRaisedCertOrgan` tinyint NOT NULL DEFAULT '0',
  `CkAttrCert100GrassFed` tinyint NOT NULL DEFAULT '0',
  `CkAttrPasturedSelf` tinyint NOT NULL DEFAULT '0',
  `CkAttrVeganCert` tinyint NOT NULL DEFAULT '0',
  `CkAttrRealOrganic` tinyint NOT NULL DEFAULT '0',
  `CkAttrRegenOrganCert` tinyint NOT NULL DEFAULT '0',
  `CkAttrCertBiodynamic` tinyint NOT NULL DEFAULT '0',
  `CkAttrGlutenFree` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`IDProduct`),
  KEY `kProduct-IDProducer` (`IDProducer`),
  KEY `kProduct-IDSubcat` (`IDSubcat`) USING BTREE,
  FULLTEXT KEY `Descrip` (`Descrip`),
  FULLTEXT KEY `NameProduct` (`NameProduct`),
  FULLTEXT KEY `NameProduct_Descrip` (`NameProduct`,`Descrip`),
  CONSTRAINT `kProduct-IDProducer` FOREIGN KEY (`IDProducer`) REFERENCES `Producer` (`IDProducer`),
  CONSTRAINT `kProduct-IDSubcat` FOREIGN KEY (`IDSubcat`) REFERENCES `Subcat` (`IDSubcat`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `ResetPass` (
  `IDResetPass` int NOT NULL AUTO_INCREMENT,
  `zWhen` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `IP` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `NameLogin` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Tok` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`IDResetPass`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `expires` int unsigned NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `Site` (
  `z` int NOT NULL,
  `CtMonthTrialMembNew` tinyint NOT NULL,
  `FeeMembInit` decimal(9,2) NOT NULL,
  `FeeMembRenew` decimal(9,2) NOT NULL,
  `FeeInvtIt` decimal(9,2) NOT NULL,
  `FracFeeCoopProducer` float NOT NULL,
  `FracFeeCoopShop` float NOT NULL,
  `FeeTransfer` decimal(9,2) NOT NULL,
  `FeeDelivBase` decimal(9,2) NOT NULL,
  `FeeDelivMile` decimal(9,2) NOT NULL,
  `FracTaxSale` decimal(9,2) NOT NULL,
  PRIMARY KEY (`z`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `StApp` (
  `z` int NOT NULL AUTO_INCREMENT,
  `IDCyc` int NOT NULL,
  `IDCycPrep` int NOT NULL,
  `CdPhaseCyc` enum('PendCyc','StartCyc','StartShop','EndShop','StartDeliv','EndDeliv','StartPickup','EndPickup') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'PendCyc',
  `CkDisabTrig` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`z`) USING BTREE,
  KEY `kStApp-IDCyc` (`IDCyc`),
  KEY `kStApp-IDCycPrep` (`IDCycPrep`),
  CONSTRAINT `kStApp-IDCyc` FOREIGN KEY (`IDCyc`) REFERENCES `Cyc` (`IDCyc`),
  CONSTRAINT `kStApp-IDCycPrep` FOREIGN KEY (`IDCycPrep`) REFERENCES `Cyc` (`IDCyc`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `Subcat` (
  `IDSubcat` int NOT NULL AUTO_INCREMENT,
  `IDCat` int NOT NULL,
  `NameSubcat` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CkTaxSale` tinyint NOT NULL,
  `CkEBT` tinyint NOT NULL,
  PRIMARY KEY (`IDSubcat`) USING BTREE,
  UNIQUE KEY `IDCat_NameSubcat` (`IDCat`,`NameSubcat`) USING BTREE,
  FULLTEXT KEY `NameSubcat` (`NameSubcat`),
  CONSTRAINT `kSubcat-IDCat` FOREIGN KEY (`IDCat`) REFERENCES `Cat` (`IDCat`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `Transact` (
  `IDTransact` int NOT NULL AUTO_INCREMENT,
  `IDMemb` int DEFAULT NULL,
  `IDProducer` int DEFAULT NULL,
  `IDInvc` int DEFAULT NULL,
  `CdTypeTransact` enum('Migrate','FeeMembInit','FeeMembRenew','RefundFeeMembInit','EarnInvcProducerWeb','EarnInvcProducerOnsite','ChargeInvcShopWeb','ChargeInvcShopOnsite','PayRecv','PaySent','Adj') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CdMethPay` enum('Cash','Check','Credit','Debit','PayPal','GiftCert','Coupon','EBTElec','EBTVouch') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `AmtMoney` decimal(9,2) NOT NULL DEFAULT '0.00',
  `AmtEBT` decimal(9,2) NOT NULL DEFAULT '0.00',
  `FeeCoop` decimal(9,2) NOT NULL DEFAULT '0.00',
  `TaxSale` decimal(9,2) NOT NULL DEFAULT '0.00',
  `Note` text,
  `IDMembStaffCreate` int DEFAULT NULL,
  `WhenCreate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`IDTransact`) USING BTREE,
  KEY `kTransact-IDMemb` (`IDMemb`),
  KEY `kTransact-IDMembStaffCreate` (`IDMembStaffCreate`),
  KEY `kTransact-IDProducer` (`IDProducer`),
  CONSTRAINT `kTransact-IDMemb` FOREIGN KEY (`IDMemb`) REFERENCES `Memb` (`IDMemb`),
  CONSTRAINT `kTransact-IDMembStaffCreate` FOREIGN KEY (`IDMembStaffCreate`) REFERENCES `Memb` (`IDMemb`),
  CONSTRAINT `kTransact-IDProducer` FOREIGN KEY (`IDProducer`) REFERENCES `Producer` (`IDProducer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `Vty` (
  `IDVty` int NOT NULL AUTO_INCREMENT,
  `IDProduct` int NOT NULL,
  `Kind` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `Size` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `WgtMin` float DEFAULT NULL,
  `WgtMax` float DEFAULT NULL,
  `CkInvtMgd` tinyint NOT NULL DEFAULT '0',
  `CkInvtMgdNext` tinyint NOT NULL DEFAULT '0',
  `CkListWeb` tinyint NOT NULL DEFAULT '0',
  `CkListOnsite` tinyint NOT NULL DEFAULT '0',
  `CkArchiv` tinyint NOT NULL DEFAULT '0',
  `QtyOffer` int unsigned NOT NULL DEFAULT '0',
  `PriceNomWeb` decimal(9,2) unsigned NOT NULL,
  `PriceNomWebNext` decimal(9,2) unsigned NOT NULL,
  `QtyOnsite` int unsigned NOT NULL DEFAULT '0',
  `PriceNomOnsite` decimal(9,2) unsigned NOT NULL,
  `CkMigrate` tinyint NOT NULL DEFAULT '0',
  `WhenCreate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `WhenEdit` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `Upc` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`IDVty`),
  UNIQUE KEY `Upc_UNIQUE` (`Upc`),
  KEY `kVty-IDProduct` (`IDProduct`),
  FULLTEXT KEY `Size_Kind` (`Size`,`Kind`),
  CONSTRAINT `kVty-IDProduct` FOREIGN KEY (`IDProduct`) REFERENCES `Product` (`IDProduct`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `WgtItCartOnsite` (
  `IDWgtItCartOnsite` int NOT NULL AUTO_INCREMENT,
  `IDItCartOnsite` int NOT NULL,
  `WgtPer` float NOT NULL,
  `Qty` smallint NOT NULL,
  PRIMARY KEY (`IDWgtItCartOnsite`),
  KEY `kWgtItCartOnsite-IDItCartOnsite` (`IDItCartOnsite`),
  CONSTRAINT `kWgtItCartOnsite-IDItCartOnsite` FOREIGN KEY (`IDItCartOnsite`) REFERENCES `ItCartOnsite` (`IDItCartOnsite`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS `WgtLblOrdWeb` (
  `IDWgtLblOrdWeb` int NOT NULL AUTO_INCREMENT,
  `IDVty` int NOT NULL,
  `NoteShop` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `IDItCart` int DEFAULT NULL,
  `WgtPer` float DEFAULT NULL,
  PRIMARY KEY (`IDWgtLblOrdWeb`) USING BTREE,
  KEY `kWgtLblOrdWeb-IDItCart` (`IDItCart`),
  KEY `kWgtLblOrdWeb-IDVty` (`IDVty`),
  CONSTRAINT `kWgtLblOrdWeb-IDItCart` FOREIGN KEY (`IDItCart`) REFERENCES `ItCart` (`IDItCart`),
  CONSTRAINT `kWgtLblOrdWeb-IDVty` FOREIGN KEY (`IDVty`) REFERENCES `Vty` (`IDVty`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


SET @OLDTMP_SQL_MODE=@@SQL_MODE, SQL_MODE='REAL_AS_FLOAT,PIPES_AS_CONCAT,ANSI_QUOTES,IGNORE_SPACE,ONLY_FULL_GROUP_BY,STRICT_ALL_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
DELIMITER //
CREATE TRIGGER `StApp_AfterUpd` AFTER UPDATE ON `StApp` FOR EACH ROW Proc: BEGIN
	DECLARE oCkDisabTrig TINYINT;
	SELECT CkDisabTrig FROM StApp INTO oCkDisabTrig;
	IF (oCkDisabTrig = 1) THEN
		LEAVE Proc;
	END IF;

	IF (NEW.CdPhaseCyc != OLD.CdPhaseCyc) THEN
		INSERT INTO EvtApp (CdEvtApp) VALUES (NEW.CdPhaseCyc);
	END IF;
END//
DELIMITER ;
SET SQL_MODE=@OLDTMP_SQL_MODE;

ALTER TABLE `Vty` ADD COLUMN `CdVtyType` ENUM('Wholesale', 'Retail') NOT NULL DEFAULT 'Retail';

ALTER TABLE `Memb` ADD COLUMN `CdRegWholesale` enum('Avail', 'Pend', 'Approv', 'Susp') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'Avail' ;

ALTER TABLE `Producer` ADD COLUMN `CdRegWholesale` enum('Avail','Pend','Approv','Susp') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'Avail';

ALTER TABLE `Site` ADD COLUMN `FracFeeCoopWholesaleMemb` DECIMAL(3,2) NOT NULL DEFAULT 0.15;
ALTER TABLE `Site` ADD COLUMN `FracFeeCoopWholesaleProducer` DECIMAL(3,2) NOT NULL DEFAULT 0.15;

ALTER TABLE `CartOnsitePend` ADD COLUMN `CdCartType` ENUM('Wholesale', 'Retail') NOT NULL DEFAULT 'Retail';

ALTER TABLE `CartOnsite` ADD COLUMN `CdCartType` ENUM('Wholesale', 'Retail') NOT NULL DEFAULT 'Retail';

ALTER TABLE `InvcShopOnsite` ADD COLUMN `CdInvcType` ENUM('Wholesale', 'Retail') NOT NULL DEFAULT 'Retail';
ALTER TABLE `InvcShopWeb` ADD COLUMN `CdInvcType` ENUM('Wholesale', 'Retail') NOT NULL DEFAULT 'Retail';
ALTER TABLE `InvcProducerOnsite` ADD COLUMN `CdInvcType` ENUM('Wholesale', 'Retail') NOT NULL DEFAULT 'Retail';

-- The following two lines must be run after each other
ALTER TABLE `InvcProducerOnsite` ADD UNIQUE KEY `IDCyc_IDProducer_CdInvcType` (`IDCyc`,`IDProducer`, `CdInvcType`);
ALTER TABLE `InvcProducerOnsite` DROP INDEX `IDCyc_IDProducer`;

ALTER TABLE `InvcProducerWeb` ADD COLUMN `CdInvcType` ENUM('Wholesale', 'Retail') NOT NULL DEFAULT 'Retail';

ALTER TABLE `Transact` MODIFY COLUMN `CdTypeTransact` enum('Migrate','FeeMembInit','FeeMembRenew','RefundFeeMembInit','EarnInvcProducerWeb','EarnInvcProducerOnsite','EarnInvcProducerOnsiteWholesale', 'ChargeInvcShopWeb','ChargeInvcShopOnsite','ChargeInvcShopOnsiteWholesale','PayRecv','PaySent','Adj') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL;

CREATE TABLE FeeCoopVty(  
    `IDVty` int NOT NULL PRIMARY KEY,
    `FracFeeCoopWholesaleMemb` decimal(3,2) NOT NULL
);

DROP PROCEDURE ItsCartFromIDCart;
CREATE PROCEDURE `ItsCartFromIDCart`(
	IN `aIDCart` INT
)
BEGIN
	SELECT ItCart.IDItCart, ItCart.QtyOrd, ItCart.QtyProm, ItCart.NoteShop, ItCart.NoteShopDenied,
		Producer.IDProducer, Producer.NameBus,
		Product.IDProduct, Product.NameProduct,
		Vty.IDVty, Vty.CkListWeb, Vty.CkListOnsite, Vty.CkArchiv, Vty.CkInvtMgd, 
		Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax,
		Vty.PriceNomWeb, Vty.QtyOffer, Vty.CdVtyType,
		zItCartVty.QtyProm AS QtyPromVty,
		IF(Vty.Size IS NULL, TRUE, FALSE) AS CkPriceVar,
		Subcat.CkTaxSale, Subcat.CkEBT,
        IFNULL(FeeCoopVty.FracFeeCoopWholesaleMemb, (SELECT FracFeeCoopWholesaleMemb FROM Site)) AS FracFeeCoopWholesaleMemb
	FROM ItCart
	JOIN Vty USING (IDVty)
	JOIN Product USING (IDProduct)
	JOIN Producer USING (IDProducer)
	JOIN Subcat USING (IDSubcat)
    LEFT JOIN FeeCoopVty USING (IDVty)
	LEFT JOIN (
		SELECT Vty.IDVty, SUM(ItCart.QtyProm) AS QtyProm
		FROM Vty
		JOIN ItCart USING (IDVty)
		JOIN Cart USING (IDCart)
		JOIN StApp USING (IDCyc)
		GROUP BY Vty.IDVty
	) AS zItCartVty USING (IDVty)
	WHERE IDCart = aIDCart
	ORDER BY Producer.NameBus, Producer.IDProducer, 
		Product.NameProduct, Product.IDProduct,
		Vty.Kind, Vty.Size, Vty.WgtMin, Vty.WgtMax, Vty.IDVty;
END

/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
