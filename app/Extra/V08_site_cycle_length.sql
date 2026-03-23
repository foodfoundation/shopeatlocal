-- Active: 1773225539253@@127.0.0.1@3306@ifcom_wholesale
ALTER TABLE `Site`
ADD COLUMN `QtyCycleLength` int unsigned NOT NULL DEFAULT '2';
