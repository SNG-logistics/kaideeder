-- AlterTable
ALTER TABLE `order_items` ADD COLUMN `toppingsJson` TEXT NULL,
    ADD COLUMN `toppingsTotal` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `toppingsJson` TEXT NULL;
