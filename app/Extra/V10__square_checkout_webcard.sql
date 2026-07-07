ALTER TABLE `SquareCheckout`
MODIFY COLUMN `CdTypeSquareCheckout` enum('Terminal','Cash','AutoCharge','WebCard') CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL;
