-- MySQL dump 10.13  Distrib 8.0.27, for macos11 (arm64)
--
-- Host: ls-3d2dd580941a2d40bcbf9ba010ad5cbc890c28ea.ch86wg2ikltj.us-east-1.rds.amazonaws.com    Database: dbifcom
-- ------------------------------------------------------
-- Server version	8.0.40

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `Cart`
--

DROP TABLE IF EXISTS `Cart`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Cart` (
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
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Cart`
--

LOCK TABLES `Cart` WRITE;
/*!40000 ALTER TABLE `Cart` DISABLE KEYS */;
INSERT INTO `Cart` VALUES (2,17,1,'CENTRAL','Pick'),(13,28,1,'CENTRAL','Undeliv'),(18,34,1,'CENTRAL','Pend'),(19,34,5941,'FRAN','Pend'),(20,34,5942,'FRAN','Pend');
/*!40000 ALTER TABLE `Cart` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `CartOnsite`
--

DROP TABLE IF EXISTS `CartOnsite`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CartOnsite` (
  `IDCartOnsite` int NOT NULL AUTO_INCREMENT,
  `IDCyc` int NOT NULL,
  `IDMembShop` int DEFAULT NULL,
  `IDMembStaffCreate` int NOT NULL,
  `WhenCreate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `CdCartType` enum('Wholesale','Retail') NOT NULL DEFAULT 'Retail',
  PRIMARY KEY (`IDCartOnsite`),
  KEY `kCartOnsite-IDMembShop` (`IDMembShop`),
  KEY `kCartOnsite-IDMembStaffCreate` (`IDMembStaffCreate`),
  KEY `kCartOnsite-IDCyc` (`IDCyc`),
  CONSTRAINT `kCartOnsite-IDCyc` FOREIGN KEY (`IDCyc`) REFERENCES `Cyc` (`IDCyc`),
  CONSTRAINT `kCartOnsite-IDMembShop` FOREIGN KEY (`IDMembShop`) REFERENCES `Memb` (`IDMemb`),
  CONSTRAINT `kCartOnsite-IDMembStaffCreate` FOREIGN KEY (`IDMembStaffCreate`) REFERENCES `Memb` (`IDMemb`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `CartOnsite`
--

LOCK TABLES `CartOnsite` WRITE;
/*!40000 ALTER TABLE `CartOnsite` DISABLE KEYS */;
INSERT INTO `CartOnsite` VALUES (1,29,NULL,1,'2025-03-04 18:02:14','Retail');
/*!40000 ALTER TABLE `CartOnsite` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `CartOnsitePend`
--

DROP TABLE IF EXISTS `CartOnsitePend`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CartOnsitePend` (
  `IDSess` varchar(128) NOT NULL,
  `IDMembStaffCreate` int NOT NULL,
  `IDMembShop` int DEFAULT NULL,
  `CkEBTNonMemb` tinyint NOT NULL DEFAULT '0',
  `CdCartType` enum('Wholesale','Retail') NOT NULL DEFAULT 'Retail',
  PRIMARY KEY (`IDSess`) USING BTREE,
  KEY `kCartOnsitePend-IDMembStaffCreate` (`IDMembStaffCreate`),
  KEY `kCartOnsitePend-IDMembShop` (`IDMembShop`),
  CONSTRAINT `kCartOnsitePend-IDMembShop` FOREIGN KEY (`IDMembShop`) REFERENCES `Memb` (`IDMemb`),
  CONSTRAINT `kCartOnsitePend-IDMembStaffCreate` FOREIGN KEY (`IDMembStaffCreate`) REFERENCES `Memb` (`IDMemb`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `CartOnsitePend`
--

LOCK TABLES `CartOnsitePend` WRITE;
/*!40000 ALTER TABLE `CartOnsitePend` DISABLE KEYS */;
INSERT INTO `CartOnsitePend` VALUES ('dmqhTXzFL2CuEZ1DUl4MJpxhQ8Ao8_C1',1,NULL,0,'Wholesale'),('F1_H9yiVnTHYhzCQKuhsWLDY0JHXbr4w',1,5943,0,'Wholesale');
/*!40000 ALTER TABLE `CartOnsitePend` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Cat`
--

DROP TABLE IF EXISTS `Cat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Cat` (
  `IDCat` int NOT NULL AUTO_INCREMENT,
  `NameCat` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`IDCat`) USING BTREE,
  UNIQUE KEY `NameCat-Uniq` (`NameCat`) USING BTREE,
  FULLTEXT KEY `NameCat` (`NameCat`)
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Cat`
--

LOCK TABLES `Cat` WRITE;
/*!40000 ALTER TABLE `Cat` DISABLE KEYS */;
INSERT INTO `Cat` VALUES (6,'Baked Goods'),(9,'Beverages'),(25,'Charity'),(40,'Classes'),(5,'Condiments/Sauces/Spices'),(4,'Dairy & Eggs'),(12,'Farming Products'),(13,'Fruits'),(38,'Gift Baskets/Boxes (food)'),(15,'Gift Baskets/Boxes (non-food)'),(3,'Grains/Flours/Cereal + Pasta'),(14,'Health & Beauty'),(19,'Herbs'),(11,'Honey & Syrups'),(23,'Household Supplies'),(31,'IFC Items'),(35,'Jams & Jellies'),(36,'Livestock Feed'),(42,'Meats (beef)'),(2,'Meats (other)'),(21,'Mixes'),(8,'Non-Food Items'),(7,'Nuts'),(24,'Pet Supplies'),(10,'Poultry'),(30,'Prepared Foods (non-refrigerated)'),(27,'Prepared Foods (refrigerated/frozen)'),(43,'Proteins (other)'),(46,'seeds and nuts'),(32,'Services'),(20,'Snacks'),(51,'test delete'),(37,'Transplants'),(1,'Vegetables');
/*!40000 ALTER TABLE `Cat` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `CatProducer`
--

DROP TABLE IF EXISTS `CatProducer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CatProducer` (
  `IDProducer` int NOT NULL,
  `IDCat` int NOT NULL,
  PRIMARY KEY (`IDProducer`,`IDCat`) USING BTREE,
  KEY `kCatProducer-IDCat` (`IDCat`) USING BTREE,
  CONSTRAINT `kCatProducer-IDCat` FOREIGN KEY (`IDCat`) REFERENCES `Cat` (`IDCat`),
  CONSTRAINT `kCatProducer-IDProducer` FOREIGN KEY (`IDProducer`) REFERENCES `Producer` (`IDProducer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `CatProducer`
--

LOCK TABLES `CatProducer` WRITE;
/*!40000 ALTER TABLE `CatProducer` DISABLE KEYS */;
INSERT INTO `CatProducer` VALUES (1203,1),(1210,1),(1203,2),(1203,4),(1210,4),(1209,6),(1210,7),(1207,27);
/*!40000 ALTER TABLE `CatProducer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `CoopParams`
--

DROP TABLE IF EXISTS `CoopParams`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `CoopParams` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `CoopName` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CoopNameShort` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CoopNameBusiness` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Phone` varchar(13) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `HelpEmail` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `InfoEmail` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `AddressLine1` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `AddressLine2` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `HomeWebsite` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `PickupWebsite` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CalendarWebsite` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `TermsOfServiceWebsite` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `FacebookUrl` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `InstagramUrl` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `SenderEmail` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `SenderEmailDisplayName` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ProductStandardsWebsite` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `MembershipNotificationEmail` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `GeneralManager` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `GeneralManagerTitle` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `PaypalEmail` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `ProducerStandardsWebsite` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `MeetOurProducersUrl` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `TextLogoPath` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `HeaderLogoPath` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `HeroLogoPath` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `FooterLogoPath` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `CoopParams`
--

LOCK TABLES `CoopParams` WRITE;
/*!40000 ALTER TABLE `CoopParams` DISABLE KEYS */;
INSERT INTO `CoopParams` VALUES (1,'Cultivate: Local Food Connections','CLFC','Cultivate: Local Food Connections','515-000-0000','lisa@cultivatefoodconnections.org','lisa@cultivatefoodconnections.org','000 Test St.','Des Moines, IA xxxxx','https://cultivate.mucika.io/','https://iowafood.coop/locationshours/?doing_wp_cron=1726078522.2655639648437500000000','https://iowafood.coop/ifc-shopping-calendar/','https://iowafood.coop/join','https://www.facebook.com/CULTIVATELocalFoodConnections','https://www.instagram.com/cultivatefoodconnections/','lisa@cultivatefoodconnections.org','Cultivate: Local Food Connections','https://cultivatefoodconnections.org/production-types','lisa@cultivatefoodconnections.org','Lisa Bean','General Manager','lisa@cultivatefoodconnections.org','https://cultivatefoodconnections.org/production-types','https://shop.iowafood.coop/producers','S4RELXU8985C.png','UU3H63N1KB5P.png','28NLY3S9Z6TH.png','VTR5HQS1HQ0H.png');
/*!40000 ALTER TABLE `CoopParams` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Cyc`
--

DROP TABLE IF EXISTS `Cyc`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Cyc` (
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
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Cyc`
--

LOCK TABLES `Cyc` WRITE;
/*!40000 ALTER TABLE `Cyc` DISABLE KEYS */;
INSERT INTO `Cyc` VALUES (1,'2024-02-21 00:00:00','2024-02-22 00:00:00','2024-02-24 00:00:00','2024-02-25 00:00:00','2024-02-27 00:00:00','2024-02-28 00:00:00','2024-03-01 00:00:00','2024-03-04 00:00:00'),(2,'2024-03-04 00:00:00','2024-03-05 00:00:00','2024-03-07 00:00:00','2024-03-08 00:00:00','2024-03-10 00:00:00','2024-03-11 00:00:00','2024-03-15 00:00:00','2024-03-17 00:00:00'),(3,'2024-03-18 17:00:00','2024-03-18 17:00:00','2024-03-26 04:59:00','2024-03-26 05:59:00','2024-03-29 15:45:00','2024-03-29 15:45:00','2024-03-31 21:00:00','2024-04-01 05:00:00'),(4,'2024-04-01 17:00:00','2024-04-01 17:00:00','2024-04-09 04:59:00','2024-04-09 05:59:00','2024-04-12 15:45:00','2024-04-12 15:45:00','2024-04-14 21:00:00','2024-04-15 05:00:00'),(5,'2024-04-15 17:00:00','2024-04-15 17:00:00','2024-04-23 04:59:00','2024-04-23 05:59:00','2024-04-26 15:45:00','2024-04-26 15:45:00','2024-04-28 21:00:00','2024-04-29 05:00:00'),(6,'2024-04-29 17:00:00','2024-04-29 17:00:00','2024-05-07 04:59:00','2024-05-07 05:59:00','2024-05-10 15:45:00','2024-05-10 15:45:00','2024-05-12 21:00:00','2024-05-13 05:00:00'),(7,'2024-05-13 17:00:00','2024-05-13 17:00:00','2024-05-21 04:59:00','2024-05-21 05:59:00','2024-05-24 15:45:00','2024-05-24 15:45:00','2024-05-26 21:00:00','2024-05-27 05:00:00'),(8,'2024-05-27 17:00:00','2024-05-27 17:00:00','2024-06-04 04:59:00','2024-06-04 05:59:00','2024-06-07 15:45:00','2024-06-07 15:45:00','2024-06-09 21:00:00','2024-06-10 05:00:00'),(9,'2024-06-10 17:00:00','2024-06-10 17:00:00','2024-06-18 04:59:00','2024-06-18 05:59:00','2024-06-21 15:45:00','2024-06-21 15:45:00','2024-06-23 21:00:00','2024-06-24 05:00:00'),(10,'2024-06-24 17:00:00','2024-06-24 17:00:00','2024-07-02 04:59:00','2024-07-02 05:59:00','2024-07-05 15:45:00','2024-07-05 15:45:00','2024-07-07 21:00:00','2024-07-08 05:00:00'),(11,'2024-07-08 17:00:00','2024-07-08 17:00:00','2024-07-16 04:59:00','2024-07-16 05:59:00','2024-07-19 15:45:00','2024-07-19 15:45:00','2024-07-21 21:00:00','2024-07-22 05:00:00'),(12,'2024-07-22 17:00:00','2024-07-22 17:00:00','2024-07-30 04:59:00','2024-07-30 05:59:00','2024-08-02 15:45:00','2024-08-02 15:45:00','2024-08-04 21:00:00','2024-08-05 05:00:00'),(13,'2024-08-05 17:00:00','2024-08-05 17:00:00','2024-08-13 04:59:00','2024-08-13 05:59:00','2024-08-16 15:45:00','2024-08-16 15:45:00','2024-08-18 21:00:00','2024-08-19 05:00:00'),(14,'2024-08-19 17:00:00','2024-08-19 17:00:00','2024-08-27 04:59:00','2024-08-27 05:59:00','2024-08-30 15:45:00','2024-08-30 15:45:00','2024-09-01 21:00:00','2024-09-02 05:00:00'),(15,'2024-09-02 17:00:00','2024-09-02 17:00:00','2024-09-10 04:59:00','2024-09-10 05:59:00','2024-09-13 15:45:00','2024-09-13 15:45:00','2024-09-15 21:00:00','2024-09-16 05:00:00'),(16,'2024-09-16 17:00:00','2024-09-16 17:00:00','2024-09-24 04:59:00','2024-09-24 05:59:00','2024-09-24 06:00:00','2024-09-24 06:00:00','2024-09-24 06:01:00','2024-09-24 06:01:00'),(17,'2024-09-24 06:01:00','2024-09-24 06:01:00','2024-09-24 06:02:00','2024-09-24 06:02:00','2024-09-24 06:03:00','2024-09-24 06:03:00','2024-09-24 06:04:00','2024-09-24 06:04:00'),(18,'2024-09-24 06:04:00','2024-09-24 06:04:00','2024-10-16 04:59:00','2024-10-16 05:59:00','2024-10-19 15:45:00','2024-10-19 15:45:00','2024-10-21 21:00:00','2024-10-22 05:00:00'),(19,'2024-10-08 17:00:00','2024-10-08 17:00:00','2024-10-16 04:59:00','2024-10-16 05:59:00','2024-10-19 15:45:00','2024-10-19 15:45:00','2024-10-21 21:00:00','2024-10-22 05:00:00'),(20,'2024-10-22 17:00:00','2024-10-22 17:00:00','2024-10-30 04:59:00','2024-10-30 05:59:00','2024-11-02 15:45:00','2024-11-02 15:45:00','2024-11-04 22:00:00','2024-11-05 06:00:00'),(21,'2024-11-05 18:00:00','2024-11-05 18:00:00','2024-11-13 05:59:00','2024-11-13 06:59:00','2024-11-16 16:45:00','2024-11-16 16:45:00','2024-11-18 22:00:00','2024-11-19 06:00:00'),(22,'2024-11-19 18:00:00','2024-11-19 18:00:00','2024-11-27 05:59:00','2024-11-27 06:59:00','2024-11-30 16:45:00','2024-11-30 16:45:00','2024-12-02 22:00:00','2024-12-03 06:00:00'),(23,'2024-12-03 18:00:00','2024-12-03 18:00:00','2024-12-11 05:59:00','2024-12-11 06:59:00','2024-12-14 16:45:00','2024-12-14 16:45:00','2024-12-16 22:00:00','2024-12-17 06:00:00'),(24,'2024-12-17 18:00:00','2024-12-17 18:00:00','2024-12-25 05:59:00','2024-12-25 06:59:00','2024-12-28 16:45:00','2024-12-28 16:45:00','2024-12-30 22:00:00','2024-12-31 06:00:00'),(25,'2024-12-31 18:00:00','2024-12-31 18:00:00','2025-01-08 05:59:00','2025-01-08 06:59:00','2025-01-11 16:45:00','2025-01-11 16:45:00','2025-01-13 22:00:00','2025-01-14 06:00:00'),(26,'2025-01-14 18:00:00','2025-01-14 18:00:00','2025-01-22 05:59:00','2025-01-22 06:59:00','2025-01-25 16:45:00','2025-01-25 16:45:00','2025-01-27 22:00:00','2025-01-28 06:00:00'),(27,'2025-01-28 18:00:00','2025-01-28 18:00:00','2025-02-05 05:59:00','2025-02-05 06:59:00','2025-02-08 16:45:00','2025-02-08 16:45:00','2025-02-08 16:46:00','2025-02-08 16:46:00'),(28,'2025-02-08 16:46:00','2025-02-08 16:46:00','2025-02-19 05:59:00','2025-02-19 06:59:00','2025-02-22 16:45:00','2025-02-22 16:45:00','2025-02-24 22:00:00','2025-02-25 06:00:00'),(29,'2025-02-22 18:00:00','2025-02-22 18:00:00','2025-03-02 05:59:00','2025-03-02 06:59:00','2025-03-05 16:45:00','2025-03-05 16:45:00','2025-03-07 22:00:00','2025-03-08 06:00:00'),(30,'2025-03-08 18:00:00','2025-03-08 18:00:00','2025-03-16 04:59:00','2025-03-16 05:59:00','2025-03-19 15:45:00','2025-03-19 15:45:00','2025-03-21 21:00:00','2025-03-22 05:00:00'),(31,'2025-03-22 17:00:00','2025-03-22 17:00:00','2025-03-30 04:59:00','2025-03-30 05:59:00','2025-04-02 15:45:00','2025-04-02 15:45:00','2025-04-04 21:00:00','2025-04-05 05:00:00'),(32,'2025-04-05 17:00:00','2025-04-05 17:00:00','2025-04-13 04:59:00','2025-04-13 05:59:00','2025-04-16 15:45:00','2025-04-16 15:45:00','2025-04-18 21:00:00','2025-04-19 05:00:00'),(33,'2025-04-19 17:00:00','2025-04-19 17:00:00','2025-04-27 04:59:00','2025-04-27 05:59:00','2025-04-30 15:45:00','2025-04-30 15:45:00','2025-04-30 15:46:00','2025-04-30 15:46:00'),(34,'2025-04-30 15:46:00','2025-04-30 15:46:00','2025-05-11 04:59:00','2025-05-11 05:59:00','2025-05-14 15:45:00','2025-05-14 15:45:00','2025-05-16 21:00:00','2025-05-17 05:00:00'),(35,'2025-05-14 17:00:00','2025-05-14 17:00:00','2025-05-22 04:59:00','2025-05-22 05:59:00','2025-05-25 15:45:00','2025-05-25 15:45:00','2025-05-27 21:00:00','2025-05-28 05:00:00');
/*!40000 ALTER TABLE `Cyc` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `EvtApp`
--

DROP TABLE IF EXISTS `EvtApp`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `EvtApp` (
  `IDEvtApp` int NOT NULL AUTO_INCREMENT,
  `CdEvtApp` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `IDMemb` int DEFAULT NULL,
  `IDProducer` int DEFAULT NULL,
  `IDMembStaffCreate` int DEFAULT NULL,
  `zWhen` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`IDEvtApp`)
) ENGINE=InnoDB AUTO_INCREMENT=321 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `EvtApp`
--

LOCK TABLES `EvtApp` WRITE;
/*!40000 ALTER TABLE `EvtApp` DISABLE KEYS */;
INSERT INTO `EvtApp` VALUES (1,'StartApp',NULL,NULL,NULL,'2024-09-11 14:59:05'),(2,'StartApp',NULL,NULL,NULL,'2024-09-11 15:10:05'),(3,'StartApp',NULL,NULL,NULL,'2024-09-11 15:13:10'),(4,'StartCyc',NULL,NULL,NULL,'2024-09-11 15:13:13'),(5,'StartShop',NULL,NULL,NULL,'2024-09-11 15:13:13'),(6,'EndShop',NULL,NULL,NULL,'2024-09-11 15:13:13'),(7,'StartDeliv',NULL,NULL,NULL,'2024-09-11 15:13:13'),(8,'EndDeliv',NULL,NULL,NULL,'2024-09-11 15:13:13'),(9,'StartPickup',NULL,NULL,NULL,'2024-09-11 15:13:13'),(10,'EndPickup',NULL,NULL,NULL,'2024-09-11 15:13:13'),(11,'PendCyc',NULL,NULL,NULL,'2024-09-11 15:13:13'),(12,'StartCyc',NULL,NULL,NULL,'2024-09-11 15:13:13'),(13,'StartShop',NULL,NULL,NULL,'2024-09-11 15:13:13'),(14,'EndShop',NULL,NULL,NULL,'2024-09-11 15:13:13'),(15,'StartDeliv',NULL,NULL,NULL,'2024-09-11 15:13:13'),(16,'EndDeliv',NULL,NULL,NULL,'2024-09-11 15:13:13'),(17,'StartPickup',NULL,NULL,NULL,'2024-09-11 15:13:13'),(18,'EndPickup',NULL,NULL,NULL,'2024-09-11 15:13:13'),(19,'PendCyc',NULL,NULL,NULL,'2024-09-11 15:13:13'),(20,'StartCyc',NULL,NULL,NULL,'2024-09-11 15:13:13'),(21,'StartShop',NULL,NULL,NULL,'2024-09-11 15:13:13'),(22,'EndShop',NULL,NULL,NULL,'2024-09-11 15:13:13'),(23,'StartDeliv',NULL,NULL,NULL,'2024-09-11 15:13:13'),(24,'EndDeliv',NULL,NULL,NULL,'2024-09-11 15:13:13'),(25,'StartPickup',NULL,NULL,NULL,'2024-09-11 15:13:13'),(26,'EndPickup',NULL,NULL,NULL,'2024-09-11 15:13:13'),(27,'PendCyc',NULL,NULL,NULL,'2024-09-11 15:13:13'),(28,'StartCyc',NULL,NULL,NULL,'2024-09-11 15:13:13'),(29,'StartShop',NULL,NULL,NULL,'2024-09-11 15:13:13'),(30,'EndShop',NULL,NULL,NULL,'2024-09-11 15:13:13'),(31,'StartDeliv',NULL,NULL,NULL,'2024-09-11 15:13:13'),(32,'EndDeliv',NULL,NULL,NULL,'2024-09-11 15:13:13'),(33,'StartPickup',NULL,NULL,NULL,'2024-09-11 15:13:13'),(34,'EndPickup',NULL,NULL,NULL,'2024-09-11 15:13:13'),(35,'PendCyc',NULL,NULL,NULL,'2024-09-11 15:13:13'),(36,'StartCyc',NULL,NULL,NULL,'2024-09-11 15:13:13'),(37,'StartShop',NULL,NULL,NULL,'2024-09-11 15:13:14'),(38,'EndShop',NULL,NULL,NULL,'2024-09-11 15:13:14'),(39,'StartDeliv',NULL,NULL,NULL,'2024-09-11 15:13:14'),(40,'EndDeliv',NULL,NULL,NULL,'2024-09-11 15:13:14'),(41,'StartPickup',NULL,NULL,NULL,'2024-09-11 15:13:14'),(42,'EndPickup',NULL,NULL,NULL,'2024-09-11 15:13:14'),(43,'PendCyc',NULL,NULL,NULL,'2024-09-11 15:13:14'),(44,'StartCyc',NULL,NULL,NULL,'2024-09-11 15:13:14'),(45,'StartShop',NULL,NULL,NULL,'2024-09-11 15:13:14'),(46,'EndShop',NULL,NULL,NULL,'2024-09-11 15:13:14'),(47,'StartDeliv',NULL,NULL,NULL,'2024-09-11 15:13:14'),(48,'EndDeliv',NULL,NULL,NULL,'2024-09-11 15:13:14'),(49,'StartPickup',NULL,NULL,NULL,'2024-09-11 15:13:14'),(50,'EndPickup',NULL,NULL,NULL,'2024-09-11 15:13:14'),(51,'PendCyc',NULL,NULL,NULL,'2024-09-11 15:13:14'),(52,'StartCyc',NULL,NULL,NULL,'2024-09-11 15:13:14'),(53,'StartShop',NULL,NULL,NULL,'2024-09-11 15:13:14'),(54,'EndShop',NULL,NULL,NULL,'2024-09-11 15:13:14'),(55,'StartDeliv',NULL,NULL,NULL,'2024-09-11 15:13:14'),(56,'EndDeliv',NULL,NULL,NULL,'2024-09-11 15:13:14'),(57,'StartPickup',NULL,NULL,NULL,'2024-09-11 15:13:14'),(58,'EndPickup',NULL,NULL,NULL,'2024-09-11 15:13:14'),(59,'PendCyc',NULL,NULL,NULL,'2024-09-11 15:13:14'),(60,'StartCyc',NULL,NULL,NULL,'2024-09-11 15:13:14'),(61,'StartShop',NULL,NULL,NULL,'2024-09-11 15:13:14'),(62,'EndShop',NULL,NULL,NULL,'2024-09-11 15:13:14'),(63,'StartDeliv',NULL,NULL,NULL,'2024-09-11 15:13:14'),(64,'EndDeliv',NULL,NULL,NULL,'2024-09-11 15:13:14'),(65,'StartPickup',NULL,NULL,NULL,'2024-09-11 15:13:14'),(66,'EndPickup',NULL,NULL,NULL,'2024-09-11 15:13:14'),(67,'PendCyc',NULL,NULL,NULL,'2024-09-11 15:13:14'),(68,'StartCyc',NULL,NULL,NULL,'2024-09-11 15:13:14'),(69,'StartShop',NULL,NULL,NULL,'2024-09-11 15:13:14'),(70,'EndShop',NULL,NULL,NULL,'2024-09-11 15:13:14'),(71,'StartDeliv',NULL,NULL,NULL,'2024-09-11 15:13:14'),(72,'EndDeliv',NULL,NULL,NULL,'2024-09-11 15:13:14'),(73,'StartPickup',NULL,NULL,NULL,'2024-09-11 15:13:14'),(74,'EndPickup',NULL,NULL,NULL,'2024-09-11 15:13:14'),(75,'PendCyc',NULL,NULL,NULL,'2024-09-11 15:13:14'),(76,'StartCyc',NULL,NULL,NULL,'2024-09-11 15:13:14'),(77,'StartShop',NULL,NULL,NULL,'2024-09-11 15:13:14'),(78,'EndShop',NULL,NULL,NULL,'2024-09-11 15:13:14'),(79,'StartDeliv',NULL,NULL,NULL,'2024-09-11 15:13:14'),(80,'EndDeliv',NULL,NULL,NULL,'2024-09-11 15:13:14'),(81,'StartPickup',NULL,NULL,NULL,'2024-09-11 15:13:14'),(82,'EndPickup',NULL,NULL,NULL,'2024-09-11 15:13:14'),(83,'PendCyc',NULL,NULL,NULL,'2024-09-11 15:13:14'),(84,'StartCyc',NULL,NULL,NULL,'2024-09-11 15:13:14'),(85,'StartShop',NULL,NULL,NULL,'2024-09-11 15:13:14'),(86,'EndShop',NULL,NULL,NULL,'2024-09-11 15:13:14'),(87,'StartDeliv',NULL,NULL,NULL,'2024-09-11 15:13:14'),(88,'EndDeliv',NULL,NULL,NULL,'2024-09-11 15:13:14'),(89,'StartPickup',NULL,NULL,NULL,'2024-09-11 15:13:14'),(90,'EndPickup',NULL,NULL,NULL,'2024-09-11 15:13:14'),(91,'PendCyc',NULL,NULL,NULL,'2024-09-11 15:13:14'),(92,'StartCyc',NULL,NULL,NULL,'2024-09-11 15:13:14'),(93,'StartShop',NULL,NULL,NULL,'2024-09-11 15:13:14'),(94,'EndShop',NULL,NULL,NULL,'2024-09-11 15:13:14'),(95,'StartDeliv',NULL,NULL,NULL,'2024-09-11 15:13:14'),(96,'EndDeliv',NULL,NULL,NULL,'2024-09-11 15:13:14'),(97,'StartPickup',NULL,NULL,NULL,'2024-09-11 15:13:14'),(98,'EndPickup',NULL,NULL,NULL,'2024-09-11 15:13:14'),(99,'PendCyc',NULL,NULL,NULL,'2024-09-11 15:13:14'),(100,'StartCyc',NULL,NULL,NULL,'2024-09-11 15:13:14'),(101,'StartShop',NULL,NULL,NULL,'2024-09-11 15:13:14'),(102,'EndShop',NULL,NULL,NULL,'2024-09-11 15:13:14'),(103,'StartDeliv',NULL,NULL,NULL,'2024-09-11 15:13:14'),(104,'EndDeliv',NULL,NULL,NULL,'2024-09-11 15:13:14'),(105,'StartPickup',NULL,NULL,NULL,'2024-09-11 15:13:14'),(106,'EndPickup',NULL,NULL,NULL,'2024-09-11 15:13:14'),(107,'PendCyc',NULL,NULL,NULL,'2024-09-11 15:13:14'),(108,'StartCyc',NULL,NULL,NULL,'2024-09-11 15:13:14'),(109,'StartShop',NULL,NULL,NULL,'2024-09-11 15:13:14'),(110,'EndShop',NULL,NULL,NULL,'2024-09-11 15:13:14'),(111,'StartDeliv',NULL,NULL,NULL,'2024-09-11 15:13:14'),(112,'EndDeliv',NULL,NULL,NULL,'2024-09-11 15:13:14'),(113,'StartPickup',NULL,NULL,NULL,'2024-09-11 15:13:14'),(114,'EndPickup',NULL,NULL,NULL,'2024-09-11 15:13:14'),(115,'PendCyc',NULL,NULL,NULL,'2024-09-11 15:13:15'),(116,'StartCyc',NULL,NULL,NULL,'2024-09-11 15:13:15'),(117,'StartShop',NULL,NULL,NULL,'2024-09-11 15:13:15'),(118,'EndShop',NULL,NULL,NULL,'2024-09-11 15:13:15'),(119,'StartDeliv',NULL,NULL,NULL,'2024-09-11 15:13:15'),(120,'StartApp',NULL,NULL,NULL,'2024-09-11 15:19:46'),(121,'StartApp',NULL,NULL,NULL,'2024-09-11 15:52:36'),(122,'EndDeliv',NULL,NULL,NULL,'2024-09-13 15:53:11'),(123,'StartPickup',NULL,NULL,NULL,'2024-09-13 15:53:11'),(124,'EndPickup',NULL,NULL,NULL,'2024-09-15 21:19:20'),(125,'PendCyc',NULL,NULL,NULL,'2024-09-16 05:10:43'),(126,'StartCyc',NULL,NULL,NULL,'2024-09-16 17:41:53'),(127,'StartShop',NULL,NULL,NULL,'2024-09-16 17:41:53'),(128,'EndShop',NULL,NULL,NULL,'2024-09-24 05:04:38'),(129,'StartDeliv',NULL,NULL,NULL,'2024-09-24 06:47:20'),(130,'StartApp',NULL,NULL,NULL,'2024-09-24 11:50:27'),(131,'Imper',5938,NULL,1,'2024-09-24 13:15:56'),(132,'EditCycTime',NULL,NULL,1,'2024-09-24 14:39:42'),(133,'EndDeliv',NULL,NULL,NULL,'2024-09-24 14:39:42'),(134,'StartPickup',NULL,NULL,NULL,'2024-09-24 14:39:42'),(135,'EditCycTime',NULL,NULL,1,'2024-09-24 14:39:51'),(136,'EndPickup',NULL,NULL,NULL,'2024-09-24 14:39:51'),(137,'PendCyc',NULL,NULL,NULL,'2024-09-24 14:39:51'),(138,'StartCyc',NULL,NULL,NULL,'2024-09-24 14:39:51'),(139,'StartShop',NULL,NULL,NULL,'2024-09-24 14:39:51'),(140,'EditCycTime',NULL,NULL,1,'2024-09-24 14:41:13'),(141,'EndShop',NULL,NULL,NULL,'2024-09-24 14:41:13'),(142,'StartDeliv',NULL,NULL,NULL,'2024-09-24 14:41:13'),(143,'EditCycTime',NULL,NULL,1,'2024-09-24 14:42:15'),(144,'EndDeliv',NULL,NULL,NULL,'2024-09-24 14:42:15'),(145,'StartPickup',NULL,NULL,NULL,'2024-09-24 14:42:15'),(146,'EditCycTime',NULL,NULL,1,'2024-09-24 14:45:49'),(147,'EndPickup',NULL,NULL,NULL,'2024-09-24 14:45:49'),(148,'PendCyc',NULL,NULL,NULL,'2024-09-24 14:45:49'),(149,'StartCyc',NULL,NULL,NULL,'2024-09-24 14:45:49'),(150,'StartShop',NULL,NULL,NULL,'2024-09-24 14:45:49'),(151,'Imper',5930,NULL,1,'2024-09-24 14:54:47'),(152,'Imper',5930,NULL,1,'2024-09-24 21:19:27'),(153,'Imper',5930,NULL,1,'2024-09-26 00:50:57'),(154,'Imper',5941,NULL,1,'2024-09-26 02:21:44'),(155,'StartApp',NULL,NULL,NULL,'2024-09-26 13:07:48'),(156,'Imper',5941,NULL,1,'2024-09-26 16:27:21'),(157,'Imper',5938,NULL,1,'2024-09-26 16:30:53'),(158,'Imper',5941,NULL,1,'2024-10-08 21:06:42'),(159,'Imper',5930,NULL,1,'2024-10-08 21:07:12'),(160,'EndShop',NULL,NULL,NULL,'2024-10-16 05:06:44'),(161,'StartDeliv',NULL,NULL,NULL,'2024-10-16 05:59:00'),(162,'EndDeliv',NULL,NULL,NULL,'2024-10-19 16:01:12'),(163,'StartPickup',NULL,NULL,NULL,'2024-10-19 16:01:12'),(164,'EndPickup',NULL,NULL,NULL,'2024-10-21 21:30:14'),(165,'PendCyc',NULL,NULL,NULL,'2024-10-22 05:01:11'),(166,'StartCyc',NULL,NULL,NULL,'2024-10-22 05:01:11'),(167,'StartShop',NULL,NULL,NULL,'2024-10-22 05:01:11'),(168,'EndShop',NULL,NULL,NULL,'2024-10-22 05:01:12'),(169,'StartDeliv',NULL,NULL,NULL,'2024-10-22 05:01:12'),(170,'EndDeliv',NULL,NULL,NULL,'2024-10-22 05:01:12'),(171,'StartPickup',NULL,NULL,NULL,'2024-10-22 05:01:12'),(172,'EndPickup',NULL,NULL,NULL,'2024-10-22 05:01:12'),(173,'PendCyc',NULL,NULL,NULL,'2024-10-22 05:01:12'),(174,'StartApp',NULL,NULL,NULL,'2024-10-22 09:02:23'),(175,'StartApp',NULL,NULL,NULL,'2024-10-22 09:03:51'),(176,'StartApp',NULL,NULL,NULL,'2024-10-22 09:27:29'),(177,'StartApp',NULL,NULL,NULL,'2024-10-22 11:02:08'),(178,'Imper',5941,NULL,1,'2024-10-22 11:18:05'),(179,'Imper',5938,NULL,1,'2024-10-22 11:18:27'),(180,'StartCyc',NULL,NULL,NULL,'2024-10-22 17:08:55'),(181,'StartShop',NULL,NULL,NULL,'2024-10-22 17:08:55'),(182,'Imper',5930,NULL,1,'2024-10-29 19:47:34'),(183,'EndShop',NULL,NULL,NULL,'2024-10-30 05:05:32'),(184,'StartDeliv',NULL,NULL,NULL,'2024-10-30 06:01:23'),(185,'EndDeliv',NULL,NULL,NULL,'2024-11-02 15:45:49'),(186,'StartPickup',NULL,NULL,NULL,'2024-11-02 15:45:49'),(187,'EndPickup',NULL,NULL,NULL,'2024-11-04 22:11:18'),(188,'PendCyc',NULL,NULL,NULL,'2024-11-05 06:07:36'),(189,'StartCyc',NULL,NULL,NULL,'2024-11-05 18:02:08'),(190,'StartShop',NULL,NULL,NULL,'2024-11-05 18:02:08'),(191,'EndShop',NULL,NULL,NULL,'2024-11-13 06:05:37'),(192,'StartDeliv',NULL,NULL,NULL,'2024-11-13 06:59:22'),(193,'EndDeliv',NULL,NULL,NULL,'2024-11-16 16:46:04'),(194,'StartPickup',NULL,NULL,NULL,'2024-11-16 16:46:04'),(195,'EndPickup',NULL,NULL,NULL,'2024-11-18 22:13:35'),(196,'PendCyc',NULL,NULL,NULL,'2024-11-19 06:02:31'),(197,'StartCyc',NULL,NULL,NULL,'2024-11-19 18:07:34'),(198,'StartShop',NULL,NULL,NULL,'2024-11-19 18:07:34'),(199,'EndShop',NULL,NULL,NULL,'2024-11-27 06:01:59'),(200,'StartDeliv',NULL,NULL,NULL,'2024-11-27 07:01:17'),(201,'StartApp',NULL,NULL,NULL,'2024-11-29 13:56:42'),(202,'StartApp',NULL,NULL,NULL,'2024-11-29 16:19:32'),(203,'StartApp',NULL,NULL,NULL,'2024-11-29 16:24:31'),(204,'StartApp',NULL,NULL,NULL,'2024-11-29 20:45:56'),(205,'EndDeliv',NULL,NULL,NULL,'2024-11-30 16:46:12'),(206,'StartPickup',NULL,NULL,NULL,'2024-11-30 16:46:12'),(207,'EndPickup',NULL,NULL,NULL,'2024-12-02 22:27:58'),(208,'PendCyc',NULL,NULL,NULL,'2024-12-03 06:00:14'),(209,'StartCyc',NULL,NULL,NULL,'2024-12-03 18:22:33'),(210,'StartShop',NULL,NULL,NULL,'2024-12-03 18:22:33'),(211,'EndShop',NULL,NULL,NULL,'2024-12-11 06:00:57'),(212,'StartDeliv',NULL,NULL,NULL,'2024-12-11 07:01:51'),(213,'EndDeliv',NULL,NULL,NULL,'2024-12-14 16:46:19'),(214,'StartPickup',NULL,NULL,NULL,'2024-12-14 16:46:19'),(215,'EndPickup',NULL,NULL,NULL,'2024-12-16 22:10:30'),(216,'PendCyc',NULL,NULL,NULL,'2024-12-17 06:15:43'),(217,'StartApp',NULL,NULL,NULL,'2024-12-17 17:36:58'),(218,'StartApp',NULL,NULL,NULL,'2024-12-17 17:37:32'),(219,'StartCyc',NULL,NULL,NULL,'2024-12-17 18:14:45'),(220,'StartShop',NULL,NULL,NULL,'2024-12-17 18:14:45'),(221,'EndShop',NULL,NULL,NULL,'2024-12-25 06:09:53'),(222,'StartDeliv',NULL,NULL,NULL,'2024-12-25 07:10:30'),(223,'EndDeliv',NULL,NULL,NULL,'2024-12-28 16:48:08'),(224,'StartPickup',NULL,NULL,NULL,'2024-12-28 16:48:08'),(225,'EndPickup',NULL,NULL,NULL,'2024-12-30 22:24:12'),(226,'PendCyc',NULL,NULL,NULL,'2024-12-31 06:11:51'),(227,'StartCyc',NULL,NULL,NULL,'2024-12-31 18:10:24'),(228,'StartShop',NULL,NULL,NULL,'2024-12-31 18:10:24'),(229,'EndShop',NULL,NULL,NULL,'2025-01-08 06:05:41'),(230,'StartDeliv',NULL,NULL,NULL,'2025-01-08 07:01:39'),(231,'EndDeliv',NULL,NULL,NULL,'2025-01-11 16:48:37'),(232,'StartPickup',NULL,NULL,NULL,'2025-01-11 16:48:37'),(233,'EndPickup',NULL,NULL,NULL,'2025-01-13 22:17:48'),(234,'PendCyc',NULL,NULL,NULL,'2025-01-14 06:08:26'),(235,'StartCyc',NULL,NULL,NULL,'2025-01-14 18:04:22'),(236,'StartShop',NULL,NULL,NULL,'2025-01-14 18:04:22'),(237,'Imper',5930,NULL,1,'2025-01-21 22:26:08'),(238,'EndShop',NULL,NULL,NULL,'2025-01-22 06:02:40'),(239,'StartDeliv',NULL,NULL,NULL,'2025-01-22 07:20:28'),(240,'EndDeliv',NULL,NULL,NULL,'2025-01-25 17:14:31'),(241,'StartPickup',NULL,NULL,NULL,'2025-01-25 17:14:31'),(242,'EndPickup',NULL,NULL,NULL,'2025-01-27 22:03:52'),(243,'PendCyc',NULL,NULL,NULL,'2025-01-28 06:11:23'),(244,'StartCyc',NULL,NULL,NULL,'2025-01-28 18:01:54'),(245,'StartShop',NULL,NULL,NULL,'2025-01-28 18:01:54'),(246,'EndShop',NULL,NULL,NULL,'2025-02-05 06:20:20'),(247,'StartDeliv',NULL,NULL,NULL,'2025-02-05 07:21:50'),(248,'Imper',5942,NULL,1,'2025-02-06 18:31:33'),(249,'EndDeliv',NULL,NULL,NULL,'2025-02-08 17:10:21'),(250,'StartPickup',NULL,NULL,NULL,'2025-02-08 17:10:21'),(251,'Imper',5942,NULL,1,'2025-02-09 21:14:51'),(252,'EditCycTime',NULL,NULL,1,'2025-02-09 21:25:57'),(253,'EndPickup',NULL,NULL,NULL,'2025-02-09 21:25:57'),(254,'PendCyc',NULL,NULL,NULL,'2025-02-09 21:25:57'),(255,'StartCyc',NULL,NULL,NULL,'2025-02-09 21:25:57'),(256,'StartShop',NULL,NULL,NULL,'2025-02-09 21:25:57'),(257,'Imper',5942,NULL,1,'2025-02-09 21:28:03'),(258,'Imper',5930,NULL,1,'2025-02-11 18:52:15'),(259,'Imper',5942,NULL,1,'2025-02-11 18:53:40'),(260,'Imper',5938,NULL,1,'2025-02-11 19:03:13'),(261,'Imper',5942,NULL,1,'2025-02-14 22:23:28'),(262,'EndShop',NULL,NULL,NULL,'2025-02-19 06:00:52'),(263,'StartDeliv',NULL,NULL,NULL,'2025-02-19 07:01:29'),(264,'EndDeliv',NULL,NULL,NULL,'2025-02-22 16:45:47'),(265,'StartPickup',NULL,NULL,NULL,'2025-02-22 16:45:47'),(266,'Imper',5942,NULL,1,'2025-02-23 16:05:58'),(267,'EndPickup',NULL,NULL,NULL,'2025-02-24 22:02:56'),(268,'PendCyc',NULL,NULL,NULL,'2025-02-25 06:00:07'),(269,'StartCyc',NULL,NULL,NULL,'2025-02-25 06:00:07'),(270,'StartShop',NULL,NULL,NULL,'2025-02-25 06:00:07'),(271,'EndShop',NULL,NULL,NULL,'2025-03-02 06:02:56'),(272,'StartDeliv',NULL,NULL,NULL,'2025-03-02 07:03:05'),(273,'Imper',5942,NULL,1,'2025-03-03 13:03:08'),(274,'Imper',5942,NULL,1,'2025-03-03 18:02:01'),(275,'Imper',5942,NULL,1,'2025-03-04 18:06:03'),(276,'Imper',5942,NULL,1,'2025-03-04 18:08:57'),(277,'EndDeliv',NULL,NULL,NULL,'2025-03-05 17:38:35'),(278,'StartPickup',NULL,NULL,NULL,'2025-03-05 17:38:35'),(279,'EndPickup',NULL,NULL,NULL,'2025-03-07 22:05:21'),(280,'PendCyc',NULL,NULL,NULL,'2025-03-08 06:19:12'),(281,'StartCyc',NULL,NULL,NULL,'2025-03-08 18:00:04'),(282,'StartShop',NULL,NULL,NULL,'2025-03-08 18:00:04'),(283,'EndShop',NULL,NULL,NULL,'2025-03-16 04:59:13'),(284,'StartDeliv',NULL,NULL,NULL,'2025-03-16 06:05:32'),(285,'EndDeliv',NULL,NULL,NULL,'2025-03-19 15:51:41'),(286,'StartPickup',NULL,NULL,NULL,'2025-03-19 15:51:41'),(287,'EndPickup',NULL,NULL,NULL,'2025-03-21 21:05:25'),(288,'PendCyc',NULL,NULL,NULL,'2025-03-22 05:00:03'),(289,'StartCyc',NULL,NULL,NULL,'2025-03-22 17:12:47'),(290,'StartShop',NULL,NULL,NULL,'2025-03-22 17:12:47'),(291,'EndShop',NULL,NULL,NULL,'2025-03-30 05:12:00'),(292,'StartDeliv',NULL,NULL,NULL,'2025-03-30 06:01:01'),(293,'Imper',5942,NULL,1,'2025-03-31 12:48:05'),(294,'EndDeliv',NULL,NULL,NULL,'2025-04-02 16:27:52'),(295,'StartPickup',NULL,NULL,NULL,'2025-04-02 16:27:52'),(296,'EndPickup',NULL,NULL,NULL,'2025-04-04 21:00:02'),(297,'PendCyc',NULL,NULL,NULL,'2025-04-05 05:08:24'),(298,'StartCyc',NULL,NULL,NULL,'2025-04-05 17:01:51'),(299,'StartShop',NULL,NULL,NULL,'2025-04-05 17:01:51'),(300,'EndShop',NULL,NULL,NULL,'2025-04-13 05:00:15'),(301,'StartDeliv',NULL,NULL,NULL,'2025-04-13 06:01:51'),(302,'EndDeliv',NULL,NULL,NULL,'2025-04-16 16:06:49'),(303,'StartPickup',NULL,NULL,NULL,'2025-04-16 16:06:49'),(304,'EndPickup',NULL,NULL,NULL,'2025-04-18 21:00:02'),(305,'PendCyc',NULL,NULL,NULL,'2025-04-19 05:00:06'),(306,'StartCyc',NULL,NULL,NULL,'2025-04-19 17:13:05'),(307,'StartShop',NULL,NULL,NULL,'2025-04-19 17:13:05'),(308,'EndShop',NULL,NULL,NULL,'2025-04-27 05:00:04'),(309,'StartDeliv',NULL,NULL,NULL,'2025-04-27 06:18:47'),(310,'EndDeliv',NULL,NULL,NULL,'2025-04-30 15:45:04'),(311,'StartPickup',NULL,NULL,NULL,'2025-04-30 15:45:04'),(312,'EditCycTime',NULL,NULL,1,'2025-04-30 15:49:09'),(313,'EndPickup',NULL,NULL,NULL,'2025-04-30 15:49:09'),(314,'PendCyc',NULL,NULL,NULL,'2025-04-30 15:49:09'),(315,'StartCyc',NULL,NULL,NULL,'2025-04-30 15:49:09'),(316,'StartShop',NULL,NULL,NULL,'2025-04-30 15:49:09'),(317,'Imper',5941,NULL,1,'2025-04-30 15:56:55'),(318,'Imper',5941,NULL,1,'2025-05-02 02:06:22'),(319,'Imper',5941,NULL,1,'2025-05-02 02:08:20'),(320,'Imper',5942,NULL,1,'2025-05-02 03:39:07');
/*!40000 ALTER TABLE `EvtApp` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `FailLogin`
--

DROP TABLE IF EXISTS `FailLogin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `FailLogin` (
  `IDFailLogin` int NOT NULL AUTO_INCREMENT,
  `zWhen` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `IP` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `NameLogin` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`IDFailLogin`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `FailLogin`
--

LOCK TABLES `FailLogin` WRITE;
/*!40000 ALTER TABLE `FailLogin` DISABLE KEYS */;
INSERT INTO `FailLogin` VALUES (8,'2024-11-20 22:28:43','35.92.139.233','paul.ziemann@orimi.co'),(9,'2024-11-20 22:28:51','35.92.139.233','maxie.white'),(10,'2024-11-20 22:28:59','35.92.139.233','maxie.white'),(11,'2024-11-20 22:29:10','35.92.139.233','paul.ziemann@orimi.co'),(12,'2024-11-20 22:29:19','35.92.139.233','paul.ziemann@orimi.co'),(13,'2024-11-20 22:30:50','176.102.65.28','javonte61@orimi.co'),(14,'2024-11-20 22:30:58','176.102.65.28','colby62'),(15,'2024-11-20 22:31:05','176.102.65.28','colby62'),(16,'2024-11-20 22:31:12','176.102.65.28','javonte61@orimi.co'),(17,'2024-11-20 22:31:20','176.102.65.28','javonte61@orimi.co'),(18,'2024-11-20 22:32:18','128.90.172.190','горислав.линдик@orimi.co'),(19,'2024-11-20 22:32:27','128.90.172.190','азарій_балабуха73'),(20,'2024-11-20 22:32:35','128.90.172.190','азарій_балабуха73'),(21,'2024-11-20 22:32:43','128.90.172.190','горислав.линдик@orimi.co'),(22,'2024-11-20 22:32:51','128.90.172.190','горислав.линдик@orimi.co'),(24,'2025-02-23 15:37:16','2.215.28.38','admin'),(25,'2025-02-23 15:37:33','2.215.28.38','admin'),(26,'2025-02-23 15:37:56','2.215.28.38','Admin'),(27,'2025-02-23 15:38:14','2.215.28.38','admin'),(28,'2025-02-23 15:38:29','2.215.28.38','holcz');
/*!40000 ALTER TABLE `FailLogin` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `FeeCoopVty`
--

DROP TABLE IF EXISTS `FeeCoopVty`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `FeeCoopVty` (
  `IDVty` int NOT NULL,
  `FracFeeCoopWholesaleMemb` decimal(3,2) NOT NULL,
  PRIMARY KEY (`IDVty`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `FeeCoopVty`
--

LOCK TABLES `FeeCoopVty` WRITE;
/*!40000 ALTER TABLE `FeeCoopVty` DISABLE KEYS */;
INSERT INTO `FeeCoopVty` VALUES (15232,0.10);
/*!40000 ALTER TABLE `FeeCoopVty` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `FlashMemb`
--

DROP TABLE IF EXISTS `FlashMemb`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `FlashMemb` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `FlashMemb`
--

LOCK TABLES `FlashMemb` WRITE;
/*!40000 ALTER TABLE `FlashMemb` DISABLE KEYS */;
/*!40000 ALTER TABLE `FlashMemb` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `InvcProducerOnsite`
--

DROP TABLE IF EXISTS `InvcProducerOnsite`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `InvcProducerOnsite` (
  `IDInvcProducerOnsite` int NOT NULL AUTO_INCREMENT,
  `IDCyc` int NOT NULL,
  `IDProducer` int NOT NULL,
  `NameFileInvc` varchar(25) NOT NULL,
  `SaleNom` decimal(9,2) NOT NULL,
  `FeeCoop` decimal(9,2) NOT NULL,
  `FeeInvt` decimal(9,2) NOT NULL,
  `Ttl` decimal(9,2) NOT NULL,
  `WhenCreate` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `CdInvcType` enum('Wholesale','Retail') NOT NULL DEFAULT 'Retail',
  PRIMARY KEY (`IDInvcProducerOnsite`),
  UNIQUE KEY `IDCyc_IDProducer_CdInvcType` (`IDCyc`,`IDProducer`,`CdInvcType`),
  KEY `kInvcProducerOnsite-IDProducer` (`IDProducer`),
  CONSTRAINT `kInvcProducerOnsite-IDCyc` FOREIGN KEY (`IDCyc`) REFERENCES `Cyc` (`IDCyc`),
  CONSTRAINT `kInvcProducerOnsite-IDProducer` FOREIGN KEY (`IDProducer`) REFERENCES `Producer` (`IDProducer`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `InvcProducerOnsite`
--

--
-- Table structure for table `InvcProducerWeb`
--

DROP TABLE IF EXISTS `InvcProducerWeb`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `InvcProducerWeb` (
  `IDInvcProducerWeb` int NOT NULL AUTO_INCREMENT,
  `IDCyc` int NOT NULL,
  `IDProducer` int NOT NULL,
  `NameFileInvc` varchar(25) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `SaleNom` decimal(9,2) NOT NULL,
  `FeeCoop` decimal(9,2) NOT NULL,
  `FeeInvt` decimal(9,2) NOT NULL,
  `Ttl` decimal(9,2) NOT NULL,
  `WhenUpd` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `CdInvcType` enum('Wholesale','Retail') NOT NULL DEFAULT 'Retail',
  PRIMARY KEY (`IDInvcProducerWeb`),
  UNIQUE KEY `kInvcProducerWeb-IDCyc_IDProducer` (`IDCyc`,`IDProducer`),
  KEY `kInvcProducerWeb-IDProducer` (`IDProducer`),
  CONSTRAINT `kInvcProducerWeb-IDCyc` FOREIGN KEY (`IDCyc`) REFERENCES `Cyc` (`IDCyc`),
  CONSTRAINT `kInvcProducerWeb-IDProducer` FOREIGN KEY (`IDProducer`) REFERENCES `Producer` (`IDProducer`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `InvcProducerWeb`
--

--
-- Table structure for table `InvcShopOnsite`
--

DROP TABLE IF EXISTS `InvcShopOnsite`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `InvcShopOnsite` (
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
  `CdInvcType` enum('Wholesale','Retail') NOT NULL DEFAULT 'Retail',
  PRIMARY KEY (`IDInvcShopOnsite`),
  KEY `kInvcShopOnsite-IDMemb` (`IDCartOnsite`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `InvcShopOnsite`
--

--
-- Table structure for table `InvcShopWeb`
--

DROP TABLE IF EXISTS `InvcShopWeb`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `InvcShopWeb` (
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
  `CdInvcType` enum('Wholesale','Retail') NOT NULL DEFAULT 'Retail',
  PRIMARY KEY (`IDInvcShopWeb`),
  UNIQUE KEY `IDCart` (`IDCart`),
  CONSTRAINT `kInvcShopWeb-IDCart` FOREIGN KEY (`IDCart`) REFERENCES `Cart` (`IDCart`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `InvcShopWeb`
--

--
-- Table structure for table `ItCart`
--

DROP TABLE IF EXISTS `ItCart`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ItCart` (
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
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ItCart`
--

--
-- Table structure for table `ItCartOnsite`
--

DROP TABLE IF EXISTS `ItCartOnsite`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ItCartOnsite` (
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ItCartOnsite`
--

--
-- Table structure for table `ItCartOnsitePend`
--

DROP TABLE IF EXISTS `ItCartOnsitePend`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ItCartOnsitePend` (
  `IDSess` varchar(128) NOT NULL,
  `IDVty` int NOT NULL,
  `WgtPer` float NOT NULL DEFAULT '0',
  `Qty` smallint NOT NULL DEFAULT '1',
  PRIMARY KEY (`IDSess`,`IDVty`,`WgtPer`) USING BTREE,
  KEY `kItCartOnsitePend-IDVty` (`IDVty`),
  CONSTRAINT `kItCartOnsitePend-IDSess` FOREIGN KEY (`IDSess`) REFERENCES `CartOnsitePend` (`IDSess`),
  CONSTRAINT `kItCartOnsitePend-IDVty` FOREIGN KEY (`IDVty`) REFERENCES `Vty` (`IDVty`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ItCartOnsitePend`
--

--
-- Table structure for table `ItDeliv`
--

DROP TABLE IF EXISTS `ItDeliv`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ItDeliv` (
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ItDeliv`
--

--
-- Table structure for table `ItPickup`
--

DROP TABLE IF EXISTS `ItPickup`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ItPickup` (
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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ItPickup`
--

--
-- Table structure for table `Loc`
--

DROP TABLE IF EXISTS `Loc`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Loc` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Loc`
--

LOCK TABLES `Loc` WRITE;
/*!40000 ALTER TABLE `Loc` DISABLE KEYS */;
INSERT INTO `Loc` VALUES ('ALB','Albia','Satel','Fiber Art Shoppe\r\n5 Benton Ave East\r\nAlbia, IA 52531','Pick up from 5:00-6:00 PM on distribution Thursdays outside the Fiber Art Shoppe.',1,0),('AMES','Ames','Satel','Practical Farmers of Iowa\r\n1615 Golden Aspen Drive, Suite 103\r\nAmes, IA 50010','Pick up between 4:30-5:30 PM on distribution Friday.',1,0),('ANK','Ankeny','Satel','United Church of Christ\r\n602 SE Delaware Ave.\r\nAnkeny, IA 50021','Pick up from 4:30-6:00 PM on distribution Thursdays from parking lot of Ankeny United Church of Christ.',1,0),('CENTRAL','Dummy Location','Central','Dummy Address','Change Me',1,0),('DWTN','Mickle Center','Satel','1620 Pleasant St.\r\nDes Moines, IA  50314','Pick up from 4:30 to 6:00 PM in basement kitchen of the Mickle Center. Park in lot on the SE corner of the building (off 16th Street) and enter building\'s south door.',0,0),('FRAN','Franklin Plaza','Central','Iowa Food Cooperative\r\n4944 Franklin Ave, Suite G\r\nDes Moines, IA 50310','Distribution occurs on distribution Fridays from Noon-7p and Saturdays from 10:30a-2p.',1,0),('HILL','Pleasant Hill','Satel','Pleasant Hill City Hall\r\n5160 Maple Dr #A\r\nPleasant Hill, IA','Pick up from 5-6 pm on distribution Thursdays.',1,0),('HOME','Home delivery','Deliv',NULL,'DELIVERIES WILL BE MADE BETWEEN 10AM-7PM on distribution Thursdays.',1,0),('IND','Indianola','Satel','Simpson College\r\n404 North Howard Street\r\nIndianola, IA 50125','Pick up from 5-6 PM on distribution Thursdays.',1,0),('MHM','Merle Hay Mall','Satel',NULL,NULL,0,0),('NEWT','Newton','Satel',NULL,'Pick up between 5:30-6:30 PM at a location to be determined.',0,0),('OSC','Osceola','Satel','Timber Ridge Country Market\r\n117 W Washington\r\nOsceola, IA 50213','Pick up from 5:00-6:30 PM on distribution Thursdays outside of Timber Ridge Country Market.',1,0),('OTT','Ottumwa','Satel','331 East Main St.\r\nOttumwa, IA','Pick up from 5-6 PM on distribution Thursdays at Market on Main.',0,0),('PAN','Panora','Satel','Early Morning Harvest\r\n2425 Willow Ave. \r\nPanora, IA 50216','Pick up from 4:30-5:30 PM at Early Morning Harvest Farm Store.',1,0),('WDM','West Des Moines','Satel','Maple Grove Church\r\n9155 Ashworth Rd\r\nWest Des Moines, IA 50266','Pick up from 5-6:30 PM on distribution Thursdays in parking lot of Maple Grove Church.',1,0);
/*!40000 ALTER TABLE `Loc` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Login`
--

DROP TABLE IF EXISTS `Login`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Login` (
  `IDLogin` int NOT NULL AUTO_INCREMENT,
  `zWhen` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `IP` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `NameLogin` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `IDMemb` int DEFAULT NULL,
  PRIMARY KEY (`IDLogin`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=95 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Login`
--

LOCK TABLES `Login` WRITE;
/*!40000 ALTER TABLE `Login` DISABLE KEYS */;
INSERT INTO `Login` VALUES (1,'2024-09-11 15:14:40','62.216.204.235','admin',1),(2,'2024-09-11 15:54:57','62.216.204.235','admin',1),(3,'2024-09-11 18:08:52','75.162.165.84','user',NULL),(4,'2024-09-11 18:09:13','75.162.165.84','admin',1),(5,'2024-09-11 18:56:45','62.216.204.235','admin',1),(6,'2024-09-23 21:02:11','75.162.172.159','User',NULL),(7,'2024-09-23 21:02:24','75.162.172.159','user',NULL),(8,'2024-09-23 21:03:31','75.162.172.159','admin',1),(9,'2024-09-24 11:50:50','::1','admin',1),(10,'2024-09-24 11:51:07','::1','holcz',NULL),(11,'2024-09-24 11:51:37','::1','holcz',NULL),(12,'2024-09-24 11:51:48','::1','admin',1),(13,'2024-09-24 13:15:15','98.97.3.157','admin',1),(14,'2024-09-24 14:16:21','46.110.88.28','admin',1),(15,'2024-09-24 14:29:43','46.110.88.28','admin',1),(16,'2024-09-24 21:19:05','98.97.3.157','admin',1),(17,'2024-09-26 00:50:24','98.97.14.94','admin',NULL),(18,'2024-09-26 00:50:39','98.97.14.94','admin',1),(19,'2024-09-26 12:39:05','86.101.7.120','admin',1),(20,'2024-09-26 13:07:59','62.216.204.249','admin',1),(21,'2024-09-26 16:55:48','46.110.88.28','admin',1),(22,'2024-09-26 17:14:59','46.110.88.28','admin',1),(23,'2024-09-26 17:42:55','46.110.88.28','admin',1),(24,'2024-10-04 09:25:04','62.216.204.93','admin',1),(25,'2024-10-08 13:35:33','172.58.13.230','admin',1),(26,'2024-10-08 13:46:49','172.58.13.230','admin',1),(27,'2024-10-19 13:04:52','204.8.176.186','admin',1),(28,'2024-10-22 09:08:12','62.216.204.217','holcz',NULL),(29,'2024-10-22 09:08:19','62.216.204.217','admin',1),(30,'2024-10-22 11:16:31','62.216.204.217','admin',1),(31,'2024-10-22 13:08:40','62.216.204.217','admin',1),(32,'2024-10-22 13:09:17','62.216.204.217','admin',1),(33,'2024-10-22 13:11:54','62.216.204.217','admin',1),(34,'2024-10-29 19:47:10','162.244.174.218','admin',1),(35,'2024-11-20 22:28:43','35.92.139.233','paul.ziemann@orimi.co',NULL),(36,'2024-11-20 22:28:51','35.92.139.233','maxie.white',NULL),(37,'2024-11-20 22:28:59','35.92.139.233','maxie.white',NULL),(38,'2024-11-20 22:29:10','35.92.139.233','paul.ziemann@orimi.co',NULL),(39,'2024-11-20 22:29:19','35.92.139.233','paul.ziemann@orimi.co',NULL),(40,'2024-11-20 22:30:50','176.102.65.28','javonte61@orimi.co',NULL),(41,'2024-11-20 22:30:58','176.102.65.28','colby62',NULL),(42,'2024-11-20 22:31:05','176.102.65.28','colby62',NULL),(43,'2024-11-20 22:31:12','176.102.65.28','javonte61@orimi.co',NULL),(44,'2024-11-20 22:31:20','176.102.65.28','javonte61@orimi.co',NULL),(45,'2024-11-20 22:32:18','128.90.172.190','горислав.линдик@orimi.co',NULL),(46,'2024-11-20 22:32:27','128.90.172.190','азарій_балабуха73',NULL),(47,'2024-11-20 22:32:35','128.90.172.190','азарій_балабуха73',NULL),(48,'2024-11-20 22:32:43','128.90.172.190','горислав.линдик@orimi.co',NULL),(49,'2024-11-20 22:32:51','128.90.172.190','горислав.линдик@orimi.co',NULL),(50,'2024-11-28 15:24:08','62.216.204.168','admin',1),(51,'2024-11-29 10:37:36','62.216.204.249','admin',1),(52,'2024-11-29 11:45:29','62.216.204.249','admin',1),(53,'2024-12-16 10:53:38','62.216.204.249','admin',NULL),(54,'2024-12-16 10:53:42','62.216.204.249','admin',1),(55,'2024-12-17 20:28:46','62.216.204.249','admin',1),(56,'2025-01-07 10:41:42','62.216.204.48','admin',1),(57,'2025-01-13 23:27:44','75.162.144.36','admin',1),(58,'2025-01-21 22:23:22','98.97.8.181','admin',1),(59,'2025-02-06 18:23:25','165.225.37.88','admin',1),(60,'2025-02-06 18:29:51','165.225.37.88','renybean',5942),(61,'2025-02-06 18:30:51','165.225.37.88','admin',1),(62,'2025-02-06 18:44:22','165.225.37.88','renybean',5942),(63,'2025-02-09 21:13:37','24.55.41.154','admin',1),(64,'2025-02-10 20:28:57','24.55.41.154','austin',5943),(65,'2025-02-11 18:52:00','24.55.41.154','admin',1),(66,'2025-02-14 22:21:51','98.97.9.111','admin',1),(67,'2025-02-19 20:11:16','75.162.135.3','admin',1),(68,'2025-02-20 15:57:16','98.97.11.162','admin',1),(69,'2025-02-23 15:37:16','2.215.28.38','admin',NULL),(70,'2025-02-23 15:37:33','2.215.28.38','admin',NULL),(71,'2025-02-23 15:37:56','2.215.28.38','Admin',NULL),(72,'2025-02-23 15:38:14','2.215.28.38','admin',NULL),(73,'2025-02-23 15:38:29','2.215.28.38','holcz',NULL),(74,'2025-02-23 15:48:08','98.97.5.217','admin',1),(75,'2025-02-24 14:09:14','216.82.30.137','admin',1),(76,'2025-02-24 21:02:42','75.162.135.3','admin',1),(77,'2025-03-03 12:58:53','207.91.254.122','admin',1),(78,'2025-03-31 12:47:44','98.97.3.214','admin',1),(79,'2025-04-28 18:20:20','2605:59c8:186b:3810:5c8e:c9a4:57c6:1f7c','admin',1),(80,'2025-04-29 02:02:31','24.55.41.154','admin',1),(81,'2025-04-30 15:46:42','2605:59c8:186b:3810:d822:7554:9c93:3a79','admin',1),(82,'2025-05-01 23:58:10','217.180.214.253','admin',1),(83,'2025-05-02 00:51:23','217.180.214.253','admin',NULL),(84,'2025-05-02 00:51:57','217.180.214.253','admin',1),(85,'2025-05-02 00:53:35','217.180.214.253','admin',1),(86,'2025-05-02 00:54:18','217.180.214.253','admin',1),(87,'2025-05-02 00:55:16','217.180.214.253','admin',1),(88,'2025-05-02 00:59:19','217.180.214.253','admin',1),(89,'2025-05-02 01:06:40','217.180.214.253','admin',1),(90,'2025-05-02 01:19:45','217.180.214.253','admin',1),(91,'2025-05-02 01:31:44','18.117.249.245','admin',1),(92,'2025-05-02 01:59:23','217.180.214.253','admin',1),(93,'2025-05-02 02:02:19','217.180.214.253','admin',1),(94,'2025-05-02 10:05:23','2001:a61:51ba:6101:dcb1:4ca7:b2f1:7cc4','admin',1);
/*!40000 ALTER TABLE `Login` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Memb`
--

DROP TABLE IF EXISTS `Memb`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Memb` (
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
  `CdRegWholesale` enum('Avail','Pend','Approv','Susp') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'Avail',
  PRIMARY KEY (`IDMemb`) USING BTREE,
  UNIQUE KEY `kMemb-NameLogin-Uniq` (`NameLogin`) USING BTREE,
  KEY `kMemb-CdLocLast` (`CdLocLast`) USING BTREE,
  CONSTRAINT `kMemb-CdLocLast` FOREIGN KEY (`CdLocLast`) REFERENCES `Loc` (`CdLoc`)
) ENGINE=InnoDB AUTO_INCREMENT=5944 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Memb`
--

LOCK TABLES `Memb` WRITE;
/*!40000 ALTER TABLE `Memb` DISABLE KEYS */;
INSERT INTO `Memb` VALUES (1,'admin','$2a$10$JeeTocTA5UtE5.QsnXLxk.zAiJqBniyU4SYgdUQYSyIKkm7pqzPhC',NULL,0,'Approv',0,'Avail','Avail',0,'StaffSuper',NULL,'CENTRAL',NULL,'Admin','User',NULL,NULL,'Yes Street',NULL,'Aux','AK','12341',NULL,1,NULL,'5555559999',0,NULL,NULL,'admin@example.com',1,1,NULL,1,1,'Flyer','admin',NULL,0,'2024-02-27 10:20:23',1,2,'Avail'),(5930,'newproducer','$2a$10$2HqUvwwl3r8SRHvJX2Pm8OPgdx9LUh550.SOpG0jAdyKQt3kNRys.',NULL,0,'Approv',0,'Avail','Avail',1,'NotStaff','2024-03-10 21:17:48','FRAN',NULL,'Merle','Tomatoe',NULL,NULL,'xxx  Praire Street',NULL,'WAUKEE','IA','50263',NULL,1,NULL,'5555559999',1,NULL,1,'test1@example.com',1,1,NULL,1,1,'Other',NULL,NULL,0,'2022-01-07 20:16:48',1,2,'Avail'),(5938,'loftis','$2a$10$mBeTx2ANWpvbqurgLSMkJeYnvg0hh2Npj5HuTrX.yJ/1xZCPFqWlK',NULL,0,'Approv',0,'Avail','Avail',1,'NotStaff','2024-01-12 13:32:43','FRAN','Tapas For You','Eric','Bean','Lisa','Bean','29762 310TH ST',NULL,'WAUKEE','IA','50263',NULL,1,NULL,'5555559999',1,NULL,1,'test2@example.com',1,1,NULL,1,1,'Other',NULL,'testing membership fee  notations',0,'2022-02-19 22:19:18',1,2,'Avail'),(5941,'KWMOOORE_Test','$2a$10$k/ps7CgRh12P59dM9rgyJuKyVve863rK1GYWBY4NKu69cDN5MbVhq',NULL,0,'Approv',0,'Avail','Avail',1,'StaffMgr','2022-08-23 16:23:24','FRAN',NULL,'Kitty','TEST','Katherine','Moore','2112 40th Pl',NULL,'Des Moines','IA','50310',NULL,0,NULL,'5555559999',0,NULL,0,'test3@example.com',0,0,NULL,0,0,'Other',NULL,'Kitty is working on our user manual',0,'2022-07-25 17:55:49',0,2,'Avail'),(5942,'renybean','$2a$10$Gw//GSTvutgVO5mgOart/..854vkRRazmmo.jm6F0MypwhTqhM3L6',NULL,0,'Approv',0,'Avail','Avail',1,'NotStaff',NULL,'FRAN','Quilted Acres','Reny','Bean',NULL,NULL,'1234 A street',NULL,'Riverbend','IA','50263',NULL,1,NULL,'5555559999',1,NULL,1,'test4@example.com',1,1,NULL,1,1,'Internet Search','google',NULL,0,'2025-02-06 18:29:51',1,0,'Avail'),(5943,'austin','$2a$10$TLiQQFOQ/2gOMhK41JdldOhN/C1v9j2YlckKpI25JcH7bForIEQWG',NULL,0,'Approv',0,'Avail','Avail',0,'NotStaff',NULL,'FRAN',NULL,'Austin','Texas',NULL,NULL,'1234 Congress',NULL,'Austin','TX','84585',NULL,1,NULL,'5555559999',1,NULL,1,'test5@example.com',1,1,NULL,1,1,'Flyer','google',NULL,0,'2025-02-10 20:28:57',1,0,'Approv');
/*!40000 ALTER TABLE `Memb` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Producer`
--

DROP TABLE IF EXISTS `Producer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Producer` (
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
  `CdRegWholesale` enum('Avail','Pend','Approv','Susp') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'Avail',
  PRIMARY KEY (`IDProducer`) USING BTREE,
  UNIQUE KEY `IDMemb` (`IDMemb`),
  UNIQUE KEY `CdProducer` (`CdProducer`),
  UNIQUE KEY `NameBusUNIQUE` (`NameBus`) USING BTREE,
  FULLTEXT KEY `NameBusFULLTEXT` (`NameBus`),
  CONSTRAINT `kProducer-IDMemb` FOREIGN KEY (`IDMemb`) REFERENCES `Memb` (`IDMemb`)
) ENGINE=InnoDB AUTO_INCREMENT=1211 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Producer`
--

LOCK TABLES `Producer` WRITE;
/*!40000 ALTER TABLE `Producer` DISABLE KEYS */;
INSERT INTO `Producer` VALUES (1203,5930,NULL,'Approv',1,'ZP4M1DGLNYNW.JPG','Goats and More','xxx Prairie Lane',NULL,'WAUKEE','IA','50263',NULL,0,'5151111111',0,NULL,0,'tomatoe@gmail.com',NULL,'we grow tomatoes and beans.  Our rows are tilled within our restored prairie.  We alternate tomatoes and beans  in our beds.   We also raise muscovy ducks  for eggs and meat.  The ducks help us with insect pests and are fun to watch.  we have grazing goats that we keep out of the garden but they help munch down shrubs like multiflora rose and honeysuckle.','tomatoes, all kinds\r\neggs \r\nPraire plants in bundles \r\nducks','We grow loads of wonderful tomatoes.  We are not certified organic but we use only compost, certified organic fertilizers, compost tea for fertilizer, and mechanical insect control - no insecticides are used on our farm.  Our animals are pastured','lots of observation and hard work','None',NULL,'no synthetic inputs','all natural diet of shrub',0,0,0,NULL,NULL,0,1,0,0,1,0,1,0,NULL,NULL,0,'2022-01-08 12:58:17','2022-01-08 12:58:17','https://www.facebook.com/lisa.n.bean//','https://instagram.com/lbean1006','https://iowafood.coop','Avail'),(1207,5938,NULL,'Approv',1,'32W7LLRZK0PR.jpg','Tapas For You','29762 310TH ST',NULL,'WAUKEE','IA','50263',NULL,0,'5152102140',1,NULL,0,'ericbean12@gmail.co',NULL,'My  5 years in Madrid inspired me to  bring a taste of Spain to Iowa.  Using locally grown potatoes and onions, and my pastured chicken eggs - I make authentic Spanish Tortillas in my certified kitchen in Iowa.','Tapas','loving care, locally grown ingredients - except the  olive oil  is from CA','good ones','None',NULL,'na','na',0,0,0,'na',NULL,0,0,0,0,0,0,1,0,NULL,NULL,0,'2022-02-19 22:25:30','2022-02-19 22:25:30',NULL,NULL,NULL,'Avail'),(1209,5941,NULL,'Approv',1,'RZN7BHD44TQ5.jpeg','Pink Peacock Gluten Free Baked Goods','4944 Franklin Ave','Suite G','Des Moines','IA','50310',NULL,0,'5555555555',0,NULL,0,'kitty@iowafoodfoundation.org',NULL,'Pink Peacock Baked Goods is a [sadly fictional] gluten-free bakery based right here in Des Moines Iowa, specializing in treats so delicious your friends, family & slightly adversarial dinner guests won\'t believe they could possibly be gluten-free! \r\n\r\nIn 2022, The Pink Peacock Bakery partnered with the Iowa Food Co-Op to help expand the locally-sourced gluten-free options available to Co-Op members. In a time where soaring retail rents make having our own storefront an impossibility, it’s wonderful to have a place to build community & share feedback with folks looking for GF options. Partnering with the IFC has also given me the opportunity to network with other local producers & to source new ingredients for my bakes! \r\n\r\nWhen I’m not working in my favorite shared kitchen space, I’m working on other projects & developing new skills. This year, I’m teaching myself audio editing & non-fiction writing as I solo-produce my first podcast, & I also do PR/marketing for my spouse\'s TTRPG book.','We carry a range of products for anybody with a gluten free sweet tooth. We have treats for any time of day, from donut holes to dinner rolls. \r\n\r\nSome of our treats are also available in dairy-free and sometimes egg-free or fully vegan options! All potential allergens will be clearly marked.','All Pink Peacock pastries are made in a dedicated gluten-free commercial kitchen space in compliance with the FDA standards for gluten-free goods. \r\n\r\nOur products are also made with locally sourced ingredients wherever possible, including vendors who will be very familiar to fellow IFC shoppers, including gluten-free flours from Breadtopia, duck eggs from Grand River Farms, apples and peaches from Iowa Orchard, and even edible flowers from Ray Family Farm!',NULL,'None',NULL,NULL,NULL,0,0,0,NULL,'x',0,0,0,0,0,0,0,0,NULL,NULL,0,'2022-07-25 18:20:15','2022-07-25 18:20:15','http://facebook.com/pinkpeacockDSM/////','http://instagram.com/PinkPeacockBakes','http://www.pinkpeacockDSM.com','Avail'),(1210,5942,NULL,'Approv',1,'E08FFC4343QW.jpg','Quilted Acres','1234 A Street',NULL,'Riverbend','IA','50263',NULL,1,'5152104866',0,NULL,0,'renybean58@gmail.com',NULL,'Our farm is located on 10 acres along the Racoon River.  We have 2 acres of vegetable production land surrounded by native prairie and pollinator habitat.  Our chicken\'s live in movable coops that provide access to prairie year round.','vegetables, eggs, flowers','We are certified organic','Our farm has 2 acres of vegetable production beds, our chickens free range on 1/2 acre - the remaining 7 1/2 acre are planted in native grasses and forbes .  We are certified organic','None',NULL,NULL,NULL,0,0,0,NULL,NULL,1,0,0,0,0,0,0,0,NULL,NULL,0,'2025-02-06 18:36:53','2025-02-06 18:36:53',NULL,NULL,NULL,'Approv');
/*!40000 ALTER TABLE `Producer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ProducerLabelHistory`
--

DROP TABLE IF EXISTS `ProducerLabelHistory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProducerLabelHistory` (
  `Id` int NOT NULL AUTO_INCREMENT,
  `ProducerId` int DEFAULT NULL,
  `LabelType` tinyint DEFAULT NULL,
  PRIMARY KEY (`Id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProducerLabelHistory`
--

LOCK TABLES `ProducerLabelHistory` WRITE;
/*!40000 ALTER TABLE `ProducerLabelHistory` DISABLE KEYS */;
INSERT INTO `ProducerLabelHistory` VALUES (1,1203,0);
/*!40000 ALTER TABLE `ProducerLabelHistory` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Product`
--

DROP TABLE IF EXISTS `Product`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Product` (
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
) ENGINE=InnoDB AUTO_INCREMENT=99992 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Product`
--

LOCK TABLES `Product` WRITE;
/*!40000 ALTER TABLE `Product` DISABLE KEYS */;
INSERT INTO `Product` VALUES (99957,1203,'dried beans','naturally grown beans, dried in sun.  Hand harvested by our family and threshed cleaned and packaged with care. Compost tea fertilizer, no pesticides.','S800DQ44PW07.jpg',263,'NON',0,0,0,0,0,0,1,0,0,0,0,0,0,0,'2022-02-10 22:01:38','2023-01-22 21:50:41',0,0,0,0,0,0,0,0,0,0,0),(99959,1207,'Spanish Tortilla','local eggs from pastured chicken flock, locally grown potatoes and onions , olive oil from CA , and salt.','QMVXA4KY9BAJ.PNG',69,'FROZ',0,1,0,0,0,0,0,0,0,0,0,0,0,0,'2022-02-19 22:28:40','2024-09-26 16:31:47',0,0,0,0,0,1,0,0,0,0,1),(99966,1209,'Thyme Loaf',NULL,NULL,83,'NON',0,0,1,0,0,0,0,0,0,0,0,0,0,0,'2022-07-25 18:40:24','2022-07-25 18:40:24',0,0,0,0,0,0,0,0,0,0,0),(99967,1209,'Grandmother Weatherley\'s Pineapple Upside-Down Cake (GF)','A gluten-free adaptation of a midcentury family recipe, Grandmother Weatherley\'s pineapple upside-down cake is as pretty as it is delicious. Produced in a dedicated gluten-free kitchen space according to FDA GF standards.\r\n\r\nAllergens: Eggs, milk, coconut\r\n\r\nIngredients: Breadtopia Gluten Free All-Purpose Flour (brown rice flour, sorghum flour, potato starch, tapioca flour, non-GMO xanthan gum), Grand River Farms duck eggs, Kalona unsalted butter, fresh pineapple, maraschino cherries, brown sugar, white sugar, baking powder, baking soda, egg whites, vanilla extract, Radiance whole milk, shredded coconut','J1FRUJ0V6WFH.jpg',215,'REF',0,0,1,0,0,0,0,0,0,0,0,0,0,0,'2022-07-27 17:55:52','2022-07-27 17:56:44',0,0,0,0,0,0,0,0,0,0,0),(99968,1209,'Sister Bertha\'s Shaker-Style Squash Rolls (GF)','A staple of our head baker\'s autumn table, this is a gluten-free adaptation of a New England squash roll recipe originating with the Shakers, an egalitarian Christian movement of which there are now only 3 surviving members.\r\n\r\nAllergens: Milk, eggs\r\n\r\nIngredients: Ingredients: Breadtopia Gluten-Free All-Purpose Flour (brown rice flour, sorghum flour, potato starch, tapioca flour, non-GMO xanthan gum),Organic Blue Hubbard squash puree, Radiance whole milk, white sugar, salt, Kalona unsalted butter, yeast, Grand River duck eggs','SQKR75REEZFJ.jpg',215,'REF',0,0,1,0,0,0,0,0,0,0,0,0,0,0,'2022-07-27 18:17:22','2022-09-19 17:34:46',0,0,0,0,0,0,0,0,0,0,1),(99969,1209,'London Fog Tea Cake','A perfect centerpiece for tea with friends or just on your own, gluten-free vanilla cake is infused with earl gray tea, frosted with a touch of buttercream, and decorated with candied edible flowers.\r\n\r\nAllergens: Milk, eggs\r\n\r\nIngredients: Breadtopia Gluten-Free All-Purpose Flour (brown rice flour, sorghum flour, potato starch, tapioca flour, non-GMO xanthan gum), Grand River Farms duck eggs, Kalona unsalted butter, white sugar, vanilla extract, baking powder, earl gray tea, Radiance whole milk, edible viola flowers','CCWFT6CLFEBX.jpg',215,'NON',0,0,1,0,0,0,0,0,0,0,0,0,0,0,'2022-07-27 18:27:05','2022-07-27 20:33:01',0,0,0,0,0,0,0,0,0,0,0),(99971,1209,'Farmer John\'s Apple Cider Donut Holes (GF)','My dad\'s recipe, these oversized donut holes are a perfect pairing with coffee or hot cider on a frigid New England morning. \r\n\r\nAllergens: Milk, Eggs\r\n\r\nIngredients: Breadtopia gluten-free flour (brown rice flour, sorghum flour, potato starch, tapioca flour, non-GMO xanthan gum), baking powder, cinnamon, white sugar, apple cider from Iowa Orchard, Radiance milk, duck eggs from Grand River Farms, vanilla extract, butter','3ADBQBNLC6UV.jpg',215,'REF',0,0,1,0,0,0,0,0,0,0,0,0,0,0,'2022-08-02 16:53:31','2022-08-02 16:53:31',0,0,0,0,0,0,0,0,0,0,0),(99972,1203,'Duck eggs','duck eggs from our pasture raised free range ducks- they have access to a pond and pasture year round.  we feed them organic grains and they forage for insects  and get scarps from our kitchen',NULL,3,'EGGS',0,0,0,0,0,0,0,0,0,1,0,0,0,0,'2022-08-02 21:07:31','2023-01-21 21:30:54',0,0,0,0,0,0,0,0,0,0,0),(99973,1203,'Ducks','raised from hatching on our pastures','YWP4M1ZDKZU7.jpg',41,'FROZ',0,0,0,0,0,0,0,0,0,1,0,0,0,0,'2022-08-02 21:15:49','2025-02-11 18:52:54',0,0,0,0,0,0,0,0,0,0,0),(99974,1203,'Cut Stems from the farm','Native Prairie plants gathered by hand.  These plants are from a pollinator habitat established 4 years ago.  bring a little bit of nature home to enjoy! bundles gathered by hand by family members.','D2ZZE4HEJGX1.jpg',73,'NON',0,0,0,0,0,0,1,0,0,0,0,0,0,0,'2022-08-02 21:24:45','2022-12-02 13:56:54',0,0,0,0,0,0,0,0,0,0,0),(99975,1203,'Prairie Plants','organically grown','TZKQ48MX7Q34.jpeg',199,'NON',0,0,0,0,1,0,0,0,0,0,0,0,0,0,'2022-08-04 16:47:30','2022-12-01 22:29:30',0,0,0,0,0,0,0,0,0,0,0),(99978,1209,'Apple Cinnamon Sandwich Bread (gluten-free)','This delicious sandwich bread is a sweet treat for breakfast but can also be toasted or grilled to make savory sandwiches. Makes a great grilled cheese! \r\n\r\nIngredients: Ingredients: Breadtopia Gluten-Free All-Purpose Flour (brown rice flour, sorghum flour, potato starch, tapioca flour, non-GMO xanthan gum), Macintosh Apples from Iowa Orchard Radiance whole milk, white sugar, salt, Kalona unsalted butter, yeast','FJYLTJQ31CBE.png',215,'REF',0,0,0,0,0,0,0,0,0,0,0,0,0,0,'2022-08-30 16:33:33','2024-09-26 16:29:32',0,0,0,0,0,0,0,0,0,0,1),(99981,1203,'Forest Bathing with Brandy Case Haub','Join Brandy for a Forest Bathing \r\nhttps://www.intertwinediowa.com/',NULL,62,'NON',0,0,0,0,0,0,0,0,0,0,0,0,0,0,'2022-10-20 21:08:00','2022-10-20 21:08:00',0,0,0,0,0,0,0,0,0,0,0),(99982,1203,'Goat  Stew Meat','our goats are raised browsing in pasture and woods.  We feed them grain once a day and they bed down in portable sheds at night.','A3KMH1H97M88.JPG',11,'FROZ',0,0,0,0,0,0,0,0,0,0,0,0,0,0,'2022-12-02 13:11:31','2023-01-22 13:56:40',0,0,0,0,0,1,0,0,0,0,0),(99983,1203,'test','test labels',NULL,41,'NON',0,0,0,0,0,0,0,0,0,0,0,0,0,0,'2022-12-12 19:30:19','2024-09-24 21:30:09',0,0,0,0,0,0,0,0,0,0,0),(99987,1209,'Gluten Free Soft Sandwich Bread','This delicious sandwich bread is buttery-soft, the perfect palette for any sandwich. Comes sliced or unsliced. Made in a certified GF commercial kitchen.\r\n\r\nIngredients: Ingredients: Breadtopia Gluten-Free All-Purpose Flour (brown rice flour, sorghum flour, potato starch, tapioca flour, non-GMO xanthan gum), plain Greek yogurt from Country View Dairy, white sugar, salt, Kalona unsalted butter, yeast','D6TRF5H8Q3T6.png',215,'REF',0,0,0,0,0,0,0,0,0,0,0,0,0,0,'2023-07-11 21:31:54','2023-07-11 21:38:38',0,0,0,0,0,0,0,0,0,0,1),(99988,1203,'Heirloom Tomatoes','Grown in our hi-tunel no synthetic inputs or pesticides.  A wide variety of heirloom tomatoes','9MUZL24Z4X5J.jpg',53,'NON',0,0,0,0,0,1,0,0,0,0,0,0,0,0,'2024-09-24 21:33:27','2024-09-24 21:37:42',0,0,0,0,0,0,0,0,0,0,0),(99989,1210,'Arugula','spicy and crisp!  great fresh or cooked','UQLR437S5PWX.jpg',19,'REF',0,0,0,0,1,0,0,0,0,0,0,0,0,0,'2025-02-09 21:30:05','2025-02-11 18:58:09',0,0,0,0,0,0,0,0,0,0,0),(99990,1210,'Arugula','big box of fresh arugula',NULL,19,'REF',0,0,0,0,1,0,0,0,0,0,0,0,0,0,'2025-02-14 22:31:04','2025-02-14 22:31:04',0,0,0,0,0,0,0,0,0,0,0),(99991,1210,'carrots',NULL,NULL,18,'REF',0,0,0,0,0,0,0,0,0,0,0,0,0,0,'2025-03-31 12:50:45','2025-03-31 12:57:20',0,0,0,0,0,0,0,0,0,0,0);
/*!40000 ALTER TABLE `Product` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ResetPass`
--

DROP TABLE IF EXISTS `ResetPass`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ResetPass` (
  `IDResetPass` int NOT NULL AUTO_INCREMENT,
  `zWhen` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `IP` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `NameLogin` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `Tok` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`IDResetPass`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ResetPass`
--

LOCK TABLES `ResetPass` WRITE;
/*!40000 ALTER TABLE `ResetPass` DISABLE KEYS */;
/*!40000 ALTER TABLE `ResetPass` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Site`
--

DROP TABLE IF EXISTS `Site`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Site` (
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
  `FracFeeCoopWholesaleMemb` decimal(3,2) NOT NULL DEFAULT '0.15',
  `FracFeeCoopWholesaleProducer` decimal(3,2) NOT NULL DEFAULT '0.15',
  PRIMARY KEY (`z`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Site`
--

LOCK TABLES `Site` WRITE;
/*!40000 ALTER TABLE `Site` DISABLE KEYS */;
INSERT INTO `Site` VALUES (1,0,10.00,10.00,10.00,0.175,0.1,10.00,10.00,10.00,0.10,0.15,0.15);
/*!40000 ALTER TABLE `Site` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `StApp`
--

DROP TABLE IF EXISTS `StApp`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `StApp` (
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
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `StApp`
--

LOCK TABLES `StApp` WRITE;
/*!40000 ALTER TABLE `StApp` DISABLE KEYS */;
INSERT INTO `StApp` VALUES (1,34,34,'StartShop',0);
/*!40000 ALTER TABLE `StApp` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'REAL_AS_FLOAT,PIPES_AS_CONCAT,ANSI_QUOTES,IGNORE_SPACE,ONLY_FULL_GROUP_BY,STRICT_ALL_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`admin`@`%`*/ /*!50003 TRIGGER `StApp_AfterUpd` AFTER UPDATE ON `StApp` FOR EACH ROW Proc: BEGIN
	DECLARE oCkDisabTrig TINYINT;
	SELECT CkDisabTrig FROM StApp INTO oCkDisabTrig;
	IF (oCkDisabTrig = 1) THEN
		LEAVE Proc;
	END IF;

	IF (NEW.CdPhaseCyc != OLD.CdPhaseCyc) THEN
		INSERT INTO EvtApp (CdEvtApp) VALUES (NEW.CdPhaseCyc);
	END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `Subcat`
--

DROP TABLE IF EXISTS `Subcat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Subcat` (
  `IDSubcat` int NOT NULL AUTO_INCREMENT,
  `IDCat` int NOT NULL,
  `NameSubcat` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `CkTaxSale` tinyint NOT NULL,
  `CkEBT` tinyint NOT NULL,
  PRIMARY KEY (`IDSubcat`) USING BTREE,
  UNIQUE KEY `IDCat_NameSubcat` (`IDCat`,`NameSubcat`) USING BTREE,
  FULLTEXT KEY `NameSubcat` (`NameSubcat`),
  CONSTRAINT `kSubcat-IDCat` FOREIGN KEY (`IDCat`) REFERENCES `Cat` (`IDCat`)
) ENGINE=InnoDB AUTO_INCREMENT=264 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Subcat`
--

LOCK TABLES `Subcat` WRITE;
/*!40000 ALTER TABLE `Subcat` DISABLE KEYS */;
INSERT INTO `Subcat` VALUES (1,10,'Chicken',0,1),(3,4,'Eggs',0,1),(4,10,'Turkey',0,1),(5,2,'Venison',0,1),(6,11,'Honey',0,1),(7,8,'Beeswax',1,0),(8,5,'Barbecue Sauce',0,1),(10,2,'Lamb',0,1),(11,2,'Goat',0,1),(12,15,'Other',1,0),(13,3,'Wheat Berries',0,1),(14,42,'Beef other',0,1),(15,2,'Pork',0,1),(16,2,'Buffalo',0,1),(17,14,'Soap',1,0),(18,1,'Root Vegetables',0,1),(19,1,'Greens and Lettuces',0,1),(20,1,'Winter Squash/Pumpkins',0,1),(21,4,'Cheese',0,1),(23,1,'Fresh + Live Herbs',0,1),(24,5,'Dried Herbs',0,1),(25,1,'Peppers (Sweet or Hot)',0,1),(26,1,'Green Beans',0,1),(28,24,'Pet Supplies',1,0),(29,12,'Farm Animal Supplies',1,0),(30,8,'Decorations',1,0),(31,20,'Caramel + Candy',0,1),(32,20,'Candy',0,1),(33,1,'Mushrooms',0,1),(34,21,'Soup Mix',0,1),(35,21,'Dip Mix',0,1),(37,11,'Sorghum Syrup',0,1),(38,8,'Lumber and Firewood',1,0),(40,5,'Infused + Balsamic Vinegar',0,1),(41,4,'Butter + Ghee ',0,1),(42,5,'Spice/Spice Mix',0,1),(44,8,'Christmas Items',1,0),(45,14,'Skin and Lip Care',1,0),(46,23,'Household Cleaners',1,0),(47,14,'Bath Salts/Oils',1,0),(49,14,'Repellents',1,0),(50,14,'Misc. Health/Beauty',1,0),(51,23,'Laundry/Clothes Care',1,0),(52,14,'Hair Care',1,0),(53,1,'Tomatoes',0,1),(56,25,'charitable donation',0,0),(60,20,'Salsa',0,1),(61,1,'Live Plants',0,1),(62,23,'Kitchen Items',1,0),(63,1,'Cucumbers',0,1),(64,31,'Memberships',0,1),(65,1,'Summer Squash',0,1),(67,20,'Hummus + Dips',0,1),(68,27,'Soups and Stews',0,1),(69,27,'Entrees + Meals',0,1),(70,27,'Sauces + Salad Dressings',0,1),(72,2,'Rabbit',0,1),(73,23,'Home Decor + Accents',1,0),(74,8,'Garden Accessories',1,0),(75,30,'Canned Goods',0,1),(76,3,'Flour',0,1),(77,3,'Cornmeal',0,1),(79,8,'Worm Castings',1,0),(80,9,'Coffee',0,1),(82,6,'Pies',0,1),(83,6,'Bread',0,1),(84,6,'Cookies, Brownies, Bars',0,1),(87,13,'Melons',0,1),(88,13,'Berries and Strawberries',0,1),(89,13,'Peaches',0,1),(90,13,'Plums',0,1),(91,13,'Grapes',0,1),(92,13,'Apples',0,1),(93,13,'Pears',0,1),(95,13,'Cherries',0,1),(99,1,'Peas',0,1),(101,1,'Sweet Corn',0,1),(103,6,'Cake',0,1),(104,1,'Eggplant',0,1),(105,1,'Misc. Vegetables',0,1),(107,3,'Pasta',0,1),(108,8,'Apparel',1,0),(109,8,'Accessories/Jewelry',1,0),(112,27,'Desserts',0,1),(113,8,'Live Plants (non-food)',1,0),(114,8,'Plant Seeds (non-food)',1,0),(115,1,'Seeds',0,1),(119,31,'Printed Materials',0,0),(120,10,'Other',0,1),(121,8,'Miscellaneous',1,0),(122,8,'Art',1,0),(124,8,'Baby Items',1,0),(125,9,'Tea + Kombucha',0,1),(126,6,'Cheesecake',0,1),(128,32,'Delivery',0,1),(129,2,'Grass-Finished Beef',0,1),(131,7,'Other',0,1),(132,24,'Pet Food',1,0),(133,24,'Bird Food',1,0),(134,24,'Pet Supplements',1,0),(135,1,'Carrots',0,1),(138,1,'Potatoes',0,1),(139,1,'Onions/Shallots/Leeks',0,1),(140,2,'Elk',0,1),(141,5,'Infused Olive Oil for fun',0,1),(142,2,'Emu',0,1),(143,6,'Rolls + Buns',0,1),(144,1,'Garlic',0,1),(145,1,'Cabbage',0,1),(146,9,'Wine',1,0),(147,35,'Jam & Jellies',0,1),(149,10,'Duck',0,1),(150,3,'Granola',0,1),(151,1,'Rhubarb',0,1),(152,20,'Popcorn',0,1),(154,32,'Garden Consulting',0,1),(155,7,'Chestnuts',0,1),(156,7,'Walnuts',0,1),(157,37,'Other Transplants',1,1),(159,37,'Tomato Transplants',1,1),(160,37,'Pepper Transplants',1,1),(161,37,'Herb Transplants',1,1),(162,37,'Onion Transplants',1,1),(163,1,'Beets',0,1),(164,1,'Kale',0,1),(165,10,'Quail',0,1),(166,10,'Goose',0,1),(167,23,'Candles',1,0),(168,15,'Soaps',1,0),(169,38,'Jam & Jellies',0,1),(170,38,'Meats',0,1),(171,38,'Other',0,1),(172,1,'Sweet Potatoes',0,1),(173,2,'Grass-Fed Lamb',0,1),(174,2,'Beef (Grass Fed)',0,1),(175,21,'Baking Mixes',0,1),(176,9,'Cider',0,1),(177,12,'Farm Animals',0,1),(178,30,'Dried Fruits',0,1),(179,6,'Crisps, Turnovers, Scones',0,1),(180,1,'Asparagus',0,1),(181,5,'Pickled Peppers',0,1),(182,3,'Cereal',0,1),(183,5,'Dip Mixes',0,1),(184,5,'Pasta Sauce',0,1),(185,4,'Yogurt',0,1),(186,5,'Steak/Meat Seasonings or Rubs',0,1),(187,5,'Pickles',0,1),(188,5,'Sauerkraut + Kimchi',0,1),(189,27,'Kimchi',0,1),(190,3,'Dry Edible Beans',0,1),(191,31,'Gift Certificates',0,0),(192,35,'Applesauce',0,1),(193,6,'Donuts',0,1),(194,31,'Apparel',1,0),(195,2,'Fish + Seafood',0,1),(196,4,'Milk',0,1),(197,1,'Micro-Greens + Sprouts',0,1),(198,4,'Ice Cream + Frozen Yogurt',0,1),(199,37,'Flower Transplants',1,0),(200,1,'Broccoli',0,1),(201,24,'Pet Treats',1,0),(203,8,'Cut Flowers',1,0),(204,1,'Edible Flowers',0,1),(205,11,'Syrups & Maple Cream',0,1),(206,13,'Fruit Concentrates',0,1),(207,8,'Gourds',1,0),(208,38,'Cooking Oils',0,1),(209,38,'Cheeses',0,1),(210,31,'Classes',0,0),(211,9,'Fruit Juice',0,1),(212,27,'Baby Food',0,1),(213,31,'Home Delivery',0,1),(214,4,'Cream',0,1),(215,6,'Gluten-Free Baked Goods',0,1),(217,1,'Celery',0,1),(218,5,'Mustard',0,1),(219,19,'Live Herb Plants',0,1),(221,8,'Landscaping Plants',1,0),(222,8,'House Plants',1,0),(223,40,'Miscellaneous Classes',0,0),(224,8,'Fruit Tree Seedlings',0,1),(225,3,'Gluten-Free Flour',0,1),(226,20,'Chocolate + Fudge',1,1),(227,8,'Greeting Cards',1,0),(228,1,'Frozen Vegetables',0,1),(229,20,'Chips + Crackers',0,1),(230,5,'Hot Sauce',0,1),(231,4,'Goat-Based Dairy',0,1),(232,20,'Meat Sticks + Jerky',0,1),(233,4,'Cottage Cheese',0,1),(234,42,'Ground + Patties',0,1),(235,42,'Roasts',0,1),(236,42,'Steaks',0,1),(237,42,'Mixed Cut Bundles',0,1),(238,42,'Bones + Organs',0,1),(239,42,'Ribs',0,1),(240,42,'Sausage + Charcuterie',0,1),(241,42,'Other (Quarters/Halves/Whole)',0,1),(242,42,'Cubes + Strips ',0,1),(243,37,'Vegetable Seeds',1,1),(244,43,'Crickets',0,1),(245,43,'Plant-Based Protein',0,1),(246,9,'Mixers and Wine',0,1),(247,5,'Salad Dressing',0,1),(252,36,'Livestock Feed',0,1),(253,40,'for children',0,0),(255,31,'community giving',0,0),(256,30,'Vegan',0,0),(257,6,'fat free',0,0),(258,6,'Vegan baked goods',0,0),(260,6,'Whoooha',1,1),(261,4,'sour cream',0,1),(263,1,'Dried beans',0,0);
/*!40000 ALTER TABLE `Subcat` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Transact`
--

DROP TABLE IF EXISTS `Transact`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Transact` (
  `IDTransact` int NOT NULL AUTO_INCREMENT,
  `IDMemb` int DEFAULT NULL,
  `IDProducer` int DEFAULT NULL,
  `IDInvc` int DEFAULT NULL,
  `CdTypeTransact` enum('Migrate','FeeMembInit','FeeMembRenew','RefundFeeMembInit','EarnInvcProducerWeb','EarnInvcProducerOnsite','EarnInvcProducerOnsiteWholesale','ChargeInvcShopWeb','ChargeInvcShopOnsite','ChargeInvcShopOnsiteWholesale','PayRecv','PaySent','Adj') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Transact`
--

--
-- Table structure for table `Vty`
--

DROP TABLE IF EXISTS `Vty`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Vty` (
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
  `CdVtyType` enum('Wholesale','Retail') NOT NULL DEFAULT 'Retail',
  PRIMARY KEY (`IDVty`),
  UNIQUE KEY `Upc_UNIQUE` (`Upc`),
  KEY `kVty-IDProduct` (`IDProduct`),
  FULLTEXT KEY `Size_Kind` (`Size`,`Kind`),
  CONSTRAINT `kVty-IDProduct` FOREIGN KEY (`IDProduct`) REFERENCES `Product` (`IDProduct`)
) ENGINE=InnoDB AUTO_INCREMENT=15234 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Vty`
--

LOCK TABLES `Vty` WRITE;
/*!40000 ALTER TABLE `Vty` DISABLE KEYS */;
INSERT INTO `Vty` VALUES (15166,99957,'Lima','1 lb',NULL,NULL,0,0,1,0,0,39,3.00,3.00,10,3.00,0,'2022-02-10 22:01:38','2023-03-13 20:23:48',NULL,'Retail'),(15167,99957,'navy beans','1 lb',NULL,NULL,0,0,1,0,0,47,3.00,3.00,0,3.00,0,'2022-02-10 22:02:11','2023-01-22 21:51:10',NULL,'Retail'),(15168,99957,'harlequin beans','1 lb',NULL,NULL,0,0,1,1,0,47,3.00,3.00,5,3.00,0,'2022-02-10 22:05:56','2025-01-21 22:29:24',NULL,'Retail'),(15170,99959,NULL,'small 5 inch torilla',NULL,NULL,0,0,1,0,0,20,5.00,5.00,0,5.00,0,'2022-02-19 22:28:40','2022-02-19 22:28:40',NULL,'Retail'),(15171,99959,NULL,'large , 10 inch tortilla',NULL,NULL,0,0,0,0,0,20,9.00,9.00,0,9.00,0,'2022-02-19 22:29:35','2022-02-19 22:29:35',NULL,'Retail'),(15172,99959,NULL,'large , 10 inch tortilla',NULL,NULL,0,0,1,0,0,16,9.00,9.00,0,9.00,0,'2022-02-19 22:30:57','2022-03-21 21:34:36',NULL,'Retail'),(15183,99966,NULL,'1 loaf',NULL,NULL,0,0,0,0,1,13,8.00,8.00,3,8.00,0,'2022-07-25 18:40:24','2022-07-27 18:17:37',NULL,'Retail'),(15184,99967,NULL,'Whole (9\") cake',NULL,NULL,0,0,1,0,0,6,20.00,20.00,0,20.00,0,'2022-07-27 17:55:52','2022-07-27 17:55:52',NULL,'Retail'),(15185,99967,NULL,'Single Slice',NULL,NULL,0,0,1,0,0,12,5.00,5.00,0,5.00,0,'2022-07-27 18:00:08','2022-07-27 18:00:08',NULL,'Retail'),(15186,99968,NULL,'Bakers dozen (13 rolls)',NULL,NULL,0,0,1,0,0,4,20.00,20.00,0,20.00,0,'2022-07-27 18:17:22','2022-07-27 18:17:22',NULL,'Retail'),(15187,99968,NULL,'Half dozen (6 rolls)',NULL,NULL,0,0,1,0,0,6,10.00,10.00,0,10.00,0,'2022-07-27 18:18:15','2022-07-27 18:19:01',NULL,'Retail'),(15188,99968,NULL,'Single roll',NULL,NULL,0,0,1,0,0,12,3.00,3.00,0,3.00,0,'2022-07-27 18:22:40','2022-07-27 18:22:40',NULL,'Retail'),(15189,99969,NULL,'Whole (9\") bunt cake',NULL,NULL,0,0,1,1,0,4,25.00,25.00,0,25.00,0,'2022-07-27 18:27:05','2022-07-27 19:05:48',NULL,'Retail'),(15190,99969,NULL,'Single Slice',NULL,NULL,0,0,1,1,0,6,5.00,5.00,6,5.00,0,'2022-07-27 19:05:05','2022-07-27 19:05:05',NULL,'Retail'),(15194,99971,'Plain','Half dozen (6 oversized donut holes)',NULL,NULL,0,0,1,0,0,4,10.00,10.00,0,10.00,0,'2022-08-02 16:53:31','2022-08-02 16:53:31',NULL,'Retail'),(15195,99971,'Cinnamon','Half dozen (6 oversized donut holes)',NULL,NULL,0,0,1,0,0,4,10.00,10.00,0,10.00,0,'2022-08-02 17:37:00','2022-08-02 17:37:00',NULL,'Retail'),(15196,99972,'one dozen','Medium',NULL,NULL,0,0,1,1,0,6,6.00,6.00,6,6.00,0,'2022-08-02 21:07:31','2023-01-23 18:30:54',NULL,'Retail'),(15197,99973,'Muscovy',NULL,3,5,0,0,1,0,0,1,2.00,2.00,0,2.00,0,'2022-08-02 21:15:49','2022-08-02 21:15:49',NULL,'Retail'),(15198,99974,'ditch weed','one bundle',NULL,NULL,0,0,1,0,0,8,10.00,10.00,0,10.00,0,'2022-08-02 21:24:45','2022-08-02 21:24:45',NULL,'Retail'),(15199,99975,'wild petunia','4 pk',NULL,NULL,0,0,1,0,0,4,12.00,12.00,0,12.00,0,'2022-08-04 16:47:30','2022-12-07 20:52:06',NULL,'Retail'),(15201,99974,'wild quinine','one stem',NULL,NULL,0,0,1,0,0,9,5.00,5.00,0,8.00,0,'2022-08-08 16:43:16','2022-12-02 13:58:58',NULL,'Retail'),(15202,99974,'compass plant','bunch of 3',NULL,NULL,0,0,0,1,0,8,8.00,8.00,0,8.00,0,'2022-08-08 16:47:59','2022-12-02 13:57:33',NULL,'Retail'),(15203,99974,'wild petunia','6 stems',NULL,NULL,0,0,1,1,0,9,7.00,7.00,8,10.00,0,'2022-08-08 16:54:55','2023-01-23 18:30:39',NULL,'Retail'),(15206,99978,'Sliced','1 loaf',NULL,NULL,0,0,1,0,0,6,8.00,8.00,0,8.00,0,'2022-08-30 16:33:33','2024-02-29 10:25:44',NULL,'Retail'),(15207,99978,'Unsliced','1 loaf',NULL,NULL,0,0,0,0,0,6,8.00,8.00,0,8.00,0,'2022-08-30 16:34:13','2022-08-30 16:34:13',NULL,'Retail'),(15214,99981,NULL,'1 class',NULL,NULL,0,0,0,0,1,10,0.00,0.00,0,0.00,0,'2022-10-20 21:08:00','2022-12-02 15:07:53',NULL,'Retail'),(15215,99982,'stew meat',NULL,1,3,0,0,1,0,0,2,7.00,7.00,0,7.00,0,'2022-12-02 13:11:31','2022-12-04 20:29:29',NULL,'Retail'),(15216,99982,'stew meat',NULL,3,4,0,0,1,0,0,5,7.00,7.00,0,7.00,0,'2022-12-02 13:12:48','2022-12-04 20:02:10',NULL,'Retail'),(15217,99972,'one dozen','large',NULL,NULL,0,0,1,1,0,8,7.00,7.00,8,7.00,0,'2022-12-04 01:54:05','2025-01-21 22:28:40',NULL,'Retail'),(15218,99972,'one dozen','small',NULL,NULL,0,0,1,0,0,9,4.00,4.00,0,7.00,0,'2022-12-04 01:55:16','2022-12-04 02:00:45',NULL,'Retail'),(15219,99957,'navy beans','5 lb',NULL,NULL,0,0,1,0,0,9,12.00,12.00,10,12.00,0,'2022-12-04 20:34:40','2023-01-23 18:31:54',NULL,'Retail'),(15220,99983,'1234567891011121','1 dozen',NULL,NULL,0,0,0,0,1,8,4.00,4.00,0,4.00,0,'2022-12-12 19:30:19','2024-09-24 21:29:03',NULL,'Retail'),(15221,99983,'123456789123456789','123456789123456789',NULL,NULL,0,0,0,0,0,10,5.00,5.00,0,5.00,0,'2022-12-12 19:33:21','2022-12-12 19:37:32',NULL,'Retail'),(15226,99987,'Unsliced','1 loaf',NULL,NULL,0,0,1,0,0,6,8.00,8.00,0,8.00,0,'2023-07-11 21:31:54','2023-07-11 21:31:54',NULL,'Retail'),(15227,99987,'Sliced','1 loaf',NULL,NULL,0,0,1,0,0,6,8.00,8.00,8,8.00,0,'2023-07-11 21:40:08','2023-07-11 21:40:08',NULL,'Retail'),(15228,99988,NULL,'1 lb box',NULL,NULL,0,0,1,1,0,10,3.00,3.00,5,3.00,0,'2024-09-24 21:33:27','2025-01-21 22:29:04',NULL,'Retail'),(15229,99988,NULL,'3 lb box',NULL,NULL,0,0,1,1,0,10,8.00,8.00,5,8.00,0,'2024-09-24 21:38:38','2024-09-24 21:39:39',NULL,'Retail'),(15230,99989,'small leaves','1/2 lb',NULL,NULL,0,0,1,1,0,10,4.00,4.00,4,4.00,0,'2025-02-09 21:30:05','2025-03-31 12:57:02',NULL,'Retail'),(15231,99989,'Large leaves','I LB',NULL,NULL,0,0,1,1,0,10,7.00,7.00,7,7.00,0,'2025-02-11 18:59:11','2025-03-31 12:56:47',NULL,'Retail'),(15232,99990,NULL,'10 lb',NULL,NULL,0,0,0,1,0,0,0.00,0.00,10,30.00,0,'2025-02-14 22:31:04','2025-02-14 22:31:32',NULL,'Wholesale'),(15233,99991,NULL,'3 lb bag',NULL,NULL,0,0,1,1,0,0,6.00,6.00,20,6.00,0,'2025-03-31 12:50:45','2025-03-31 12:57:42',NULL,'Retail');
/*!40000 ALTER TABLE `Vty` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `WgtItCartOnsite`
--

DROP TABLE IF EXISTS `WgtItCartOnsite`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `WgtItCartOnsite` (
  `IDWgtItCartOnsite` int NOT NULL AUTO_INCREMENT,
  `IDItCartOnsite` int NOT NULL,
  `WgtPer` float NOT NULL,
  `Qty` smallint NOT NULL,
  PRIMARY KEY (`IDWgtItCartOnsite`),
  KEY `kWgtItCartOnsite-IDItCartOnsite` (`IDItCartOnsite`),
  CONSTRAINT `kWgtItCartOnsite-IDItCartOnsite` FOREIGN KEY (`IDItCartOnsite`) REFERENCES `ItCartOnsite` (`IDItCartOnsite`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `WgtItCartOnsite`
--

LOCK TABLES `WgtItCartOnsite` WRITE;
/*!40000 ALTER TABLE `WgtItCartOnsite` DISABLE KEYS */;
/*!40000 ALTER TABLE `WgtItCartOnsite` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `WgtLblOrdWeb`
--

DROP TABLE IF EXISTS `WgtLblOrdWeb`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `WgtLblOrdWeb` (
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `WgtLblOrdWeb`
--

LOCK TABLES `WgtLblOrdWeb` WRITE;
/*!40000 ALTER TABLE `WgtLblOrdWeb` DISABLE KEYS */;
/*!40000 ALTER TABLE `WgtLblOrdWeb` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int unsigned NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

--
-- Dumping routines for database 'dbifcom'
--
/*!50003 DROP PROCEDURE IF EXISTS `ItCart_Add` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
CREATE DEFINER=`admin`@`%` PROCEDURE `ItCart_Add`(
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `ItCart_Upd` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
CREATE DEFINER=`admin`@`%` PROCEDURE `ItCart_Upd`(
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 DROP PROCEDURE IF EXISTS `ItsCartFromIDCart` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = '' */ ;
DELIMITER ;;
CREATE DEFINER=`admin`@`%` PROCEDURE `ItsCartFromIDCart`(
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
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-05-02 12:10:29
