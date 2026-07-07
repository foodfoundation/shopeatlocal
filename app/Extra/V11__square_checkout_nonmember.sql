ALTER TABLE `SquareCheckout`
  MODIFY COLUMN `IDMemb` int DEFAULT NULL,
  MODIFY COLUMN `IDMembStaffCreate` int DEFAULT NULL,
  ADD COLUMN `IDInvc` int DEFAULT NULL AFTER `IDTransact`,
  ADD KEY `kSquareCheckout-IDInvc` (`IDInvc`);
