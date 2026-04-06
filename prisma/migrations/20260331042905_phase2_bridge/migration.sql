-- AlterTable
ALTER TABLE `products` ADD COLUMN `inventoryItemId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `products_inventoryItemId_fkey` ON `products`(`inventoryItemId`);

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_inventoryItemId_fkey` FOREIGN KEY (`inventoryItemId`) REFERENCES `inventory_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
