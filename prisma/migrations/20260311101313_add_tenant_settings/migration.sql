-- AlterTable
ALTER TABLE `tenants` ADD COLUMN `address` TEXT NULL,
    ADD COLUMN `currency` VARCHAR(191) NOT NULL DEFAULT 'LAK',
    ADD COLUMN `language` VARCHAR(191) NOT NULL DEFAULT 'th',
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `receiptHeader` TEXT NULL,
    ADD COLUMN `storeNameLao` VARCHAR(191) NULL,
    ADD COLUMN `taxId` VARCHAR(191) NULL,
    ADD COLUMN `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Vientiane';

-- CreateTable
CREATE TABLE `product_aliases` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `alias` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `product_aliases_tenantId_idx`(`tenantId`),
    INDEX `product_aliases_productId_fkey`(`productId`),
    UNIQUE INDEX `product_aliases_tenantId_alias_key`(`tenantId`, `alias`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sku_suggestions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `importSource` VARCHAR(191) NULL,
    `rawName` VARCHAR(191) NOT NULL,
    `rawUnit` VARCHAR(191) NULL,
    `rawCategory` VARCHAR(191) NULL,
    `rawCostPrice` DOUBLE NULL,
    `rawSalePrice` DOUBLE NULL,
    `suggestedSku` VARCHAR(191) NULL,
    `matchedProductId` VARCHAR(191) NULL,
    `matchScore` DOUBLE NULL,
    `status` ENUM('PENDING', 'APPROVED_MAP', 'APPROVED_NEW', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `resolvedById` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sku_suggestions_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `sku_suggestions_matchedProductId_fkey`(`matchedProductId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_config` (
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `updatedBy` VARCHAR(191) NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product_aliases` ADD CONSTRAINT `product_aliases_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_aliases` ADD CONSTRAINT `product_aliases_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sku_suggestions` ADD CONSTRAINT `sku_suggestions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sku_suggestions` ADD CONSTRAINT `sku_suggestions_matchedProductId_fkey` FOREIGN KEY (`matchedProductId`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
