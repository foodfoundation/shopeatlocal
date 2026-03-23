-- Active: 1773225539253@@127.0.0.1@3306@ifcom_wholesale
ALTER TABLE `Site`
ADD COLUMN `CkShowDistinguishedMembersPage` TINYINT(1) NOT NULL DEFAULT '1';
