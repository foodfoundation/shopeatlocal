-- Fixtures for setting up the initial state of the DB

ALTER USER 'root'@'localhost' IDENTIFIED WITH caching_sha2_password BY '';

INSERT INTO `Site` (`z`, `CtMonthTrialMembNew`, `FeeMembInit`, `FeeMembRenew`, `FeeInvtIt`, `FracFeeCoopProducer`, `FracFeeCoopShop`, `FeeTransfer`, `FeeDelivBase`, `FeeDelivMile`, `FracTaxSale`)
SELECT 1, 1, 10.0000, 10.0000, 10.0000, 0.1, 0.1, 10.0000, 10.0000, 10.0000, 0.1
FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `Site`);

INSERT INTO `Cyc` (`IDCyc`, `WhenStartCyc`, `WhenStartShop`, `WhenEndShop`, `WhenStartDeliv`, `WhenEndDeliv`, `WhenStartPickup`, `WhenEndPickup`, `WhenEndCyc`)
SELECT 1, '2024-02-21 00:00:00', '2024-02-22 00:00:00', '2024-02-24 00:00:00', '2024-02-25 00:00:00', '2024-02-27 00:00:00', '2024-02-28 00:00:00', '2024-03-01 00:00:00', '2024-03-04 00:00:00'
FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `Cyc`);

INSERT INTO `Cyc` (`IDCyc`, `WhenStartCyc`, `WhenStartShop`, `WhenEndShop`, `WhenStartDeliv`, `WhenEndDeliv`, `WhenStartPickup`, `WhenEndPickup`, `WhenEndCyc`)
SELECT 2, '2024-03-04 00:00:00', '2024-03-05 00:00:00', '2024-03-07 00:00:00', '2024-03-08 00:00:00', '2024-03-10 00:00:00', '2024-03-11 00:00:00', '2024-03-15 00:00:00', '2024-03-17 00:00:00'
FROM dual
WHERE (SELECT COUNT(*) FROM `Cyc`) = 1;

INSERT INTO `StApp` (`z`, `IDCyc`, `IDCycPrep`, `CdPhaseCyc`, `CkDisabTrig`)
SELECT 1, 1, 1, 'PendCyc', 0
FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `StApp`);

INSERT INTO `Loc` (`CdLoc`, `NameLoc`, `CdTypeLoc`, `Addr`, `Instruct`, `CkActiv`, `CkReqDeactiv`)
SELECT 'CENTRAL', 'Dummy Location', 'Central', 'Dummy Address', 'Change Me', 1, 0
FROM dual
WHERE NOT EXISTS (SELECT CdLoc FROM `Loc` WHERE CdLoc = 'CENTRAL');

TRUNCATE TABLE IMembFavorates;

INSERT into IMembFavorates ( IDMemb, IDProduct, FavoritedAt)
SELECT 5930, IDProduct , NOW() 
from Product;
INSERT into IMembFavorates ( IDMemb, IDProduct, FavoritedAt)
SELECT 5941, IDProduct , NOW() 
from Product;
INSERT into IMembFavorates ( IDMemb, IDProduct, FavoritedAt)
SELECT 5943, IDProduct , NOW() 
from Product;


INSERT INTO `Memb` (`NameLogin`,`HashPass`,`CdRegMemb`,`CdRegEBT`,`CdRegVolun`,`CdStaff`,`CdLocLast`,`Name1First`,`Name1Last`,`Addr1`,`City`,`St`,`Zip`,`CkAllowMail`,`Phone1`,`Email1`,`CkAllowEmail1RemindShop`,`CkAllowEmail1News`,`CkAllowEmail2RemindShop`,`CkAllowEmail2News`,`HowHear`,`DtlHowHear`,`WhenReg`)
SELECT 'admin','$2a$10$JeeTocTA5UtE5.QsnXLxk.zAiJqBniyU4SYgdUQYSyIKkm7pqzPhC','Approv','Avail','Avail','StaffSuper','CENTRAL','Admin','User','Yes Street','Aux','AK','12341',1,'5555559999','admin@example.com',1,1,1,1,'Flyer','admin','2024-02-27 10:20:23'
FROM dual
WHERE NOT EXISTS (SELECT NameLogin FROM `Memb` WHERE NameLogin = 'admin');
flush privileges;
