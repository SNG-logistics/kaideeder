-- AlterTable
ALTER TABLE `orders` ADD COLUMN `orderType` ENUM('DINE_IN', 'DELIVERY', 'PICKUP') NOT NULL DEFAULT 'DINE_IN',
    MODIFY `status` ENUM('PENDING_CONFIRM', 'OPEN', 'CLOSED', 'CANCELLED', 'VOID') NOT NULL DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE `products` ADD COLUMN `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    MODIFY `productType` ENUM('SALE_ITEM', 'RAW_MATERIAL', 'PREP', 'PACKAGING', 'ENTERTAIN') NOT NULL DEFAULT 'SALE_ITEM',
    MODIFY `imageBase64` MEDIUMTEXT NULL;

-- AlterTable
ALTER TABLE `stock_movements` MODIFY `type` ENUM('PURCHASE', 'TRANSFER', 'SALE', 'ADJUSTMENT', 'WASTE', 'OPENING', 'RETURN', 'PRODUCTION_OUT', 'PRODUCTION_IN') NOT NULL;

-- AlterTable
ALTER TABLE `tenants` ADD COLUMN `logoBase64` LONGTEXT NULL,
    ADD COLUMN `menuBannerBase64` LONGTEXT NULL,
    ADD COLUMN `qrBankingBase64` LONGTEXT NULL;

-- CreateTable
CREATE TABLE `stock_counts` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ADJUSTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `note` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stock_counts_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `stock_counts_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_count_items` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `countId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NOT NULL,
    `systemQty` DOUBLE NOT NULL,
    `countedQty` DOUBLE NULL,
    `difference` DOUBLE NULL,
    `unit` VARCHAR(191) NOT NULL,

    INDEX `stock_count_items_tenantId_idx`(`tenantId`),
    INDEX `stock_count_items_countId_idx`(`countId`),
    UNIQUE INDEX `stock_count_items_countId_productId_locationId_key`(`countId`, `productId`, `locationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `uom_conversions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `fromUnit` VARCHAR(191) NOT NULL,
    `toUnit` VARCHAR(191) NOT NULL,
    `factor` DOUBLE NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `uom_conversions_tenantId_idx`(`tenantId`),
    INDEX `uom_conversions_productId_fkey`(`productId`),
    UNIQUE INDEX `uom_conversions_tenantId_productId_fromUnit_toUnit_key`(`tenantId`, `productId`, `fromUnit`, `toUnit`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consume_fail_logs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `orderNumber` VARCHAR(191) NULL,
    `menuId` VARCHAR(191) NULL,
    `menuName` VARCHAR(191) NULL,
    `ingredientId` VARCHAR(191) NULL,
    `ingredientName` VARCHAR(191) NULL,
    `locationId` VARCHAR(191) NULL,
    `failReason` ENUM('NO_BOM', 'BOM_INCOMPLETE', 'NO_UOM_CONV', 'STOCK_EMPTY', 'WRONG_WAREHOUSE', 'NO_GR', 'SYSTEM_ERROR') NOT NULL,
    `requiredQty` DOUBLE NOT NULL DEFAULT 0,
    `requiredUnit` VARCHAR(191) NULL,
    `availableQty` DOUBLE NOT NULL DEFAULT 0,
    `detail` VARCHAR(191) NULL,
    `status` ENUM('OPEN', 'RESOLVED', 'IGNORED') NOT NULL DEFAULT 'OPEN',
    `resolvedAt` DATETIME(3) NULL,
    `resolvedNote` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `consume_fail_logs_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `consume_fail_logs_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `consume_fail_logs_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prep_recipes` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `outputProductId` VARCHAR(191) NOT NULL,
    `yieldQty` DOUBLE NOT NULL,
    `yieldUnit` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `prep_recipes_tenantId_idx`(`tenantId`),
    INDEX `prep_recipes_outputProductId_idx`(`outputProductId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prep_recipe_lines` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `prepRecipeId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `unit` VARCHAR(191) NOT NULL,

    INDEX `prep_recipe_lines_tenantId_idx`(`tenantId`),
    INDEX `prep_recipe_lines_prepRecipeId_idx`(`prepRecipeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prep_productions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `prepRecipeId` VARCHAR(191) NOT NULL,
    `producedQty` DOUBLE NOT NULL,
    `locationId` VARCHAR(191) NOT NULL,
    `preparedById` VARCHAR(191) NULL,
    `producedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `note` VARCHAR(191) NULL,

    INDEX `prep_productions_tenantId_idx`(`tenantId`),
    INDEX `prep_productions_prepRecipeId_idx`(`prepRecipeId`),
    INDEX `prep_productions_tenantId_producedAt_idx`(`tenantId`, `producedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `delivery_info` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `customerName` VARCHAR(191) NOT NULL,
    `customerPhone` VARCHAR(191) NOT NULL,
    `addressText` VARCHAR(191) NOT NULL,
    `channel` ENUM('WHATSAPP', 'LINE', 'PHONE', 'WALKIN', 'WEBSITE', 'OTHER') NOT NULL DEFAULT 'PHONE',
    `deliveryStatus` ENUM('RECEIVED', 'PREPARING', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'RECEIVED',
    `deliveryFee` DOUBLE NOT NULL DEFAULT 0,
    `isPrepaid` BOOLEAN NOT NULL DEFAULT false,
    `paymentRef` VARCHAR(191) NULL,
    `riderId` VARCHAR(191) NULL,
    `driverNote` VARCHAR(191) NULL,
    `estimatedAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `delivery_info_orderId_key`(`orderId`),
    INDEX `delivery_info_tenantId_idx`(`tenantId`),
    INDEX `delivery_info_tenantId_deliveryStatus_idx`(`tenantId`, `deliveryStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_items` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `normalizedName` VARCHAR(191) NOT NULL,
    `itemRole` ENUM('RAW', 'PREP', 'SUPPLY', 'SERVICE') NOT NULL,
    `itemKind` ENUM('INGREDIENT', 'SEMI_FINISHED', 'NON_STOCK') NOT NULL,
    `categoryKey` VARCHAR(191) NULL,
    `proteinFamily` VARCHAR(191) NULL,
    `speciesType` VARCHAR(191) NULL,
    `cutPart` VARCHAR(191) NULL,
    `formState` VARCHAR(191) NULL,
    `baseUnit` VARCHAR(191) NOT NULL,
    `purchaseUnit` VARCHAR(191) NULL,
    `trackStock` BOOLEAN NOT NULL DEFAULT true,
    `isPurchasable` BOOLEAN NOT NULL DEFAULT true,
    `isSellable` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('DRAFT', 'NEED_REVIEW', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `aiConfidence` DECIMAL(5, 4) NULL,
    `aiStatus` ENUM('AI_SUGGESTED', 'USER_CONFIRMED') NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `inventory_items_tenantId_idx`(`tenantId`),
    INDEX `inventory_items_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `inventory_items_tenantId_itemRole_idx`(`tenantId`, `itemRole`),
    UNIQUE INDEX `inventory_items_tenantId_code_key`(`tenantId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_unit_conversions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `inventoryItemId` VARCHAR(191) NOT NULL,
    `fromUnit` VARCHAR(191) NOT NULL,
    `toUnit` VARCHAR(191) NOT NULL,
    `ratio` DECIMAL(18, 6) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `item_unit_conversions_tenantId_idx`(`tenantId`),
    INDEX `item_unit_conversions_inventoryItemId_idx`(`inventoryItemId`),
    UNIQUE INDEX `item_unit_conversions_tenantId_inventoryItemId_fromUnit_toUn_key`(`tenantId`, `inventoryItemId`, `fromUnit`, `toUnit`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_aliases` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `inventoryItemId` VARCHAR(191) NOT NULL,
    `aliasName` VARCHAR(191) NOT NULL,
    `normalizedAliasName` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('USER', 'AI', 'IMPORT') NOT NULL DEFAULT 'USER',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `item_aliases_tenantId_idx`(`tenantId`),
    INDEX `item_aliases_inventoryItemId_idx`(`inventoryItemId`),
    UNIQUE INDEX `item_aliases_tenantId_aliasName_key`(`tenantId`, `aliasName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_item_classifications` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `inventoryItemId` VARCHAR(191) NULL,
    `inputName` VARCHAR(191) NOT NULL,
    `suggestedRole` VARCHAR(191) NULL,
    `suggestedKind` VARCHAR(191) NULL,
    `suggestedCategory` VARCHAR(191) NULL,
    `suggestedBaseUnit` VARCHAR(191) NULL,
    `suggestedPurchaseUnit` VARCHAR(191) NULL,
    `suggestedCode` VARCHAR(191) NULL,
    `suggestedProteinFamily` VARCHAR(191) NULL,
    `suggestedSpeciesType` VARCHAR(191) NULL,
    `suggestedCutPart` VARCHAR(191) NULL,
    `suggestedFormState` VARCHAR(191) NULL,
    `confidenceScore` DECIMAL(5, 4) NOT NULL,
    `duplicateCandidateJson` JSON NOT NULL,
    `warningJson` JSON NOT NULL,
    `rawModelResponse` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_item_classifications_tenantId_idx`(`tenantId`),
    INDEX `ai_item_classifications_inventoryItemId_idx`(`inventoryItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `validation_issues` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL DEFAULT 'ITEM',
    `entityId` VARCHAR(191) NOT NULL,
    `issueCode` VARCHAR(191) NOT NULL,
    `severity` ENUM('INFO', 'WARNING', 'ERROR') NOT NULL,
    `message` TEXT NOT NULL,
    `detailsJson` JSON NOT NULL,
    `status` ENUM('OPEN', 'RESOLVED', 'IGNORED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,
    `resolvedBy` VARCHAR(191) NULL,

    INDEX `validation_issues_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `validation_issues_tenantId_entityId_idx`(`tenantId`, `entityId`),
    INDEX `validation_issues_entityId_idx`(`entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_recommendations` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL DEFAULT 'ITEM',
    `entityId` VARCHAR(191) NULL,
    `recommendationType` ENUM('FIX_METADATA', 'CREATE_ALIAS', 'REVIEW_DUPLICATE') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `detailsJson` JSON NOT NULL,
    `confidenceScore` DECIMAL(5, 4) NOT NULL,
    `riskLevel` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL DEFAULT 'LOW',
    `status` ENUM('OPEN', 'APPROVED', 'REJECTED', 'APPLIED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approvedAt` DATETIME(3) NULL,
    `approvedBy` VARCHAR(191) NULL,

    INDEX `ai_recommendations_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `ai_recommendations_tenantId_entityType_status_idx`(`tenantId`, `entityType`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `entity_usage_summary` (
    `tenantId` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `purchaseTxnCount` INTEGER NOT NULL DEFAULT 0,
    `stockTxnCount` INTEGER NOT NULL DEFAULT 0,
    `lastUsedAt` DATETIME(3) NULL,

    INDEX `entity_usage_summary_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`tenantId`, `entityType`, `entityId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `orders_orderType_idx` ON `orders`(`orderType`);

-- AddForeignKey
ALTER TABLE `stock_counts` ADD CONSTRAINT `stock_counts_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_counts` ADD CONSTRAINT `stock_counts_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_counts` ADD CONSTRAINT `stock_counts_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_count_items` ADD CONSTRAINT `stock_count_items_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_count_items` ADD CONSTRAINT `stock_count_items_countId_fkey` FOREIGN KEY (`countId`) REFERENCES `stock_counts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_count_items` ADD CONSTRAINT `stock_count_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_count_items` ADD CONSTRAINT `stock_count_items_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `uom_conversions` ADD CONSTRAINT `uom_conversions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `uom_conversions` ADD CONSTRAINT `uom_conversions_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consume_fail_logs` ADD CONSTRAINT `consume_fail_logs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consume_fail_logs` ADD CONSTRAINT `consume_fail_logs_menuId_fkey` FOREIGN KEY (`menuId`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `consume_fail_logs` ADD CONSTRAINT `consume_fail_logs_ingredientId_fkey` FOREIGN KEY (`ingredientId`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prep_recipes` ADD CONSTRAINT `prep_recipes_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prep_recipes` ADD CONSTRAINT `prep_recipes_outputProductId_fkey` FOREIGN KEY (`outputProductId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prep_recipe_lines` ADD CONSTRAINT `prep_recipe_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prep_recipe_lines` ADD CONSTRAINT `prep_recipe_lines_prepRecipeId_fkey` FOREIGN KEY (`prepRecipeId`) REFERENCES `prep_recipes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prep_recipe_lines` ADD CONSTRAINT `prep_recipe_lines_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prep_productions` ADD CONSTRAINT `prep_productions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prep_productions` ADD CONSTRAINT `prep_productions_prepRecipeId_fkey` FOREIGN KEY (`prepRecipeId`) REFERENCES `prep_recipes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prep_productions` ADD CONSTRAINT `prep_productions_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `delivery_info` ADD CONSTRAINT `delivery_info_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `delivery_info` ADD CONSTRAINT `delivery_info_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_unit_conversions` ADD CONSTRAINT `item_unit_conversions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_unit_conversions` ADD CONSTRAINT `item_unit_conversions_inventoryItemId_fkey` FOREIGN KEY (`inventoryItemId`) REFERENCES `inventory_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_aliases` ADD CONSTRAINT `item_aliases_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_aliases` ADD CONSTRAINT `item_aliases_inventoryItemId_fkey` FOREIGN KEY (`inventoryItemId`) REFERENCES `inventory_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_item_classifications` ADD CONSTRAINT `ai_item_classifications_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_item_classifications` ADD CONSTRAINT `ai_item_classifications_inventoryItemId_fkey` FOREIGN KEY (`inventoryItemId`) REFERENCES `inventory_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `validation_issues` ADD CONSTRAINT `validation_issues_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `validation_issues` ADD CONSTRAINT `validation_issues_entityId_fkey` FOREIGN KEY (`entityId`) REFERENCES `inventory_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_recommendations` ADD CONSTRAINT `ai_recommendations_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_recommendations` ADD CONSTRAINT `ai_recommendations_entityId_fkey` FOREIGN KEY (`entityId`) REFERENCES `inventory_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `entity_usage_summary` ADD CONSTRAINT `entity_usage_summary_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
